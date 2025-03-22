/**
 * InfiniteContext: An extensible memory architecture for AI systems
 * 
 * This library provides a framework for storing, organizing, and retrieving
 * large amounts of contextual information across various storage tiers.
 */

// Core components
export { MemoryManager } from './core/MemoryManager.js';
export { Bucket } from './core/Bucket.js';
export { VectorStore } from './core/VectorStore.js';
export { MemoryMonitor, type MemoryAlert } from './core/MemoryMonitor.js';
export * from './core/types.js';

// Storage providers
export { StorageProvider } from './providers/StorageProvider.js';
export { LocalStorageProvider } from './providers/LocalStorageProvider.js';
export { GoogleDriveProvider } from './providers/GoogleDriveProvider.js';

// Summarization
export { SummarizationEngine } from './summarization/SummarizationEngine.js';

// Utilities
export * from './utils/ErrorHandler.js';
export * from './utils/TransactionManager.js';
export * from './utils/IntegrityVerifier.js';
export * from './utils/BackupManager.js';
export * from './utils/DataPortability.js';
export * from './utils/IndexManager.js';

// Re-export OpenAI for convenience
import { OpenAI } from 'openai';
export { OpenAI };

// Main class to simplify initialization and configuration
import path from 'path';
import os from 'os';
import { MemoryManager } from './core/MemoryManager.js';
import { SummarizationEngine } from './summarization/SummarizationEngine.js';
import { GoogleDriveProvider } from './providers/GoogleDriveProvider.js';
import { Chunk, ChunkLocation, Metadata, StorageTier, Vector } from './core/types.js';

/**
 * Main InfiniteContext class that provides a simplified API for using the system
 */
export class InfiniteContext {
  private memoryManager: MemoryManager;
  private summarizationEngine: SummarizationEngine;
  private embeddingModel?: any;
  private llmModel?: any;

  /**
   * Create a new InfiniteContext instance
   * 
   * @param options - Configuration options
   */
  constructor(options: {
    basePath?: string;
    openai?: OpenAI;
    embeddingModel?: string;
    llmModel?: string;
    googleDriveCredentials?: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      refreshToken: string;
    };
  } = {}) {
    const basePath = options.basePath || path.join(os.homedir(), '.infinite-context');
    
    // Set up the embedding function if OpenAI is provided
    let embeddingFunction: ((text: string) => Promise<Vector>) | undefined;
    
    if (options.openai) {
      this.embeddingModel = options.embeddingModel || 'text-embedding-3-small';
      this.llmModel = options.llmModel || 'gpt-3.5-turbo';
      
      embeddingFunction = async (text: string): Promise<Vector> => {
        const response = await options.openai!.embeddings.create({
          model: this.embeddingModel,
          input: text,
        });
        
        return response.data[0].embedding;
      };
    }
    
    // Create the memory manager
    this.memoryManager = new MemoryManager({
      basePath,
      embeddingFunction
    });
    
    // Create the summarization engine
    this.summarizationEngine = new SummarizationEngine(options.openai);
  }

  /**
   * Initialize the system
   * 
   * @param options - Initialization options
   */
  public async initialize(options: {
    addGoogleDrive?: boolean;
    googleDriveCredentials?: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      refreshToken: string;
    };
    enableMemoryMonitoring?: boolean;
    memoryMonitoringConfig?: Partial<{
      bucketSizeThresholdMB: number;
      providerCapacityThresholdPercent: number;
      domainGrowthThresholdPercent: number;
      monitoringIntervalMs: number;
    }>;
  } = {}): Promise<void> {
    // Initialize the memory manager
    await this.memoryManager.initialize();
    
    // Add Google Drive provider if requested
    if (options.addGoogleDrive && options.googleDriveCredentials) {
      const googleDriveProvider = new GoogleDriveProvider(
        'gdrive',
        'Google Drive',
        options.googleDriveCredentials
      );
      
      await googleDriveProvider.connect();
      this.memoryManager.addStorageProvider(googleDriveProvider);
    }
    
    // Start memory monitoring if requested
    if (options.enableMemoryMonitoring) {
      this.memoryManager.startMemoryMonitoring();
      
      // Add default alert handler that logs to console
      this.memoryManager.addAlertHandler((alert) => {
        console.log(`[InfiniteContext] Memory Alert: ${alert.message}`);
        console.log(`Details: ${JSON.stringify(alert.details)}`);
      });
    }
  }

  /**
   * Store content in the system
   * 
   * @param content - The content to store
   * @param options - Storage options
   * @returns The ID of the created chunk
   */
  public async storeContent(
    content: string,
    options: {
      bucketName?: string;
      bucketDomain?: string;
      metadata?: Partial<Omit<Metadata, 'id' | 'timestamp'>>;
      summarize?: boolean;
      preferredTier?: StorageTier;
    } = {}
  ): Promise<string> {
    const bucketName = options.bucketName || 'default';
    const bucketDomain = options.bucketDomain || 'general';
    const metadata = options.metadata || {};
    const summarize = options.summarize !== false;
    const preferredTier = options.preferredTier || StorageTier.LOCAL;
    
    // Find or create the bucket
    const buckets = this.memoryManager.getBuckets();
    let bucket = Array.from(buckets.values())
      .find(b => b.getName() === bucketName && b.getDomain() === bucketDomain);
    
    if (!bucket) {
      bucket = this.memoryManager.createBucket({
        name: bucketName,
        domain: bucketDomain,
        description: `Automatically created bucket for ${bucketName} (${bucketDomain})`,
      });
    }
    
    // Create and store the chunk
    const chunk = await this.memoryManager.createChunk(content, {
      domain: bucketDomain,
      source: 'user-input',
      tags: [],
      ...metadata,
    }, summarize);
    
    // Add the chunk to the bucket
    bucket.addChunk(chunk);
    
    // Store the chunk in the appropriate storage provider
    await this.memoryManager.storeChunk(chunk, preferredTier);
    
    return chunk.id;
  }

  /**
   * Retrieve content from the system based on a query
   * 
   * @param query - The query to search for
   * @param options - Retrieval options
   * @returns Matching chunks with their relevance scores
   */
  public async retrieveContent(
    query: string,
    options: {
      bucketName?: string;
      bucketDomain?: string;
      maxResults?: number;
      minScore?: number;
    } = {}
  ): Promise<Array<{ chunk: Chunk, score: number }>> {
    const bucketName = options.bucketName;
    const bucketDomain = options.bucketDomain;
    const maxResults = options.maxResults || 10;
    const minScore = options.minScore || 0.7;
    
    // Find relevant buckets
    let searchResults: Array<{ chunk: Chunk, score: number }> = [];
    
    if (bucketName && bucketDomain) {
      // Search in the specific bucket
      const buckets = this.memoryManager.getBuckets();
      const bucket = Array.from(buckets.values())
        .find(b => b.getName() === bucketName && b.getDomain() === bucketDomain);
      
      if (bucket) {
        const queryVector = await this.getEmbedding(query);
        searchResults = bucket.search(queryVector, maxResults, true);
      }
    } else {
      // Find the most relevant buckets
      const relevantBuckets = await this.memoryManager.findRelevantBuckets(query, 3);
      
      // Search in each relevant bucket
      for (const { bucket } of relevantBuckets) {
        const queryVector = await this.getEmbedding(query);
        const results = bucket.search(queryVector, maxResults, true);
        searchResults.push(...results);
      }
      
      // Sort and limit the results
      searchResults.sort((a, b) => b.score - a.score);
      searchResults = searchResults.slice(0, maxResults);
    }
    
    // Filter by minimum score
    searchResults = searchResults.filter(result => result.score >= minScore);
    
    return searchResults;
  }

  /**
   * Summarize a piece of text
   * 
   * @param text - The text to summarize
   * @param options - Summarization options
   * @returns The generated summaries
   */
  public async summarize(
    text: string,
    options: {
      levels?: number;
    } = {}
  ): Promise<string[]> {
    const levels = options.levels || 1;
    
    const summaries = await this.summarizationEngine.summarize(text, levels);
    
    return summaries.map(summary => summary.content);
  }

  /**
   * Get memory usage statistics
   * 
   * @returns Memory usage statistics
   */
  public async getMemoryStats(): Promise<any> {
    return this.memoryManager.getMemoryStats();
  }

  /**
   * Get current memory alerts
   * 
   * @param includeAcknowledged - Whether to include acknowledged alerts
   * @returns Array of memory alerts
   */
  public getMemoryAlerts(includeAcknowledged: boolean = false): any[] {
    return this.memoryManager.getMemoryAlerts(includeAcknowledged);
  }

  /**
   * Acknowledge a memory alert
   * 
   * @param alertId - The ID of the alert to acknowledge
   * @returns True if the alert was found and acknowledged, false otherwise
   */
  public acknowledgeMemoryAlert(alertId: string): boolean {
    return this.memoryManager.acknowledgeMemoryAlert(alertId);
  }

  /**
   * Add a memory alert handler
   * 
   * @param handler - The handler function to add
   */
  public addMemoryAlertHandler(handler: (alert: any) => void): void {
    this.memoryManager.addAlertHandler(handler);
  }

  /**
   * Create a backup of the system
   * 
   * @param options - Backup options
   * @returns The backup metadata
   */
  public async createBackup(options: {
    backupPath?: string;
    includeVectorStores?: boolean;
    includeBuckets?: string[];
    excludeBuckets?: string[];
    maxBackups?: number;
  } = {}): Promise<any> {
    const { createBackup } = await import('./utils/BackupManager.js');
    
    return createBackup({
      basePath: this.memoryManager['basePath'],
      ...options,
    });
  }

  /**
   * Recover from a backup
   * 
   * @param options - Recovery options
   * @returns Whether the recovery was successful
   */
  public async recoverFromBackup(options: {
    backupId?: string;
    backupPath?: string;
    targetPath?: string;
    includeBuckets?: string[];
    excludeBuckets?: string[];
    overwriteExisting?: boolean;
  } = {}): Promise<boolean> {
    const { recoverFromBackup } = await import('./utils/BackupManager.js');
    
    return recoverFromBackup({
      targetPath: this.memoryManager['basePath'],
      ...options,
    });
  }

  /**
   * List available backups
   * 
   * @param backupPath - The path to the backups directory
   * @returns The list of backup metadata
   */
  public async listBackups(backupPath?: string): Promise<any[]> {
    const { listBackups } = await import('./utils/BackupManager.js');
    
    return listBackups(backupPath);
  }

  /**
   * Export chunks to a file
   * 
   * @param chunks - The chunks to export
   * @param options - Export options
   * @returns The export result
   */
  public async exportChunks(chunks: Chunk[], options: {
    format?: 'json' | 'jsonl' | 'csv';
    outputPath: string;
    compress?: boolean;
    includeEmbeddings?: boolean;
    includeSummaries?: boolean;
  }): Promise<any> {
    const { exportChunks, ExportFormat } = await import('./utils/DataPortability.js');
    
    // Create a new options object without the format property
    const { format: formatStr, ...restOptions } = options;
    
    // Convert the format string to the enum value
    let formatEnum: typeof ExportFormat[keyof typeof ExportFormat] | undefined;
    if (formatStr === 'json') formatEnum = ExportFormat.JSON;
    else if (formatStr === 'jsonl') formatEnum = ExportFormat.JSONL;
    else if (formatStr === 'csv') formatEnum = ExportFormat.CSV;
    
    return exportChunks(chunks, {
      ...restOptions,
      format: formatEnum,
    });
  }

  /**
   * Import chunks from a file
   * 
   * @param options - Import options
   * @returns The import result
   */
  public async importChunks(options: {
    inputPath: string;
    bucketName?: string;
    bucketDomain?: string;
    decompress?: boolean;
    generateEmbeddings?: boolean;
    generateSummaries?: boolean;
  }): Promise<any> {
    const { importChunks } = await import('./utils/DataPortability.js');
    
    return importChunks(options);
  }

  /**
   * Verify the integrity of a chunk
   * 
   * @param chunk - The chunk to verify
   * @param storedHash - The stored hash to compare against
   * @returns The verification result
   */
  public async verifyChunkIntegrity(chunk: Chunk, storedHash: string): Promise<any> {
    const { verifyChunk } = await import('./utils/IntegrityVerifier.js');
    
    return verifyChunk(chunk, storedHash);
  }

  /**
   * Repair a chunk if possible
   * 
   * @param chunk - The chunk to repair
   * @param verificationResult - The verification result
   * @returns The repaired chunk, or null if repair is not possible
   */
  public async repairChunk(chunk: Chunk, verificationResult: any): Promise<Chunk | null> {
    const { repairChunk } = await import('./utils/IntegrityVerifier.js');
    
    return repairChunk(chunk, verificationResult);
  }

  /**
   * Optimize a vector index
   * 
   * @param chunks - The chunks in the index
   * @param currentParams - The current index parameters
   * @param options - The optimization options
   * @returns The optimized index parameters
   */
  public async optimizeIndex(chunks: Chunk[], currentParams: any, options: {
    targetMemoryUsage?: number;
    maxIndexSize?: number;
    rebuildThreshold?: number;
  } = {}): Promise<any> {
    const { optimizeIndex } = await import('./utils/IndexManager.js');
    
    return optimizeIndex(chunks, currentParams, options);
  }

  /**
   * Rebuild a vector index
   * 
   * @param chunks - The chunks to include in the index
   * @param params - The index parameters
   * @param outputPath - The path to save the index
   * @returns Whether the rebuild was successful
   */
  public async rebuildIndex(chunks: Chunk[], params: any, outputPath: string): Promise<boolean> {
    const { rebuildIndex } = await import('./utils/IndexManager.js');
    
    return rebuildIndex(chunks, params, outputPath);
  }

  /**
   * Estimate the memory usage of an index
   * 
   * @param params - The index parameters
   * @param size - The number of vectors in the index
   * @returns The estimated memory usage in bytes
   */
  public async estimateIndexMemoryUsage(params: any, size: number): Promise<number> {
    const { estimateMemoryUsage } = await import('./utils/IndexManager.js');
    
    return estimateMemoryUsage(params, size);
  }

  /**
   * Get the optimal index parameters for a given dataset size and dimension
   * 
   * @param size - The number of vectors in the dataset
   * @param dimension - The dimension of the vectors
   * @param memoryBudget - The memory budget in bytes
   * @returns The optimal index parameters
   */
  public async getOptimalIndexParams(size: number, dimension: number, memoryBudget?: number): Promise<any> {
    const { getOptimalIndexParams } = await import('./utils/IndexManager.js');
    
    return getOptimalIndexParams(size, dimension, memoryBudget);
  }

  /**
   * Get the embedding for a piece of text
   * 
   * @param text - The text to embed
   * @returns The embedding vector
   */
  private async getEmbedding(text: string): Promise<Vector> {
    if (!this.memoryManager['embeddingFunction']) {
      throw new Error('No embedding function available');
    }
    
    return this.memoryManager['embeddingFunction'](text);
  }
}
