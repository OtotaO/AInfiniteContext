import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ChunkLocation, StorageQuota, StorageTier } from '../core/types.js';
import { StorageProvider } from './StorageProvider.js';

/**
 * Storage provider that uses the local filesystem.
 * 
 * This provider stores data in files on the local filesystem. It's the most basic
 * storage provider and is always available without authentication.
 */
export class LocalStorageProvider implements StorageProvider {
  private id: string;
  private name: string;
  private basePath: string;
  private connected: boolean = false;
  private maxSizeBytes: number;
  private currentSizeBytes: number = 0;

  /**
   * Create a new LocalStorageProvider
   * 
   * @param id - The unique ID of this provider
   * @param basePath - The base path to store data in
   * @param maxSizeBytes - The maximum size in bytes this provider can store
   */
  constructor(
    id: string = 'local',
    name: string = 'Local Filesystem',
    basePath: string,
    maxSizeBytes: number = 5 * 1024 * 1024 * 1024 // 5 GB
  ) {
    this.id = id;
    this.name = name;
    this.basePath = basePath;
    this.maxSizeBytes = maxSizeBytes;
  }

  /**
   * Get the unique ID of this storage provider
   */
  public getId(): string {
    return this.id;
  }

  /**
   * Get the name of this storage provider
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Get the storage tier of this provider
   */
  public getTier(): StorageTier {
    return StorageTier.LOCAL;
  }

  /**
   * Check if this provider is connected and available
   */
  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  /**
   * Connect to the storage provider
   * 
   * For the local filesystem, this just ensures the base directory exists
   */
  public async connect(): Promise<boolean> {
    try {
      // Ensure base directory exists
      await fs.mkdir(this.basePath, { recursive: true });
      
      // Calculate current size (this could be slow for large directories)
      this.currentSizeBytes = await this.calculateDirectorySize(this.basePath);
      
      this.connected = true;
      return true;
    } catch (error) {
      console.error(`Failed to connect to local storage provider: ${error}`);
      return false;
    }
  }

  /**
   * Disconnect from the storage provider
   */
  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Store data in the provider
   * 
   * @param data - The data to store
   * @param metadata - Optional metadata to associate with the data
   * @returns A location that can be used to retrieve the data
   */
  public async store(data: Buffer | string, metadata?: Record<string, unknown>): Promise<ChunkLocation> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }

    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    
    // Check if there's enough space
    if (this.currentSizeBytes + dataBuffer.length > this.maxSizeBytes) {
      throw new Error('Not enough space available');
    }
    
    // Generate a unique filename
    const key = uuidv4();
    const filePath = join(this.basePath, key);
    
    // Create directory structure if needed
    await fs.mkdir(dirname(filePath), { recursive: true });
    
    // Write data
    await fs.writeFile(filePath, dataBuffer);
    
    // Store metadata if provided
    if (metadata) {
      await fs.writeFile(`${filePath}.meta`, JSON.stringify(metadata));
    }
    
    // Update current size
    this.currentSizeBytes += dataBuffer.length;
    
    return {
      providerId: this.id,
      key
    };
  }

  /**
   * Retrieve data from the provider
   * 
   * @param location - The location to retrieve data from
   * @returns The retrieved data
   */
  public async retrieve(location: ChunkLocation): Promise<Buffer> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    if (location.providerId !== this.id) {
      throw new Error(`Location provider ID ${location.providerId} does not match this provider's ID ${this.id}`);
    }
    
    const filePath = join(this.basePath, location.key);
    
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new Error(`Failed to retrieve data: ${error}`);
    }
  }

  /**
   * Check if data exists at the given location
   * 
   * @param location - The location to check
   * @returns True if data exists, false otherwise
   */
  public async exists(location: ChunkLocation): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    if (location.providerId !== this.id) {
      return false;
    }
    
    const filePath = join(this.basePath, location.key);
    
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete data from the provider
   * 
   * @param location - The location to delete data from
   * @returns True if data was deleted, false otherwise
   */
  public async delete(location: ChunkLocation): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    if (location.providerId !== this.id) {
      return false;
    }
    
    const filePath = join(this.basePath, location.key);
    const metaPath = `${filePath}.meta`;
    
    try {
      // Get file size before deleting
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // Delete data file
      await fs.unlink(filePath);
      
      // Delete metadata file if it exists
      try {
        await fs.access(metaPath);
        await fs.unlink(metaPath);
      } catch {
        // Metadata file doesn't exist, that's fine
      }
      
      // Update current size
      this.currentSizeBytes -= fileSize;
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current storage quota and usage
   * 
   * @returns The current storage quota
   */
  public async getQuota(): Promise<StorageQuota> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    // Recalculate current size for accuracy
    this.currentSizeBytes = await this.calculateDirectorySize(this.basePath);
    
    return {
      used: this.currentSizeBytes,
      total: this.maxSizeBytes,
      available: this.maxSizeBytes - this.currentSizeBytes
    };
  }

  /**
   * Calculate the total size of all files in a directory
   * 
   * @param dirPath - The directory path
   * @returns The total size in bytes
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    try {
      let size = 0;
      
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = join(dirPath, file.name);
        
        if (file.isDirectory()) {
          size += await this.calculateDirectorySize(filePath);
        } else {
          const stats = await fs.stat(filePath);
          size += stats.size;
        }
      }
      
      return size;
    } catch {
      return 0;
    }
  }
}
