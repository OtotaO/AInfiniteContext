/**
 * Backup and recovery utilities for InfiniteContext
 * 
 * This module provides utilities for backing up and recovering data
 * to ensure it can be restored in case of corruption or loss.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { errorHandler, StorageError, ErrorCodes } from './ErrorHandler.js';
import { transactionManager, createOperation } from './TransactionManager.js';

/**
 * Backup options
 */
export interface BackupOptions {
  basePath?: string;
  backupPath?: string;
  includeVectorStores?: boolean;
  includeBuckets?: string[];
  excludeBuckets?: string[];
  maxBackups?: number;
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  id: string;
  timestamp: string;
  version: string;
  options: BackupOptions;
  stats: {
    totalSize: number;
    bucketCount: number;
    chunkCount: number;
  };
}

/**
 * Recovery options
 */
export interface RecoveryOptions {
  backupId?: string;
  backupPath?: string;
  targetPath?: string;
  includeBuckets?: string[];
  excludeBuckets?: string[];
  overwriteExisting?: boolean;
}

/**
 * Backup manager for data backup and recovery
 */
export class BackupManager {
  private static instance: BackupManager;
  private defaultBasePath: string;
  private defaultBackupPath: string;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
    this.defaultBasePath = path.join(os.homedir(), '.infinite-context');
    this.defaultBackupPath = path.join(this.defaultBasePath, 'backups');
  }
  
  public static getInstance(): BackupManager {
    if (!BackupManager.instance) {
      BackupManager.instance = new BackupManager();
    }
    return BackupManager.instance;
  }
  
  /**
   * Create a backup of the data
   * 
   * @param options - The backup options
   * @returns The backup metadata
   */
  public async createBackup(options: BackupOptions = {}): Promise<BackupMetadata> {
    const basePath = options.basePath || this.defaultBasePath;
    const backupPath = options.backupPath || this.defaultBackupPath;
    const backupId = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const backupDir = path.join(backupPath, backupId);
    
    try {
      // Ensure backup directory exists
      await this.ensureDirectoryExists(backupPath);
      await this.ensureDirectoryExists(backupDir);
      
      // Get list of buckets to backup
      const buckets = await this.getBucketsToBackup(basePath, options);
      
      // Create backup operations
      const operations = [];
      
      // Backup each bucket
      for (const bucket of buckets) {
        operations.push(
          createOperation(
            `Backup bucket ${bucket}`,
            async () => {
              const bucketPath = path.join(basePath, 'buckets', bucket);
              const bucketBackupPath = path.join(backupDir, 'buckets', bucket);
              
              await this.ensureDirectoryExists(path.dirname(bucketBackupPath));
              await this.backupDirectory(bucketPath, bucketBackupPath);
              
              return bucket;
            },
            async () => {
              // Rollback: delete the bucket backup
              const bucketBackupPath = path.join(backupDir, 'buckets', bucket);
              if (fs.existsSync(bucketBackupPath)) {
                await fs.promises.rm(bucketBackupPath, { recursive: true, force: true });
              }
            }
          )
        );
      }
      
      // Backup vector stores if requested
      if (options.includeVectorStores !== false) {
        operations.push(
          createOperation(
            'Backup vector stores',
            async () => {
              const vectorStorePath = path.join(basePath, 'vector-stores');
              const vectorStoreBackupPath = path.join(backupDir, 'vector-stores');
              
              if (fs.existsSync(vectorStorePath)) {
                await this.ensureDirectoryExists(vectorStoreBackupPath);
                await this.backupDirectory(vectorStorePath, vectorStoreBackupPath);
              }
              
              return 'vector-stores';
            },
            async () => {
              // Rollback: delete the vector store backup
              const vectorStoreBackupPath = path.join(backupDir, 'vector-stores');
              if (fs.existsSync(vectorStoreBackupPath)) {
                await fs.promises.rm(vectorStoreBackupPath, { recursive: true, force: true });
              }
            }
          )
        );
      }
      
      // Execute backup operations
      const result = await transactionManager.executeTransaction(operations);
      
      if (result.status !== 'committed') {
        throw new Error(`Backup failed: ${result.error?.message}`);
      }
      
      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        options,
        stats: await this.calculateBackupStats(backupDir),
      };
      
      // Write backup metadata
      await fs.promises.writeFile(
        path.join(backupDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      // Cleanup old backups if needed
      if (options.maxBackups && options.maxBackups > 0) {
        await this.cleanupOldBackups(backupPath, options.maxBackups);
      }
      
      return metadata;
    } catch (error) {
      // Clean up failed backup
      if (fs.existsSync(backupDir)) {
        try {
          await fs.promises.rm(backupDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('Failed to clean up failed backup:', cleanupError);
        }
      }
      
      errorHandler.handleError(
        new StorageError(`Backup failed: ${(error as Error).message}`, {
          code: ErrorCodes.STORAGE_WRITE_FAILED,
          details: {
            backupId,
            error,
          },
          recoverable: false,
        })
      );
      
      throw error;
    }
  }
  
  /**
   * Recover data from a backup
   * 
   * @param options - The recovery options
   * @returns Whether the recovery was successful
   */
  public async recoverFromBackup(options: RecoveryOptions = {}): Promise<boolean> {
    const backupPath = options.backupPath || this.defaultBackupPath;
    const targetPath = options.targetPath || this.defaultBasePath;
    
    try {
      // Find the backup to recover from
      const backupDir = await this.findBackupDirectory(backupPath, options.backupId);
      
      if (!backupDir) {
        throw new Error(`Backup not found: ${options.backupId}`);
      }
      
      // Read backup metadata
      const metadataPath = path.join(backupDir, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        throw new Error(`Backup metadata not found: ${metadataPath}`);
      }
      
      const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8')) as BackupMetadata;
      
      // Get list of buckets to recover
      const buckets = await this.getBucketsToRecover(backupDir, options);
      
      // Create recovery operations
      const operations = [];
      
      // Recover each bucket
      for (const bucket of buckets) {
        operations.push(
          createOperation(
            `Recover bucket ${bucket}`,
            async () => {
              const bucketBackupPath = path.join(backupDir, 'buckets', bucket);
              const bucketTargetPath = path.join(targetPath, 'buckets', bucket);
              
              // Skip if bucket doesn't exist in backup
              if (!fs.existsSync(bucketBackupPath)) {
                return null;
              }
              
              // Create backup of existing bucket if it exists
              if (fs.existsSync(bucketTargetPath) && !options.overwriteExisting) {
                const backupName = `${bucket}-pre-recovery-${new Date().toISOString().replace(/[:.]/g, '-')}`;
                const preRecoveryPath = path.join(targetPath, 'recovery-backups', backupName);
                
                await this.ensureDirectoryExists(path.dirname(preRecoveryPath));
                await this.backupDirectory(bucketTargetPath, preRecoveryPath);
              }
              
              // Ensure target directory exists
              await this.ensureDirectoryExists(path.dirname(bucketTargetPath));
              
              // Remove existing bucket if overwriting
              if (fs.existsSync(bucketTargetPath) && options.overwriteExisting) {
                await fs.promises.rm(bucketTargetPath, { recursive: true, force: true });
              }
              
              // Recover bucket
              await this.recoverDirectory(bucketBackupPath, bucketTargetPath);
              
              return bucket;
            },
            async () => {
              // Rollback not implemented for recovery
              // It's too risky to try to undo a recovery operation
            }
          )
        );
      }
      
      // Recover vector stores if they exist in the backup
      const vectorStoreBackupPath = path.join(backupDir, 'vector-stores');
      if (fs.existsSync(vectorStoreBackupPath)) {
        operations.push(
          createOperation(
            'Recover vector stores',
            async () => {
              const vectorStoreTargetPath = path.join(targetPath, 'vector-stores');
              
              // Create backup of existing vector stores if they exist
              if (fs.existsSync(vectorStoreTargetPath) && !options.overwriteExisting) {
                const backupName = `vector-stores-pre-recovery-${new Date().toISOString().replace(/[:.]/g, '-')}`;
                const preRecoveryPath = path.join(targetPath, 'recovery-backups', backupName);
                
                await this.ensureDirectoryExists(path.dirname(preRecoveryPath));
                await this.backupDirectory(vectorStoreTargetPath, preRecoveryPath);
              }
              
              // Ensure target directory exists
              await this.ensureDirectoryExists(vectorStoreTargetPath);
              
              // Remove existing vector stores if overwriting
              if (fs.existsSync(vectorStoreTargetPath) && options.overwriteExisting) {
                await fs.promises.rm(vectorStoreTargetPath, { recursive: true, force: true });
              }
              
              // Recover vector stores
              await this.recoverDirectory(vectorStoreBackupPath, vectorStoreTargetPath);
              
              return 'vector-stores';
            },
            async () => {
              // Rollback not implemented for recovery
            }
          )
        );
      }
      
      // Execute recovery operations
      const result = await transactionManager.executeTransaction(operations);
      
      return result.status === 'committed';
    } catch (error) {
      errorHandler.handleError(
        new StorageError(`Recovery failed: ${(error as Error).message}`, {
          code: ErrorCodes.STORAGE_READ_FAILED,
          details: {
            backupId: options.backupId,
            error,
          },
          recoverable: false,
        })
      );
      
      return false;
    }
  }
  
  /**
   * List available backups
   * 
   * @param backupPath - The path to the backups directory
   * @returns The list of backup metadata
   */
  public async listBackups(backupPath?: string): Promise<BackupMetadata[]> {
    const backupsDir = backupPath || this.defaultBackupPath;
    
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(backupsDir)) {
        return [];
      }
      
      // Get list of backup directories
      const backupDirs = await fs.promises.readdir(backupsDir);
      
      // Read metadata for each backup
      const backups: BackupMetadata[] = [];
      
      for (const dir of backupDirs) {
        const metadataPath = path.join(backupsDir, dir, 'metadata.json');
        
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8')) as BackupMetadata;
            backups.push(metadata);
          } catch (error) {
            console.error(`Failed to read backup metadata: ${metadataPath}`, error);
          }
        }
      }
      
      // Sort backups by timestamp (newest first)
      return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      errorHandler.handleError(
        new StorageError(`Failed to list backups: ${(error as Error).message}`, {
          code: ErrorCodes.STORAGE_READ_FAILED,
          details: {
            backupPath: backupsDir,
            error,
          },
          recoverable: true,
        })
      );
      
      return [];
    }
  }
  
  /**
   * Delete a backup
   * 
   * @param backupId - The ID of the backup to delete
   * @param backupPath - The path to the backups directory
   * @returns Whether the deletion was successful
   */
  public async deleteBackup(backupId: string, backupPath?: string): Promise<boolean> {
    const backupsDir = backupPath || this.defaultBackupPath;
    
    try {
      // Find the backup directory
      const backupDir = await this.findBackupDirectory(backupsDir, backupId);
      
      if (!backupDir) {
        throw new Error(`Backup not found: ${backupId}`);
      }
      
      // Delete the backup directory
      await fs.promises.rm(backupDir, { recursive: true, force: true });
      
      return true;
    } catch (error) {
      errorHandler.handleError(
        new StorageError(`Failed to delete backup: ${(error as Error).message}`, {
          code: ErrorCodes.STORAGE_DELETE_FAILED,
          details: {
            backupId,
            error,
          },
          recoverable: true,
        })
      );
      
      return false;
    }
  }
  
  /**
   * Get the list of buckets to backup
   * 
   * @param basePath - The base path
   * @param options - The backup options
   * @returns The list of buckets to backup
   */
  private async getBucketsToBackup(basePath: string, options: BackupOptions): Promise<string[]> {
    const bucketsDir = path.join(basePath, 'buckets');
    
    // Ensure buckets directory exists
    if (!fs.existsSync(bucketsDir)) {
      return [];
    }
    
    // Get list of all buckets
    const allBuckets = await fs.promises.readdir(bucketsDir);
    
    // Filter buckets based on options
    let buckets = allBuckets;
    
    if (options.includeBuckets && options.includeBuckets.length > 0) {
      buckets = buckets.filter(bucket => options.includeBuckets!.includes(bucket));
    }
    
    if (options.excludeBuckets && options.excludeBuckets.length > 0) {
      buckets = buckets.filter(bucket => !options.excludeBuckets!.includes(bucket));
    }
    
    return buckets;
  }
  
  /**
   * Get the list of buckets to recover
   * 
   * @param backupDir - The backup directory
   * @param options - The recovery options
   * @returns The list of buckets to recover
   */
  private async getBucketsToRecover(backupDir: string, options: RecoveryOptions): Promise<string[]> {
    const bucketsDir = path.join(backupDir, 'buckets');
    
    // Ensure buckets directory exists
    if (!fs.existsSync(bucketsDir)) {
      return [];
    }
    
    // Get list of all buckets in the backup
    const allBuckets = await fs.promises.readdir(bucketsDir);
    
    // Filter buckets based on options
    let buckets = allBuckets;
    
    if (options.includeBuckets && options.includeBuckets.length > 0) {
      buckets = buckets.filter(bucket => options.includeBuckets!.includes(bucket));
    }
    
    if (options.excludeBuckets && options.excludeBuckets.length > 0) {
      buckets = buckets.filter(bucket => !options.excludeBuckets!.includes(bucket));
    }
    
    return buckets;
  }
  
  /**
   * Find a backup directory by ID
   * 
   * @param backupPath - The path to the backups directory
   * @param backupId - The ID of the backup to find
   * @returns The path to the backup directory, or null if not found
   */
  private async findBackupDirectory(backupPath: string, backupId?: string): Promise<string | null> {
    // If no backup ID is provided, use the most recent backup
    if (!backupId) {
      const backups = await this.listBackups(backupPath);
      
      if (backups.length === 0) {
        return null;
      }
      
      return path.join(backupPath, backups[0].id);
    }
    
    // Check if the backup directory exists
    const backupDir = path.join(backupPath, backupId);
    
    if (fs.existsSync(backupDir)) {
      return backupDir;
    }
    
    return null;
  }
  
  /**
   * Ensure a directory exists
   * 
   * @param dir - The directory to ensure exists
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }
  
  /**
   * Backup a directory
   * 
   * @param sourceDir - The source directory
   * @param targetDir - The target directory
   */
  private async backupDirectory(sourceDir: string, targetDir: string): Promise<void> {
    // Ensure target directory exists
    await this.ensureDirectoryExists(targetDir);
    
    // Get list of files and directories in the source directory
    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
    
    // Process each entry
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively backup subdirectory
        await this.backupDirectory(sourcePath, targetPath);
      } else {
        // Backup file
        await this.backupFile(sourcePath, targetPath);
      }
    }
  }
  
  /**
   * Backup a file
   * 
   * @param sourcePath - The source file path
   * @param targetPath - The target file path
   */
  private async backupFile(sourcePath: string, targetPath: string): Promise<void> {
    // Compress the file
    const gzipTargetPath = `${targetPath}.gz`;
    
    await pipeline(
      createReadStream(sourcePath),
      createGzip(),
      createWriteStream(gzipTargetPath)
    );
  }
  
  /**
   * Recover a directory
   * 
   * @param sourceDir - The source directory
   * @param targetDir - The target directory
   */
  private async recoverDirectory(sourceDir: string, targetDir: string): Promise<void> {
    // Ensure target directory exists
    await this.ensureDirectoryExists(targetDir);
    
    // Get list of files and directories in the source directory
    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
    
    // Process each entry
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.isFile() && entry.name.endsWith('.gz') ? entry.name.slice(0, -3) : entry.name);
      
      if (entry.isDirectory()) {
        // Recursively recover subdirectory
        await this.recoverDirectory(sourcePath, targetPath);
      } else if (entry.isFile() && entry.name.endsWith('.gz')) {
        // Recover compressed file
        await this.recoverFile(sourcePath, targetPath);
      }
    }
  }
  
  /**
   * Recover a file
   * 
   * @param sourcePath - The source file path
   * @param targetPath - The target file path
   */
  private async recoverFile(sourcePath: string, targetPath: string): Promise<void> {
    // Decompress the file
    const { createGunzip } = await import('zlib');
    
    await pipeline(
      createReadStream(sourcePath),
      createGunzip(),
      createWriteStream(targetPath)
    );
  }
  
  /**
   * Calculate backup statistics
   * 
   * @param backupDir - The backup directory
   * @returns The backup statistics
   */
  private async calculateBackupStats(backupDir: string): Promise<BackupMetadata['stats']> {
    let totalSize = 0;
    let bucketCount = 0;
    let chunkCount = 0;
    
    // Calculate total size
    const calculateSize = async (dir: string): Promise<void> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await calculateSize(entryPath);
        } else if (entry.isFile()) {
          const stats = await fs.promises.stat(entryPath);
          totalSize += stats.size;
          
          // Count chunks
          if (entryPath.includes('/chunks/') && entry.name.endsWith('.gz')) {
            chunkCount++;
          }
        }
      }
    };
    
    // Count buckets
    const bucketsDir = path.join(backupDir, 'buckets');
    if (fs.existsSync(bucketsDir)) {
      const buckets = await fs.promises.readdir(bucketsDir);
      bucketCount = buckets.length;
      
      // Calculate size and count chunks
      await calculateSize(bucketsDir);
    }
    
    // Include vector stores in total size
    const vectorStoresDir = path.join(backupDir, 'vector-stores');
    if (fs.existsSync(vectorStoresDir)) {
      await calculateSize(vectorStoresDir);
    }
    
    return {
      totalSize,
      bucketCount,
      chunkCount,
    };
  }
  
  /**
   * Clean up old backups
   * 
   * @param backupPath - The path to the backups directory
   * @param maxBackups - The maximum number of backups to keep
   */
  private async cleanupOldBackups(backupPath: string, maxBackups: number): Promise<void> {
    try {
      // Get list of backups
      const backups = await this.listBackups(backupPath);
      
      // If we have more backups than the maximum, delete the oldest ones
      if (backups.length > maxBackups) {
        const backupsToDelete = backups.slice(maxBackups);
        
        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.id, backupPath);
        }
      }
    } catch (error) {
      console.error('Failed to clean up old backups:', error);
    }
  }
}

// Export the singleton instance
export const backupManager = BackupManager.getInstance();

/**
 * Utility function to create a backup
 * 
 * @param options - The backup options
 * @returns The backup metadata
 */
export function createBackup(options: BackupOptions = {}): Promise<BackupMetadata> {
  return backupManager.createBackup(options);
}

/**
 * Utility function to recover from a backup
 * 
 * @param options - The recovery options
 * @returns Whether the recovery was successful
 */
export function recoverFromBackup(options: RecoveryOptions = {}): Promise<boolean> {
  return backupManager.recoverFromBackup(options);
}

/**
 * Utility function to list available backups
 * 
 * @param backupPath - The path to the backups directory
 * @returns The list of backup metadata
 */
export function listBackups(backupPath?: string): Promise<BackupMetadata[]> {
  return backupManager.listBackups(backupPath);
}

/**
 * Utility function to delete a backup
 * 
 * @param backupId - The ID of the backup to delete
 * @param backupPath - The path to the backups directory
 * @returns Whether the deletion was successful
 */
export function deleteBackup(backupId: string, backupPath?: string): Promise<boolean> {
  return backupManager.deleteBackup(backupId, backupPath);
}
