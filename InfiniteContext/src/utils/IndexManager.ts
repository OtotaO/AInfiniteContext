/**
 * Index management utilities for InfiniteContext
 * 
 * This module provides utilities for managing vector indices
 * to optimize storage and retrieval performance.
 */

import fs from 'fs';
import path from 'path';
import { Chunk, Vector } from '../core/types.js';
import { errorHandler, VectorStoreError, ErrorCodes } from './ErrorHandler.js';
import { transactionManager, createOperation } from './TransactionManager.js';

/**
 * Index type
 */
export enum IndexType {
  FLAT = 'flat',
  HNSW = 'hnsw',
  IVF = 'ivf',
}

/**
 * Index parameters
 */
export interface IndexParams {
  type: IndexType;
  dimension: number;
  metric?: 'cosine' | 'euclidean' | 'dot';
  efConstruction?: number; // HNSW parameter
  M?: number; // HNSW parameter
  nlist?: number; // IVF parameter
  nprobe?: number; // IVF parameter
}

/**
 * Index statistics
 */
export interface IndexStats {
  type: IndexType;
  dimension: number;
  metric: string;
  size: number;
  memoryUsage: number;
  parameters: Record<string, any>;
}

/**
 * Index optimization options
 */
export interface OptimizationOptions {
  targetMemoryUsage?: number;
  maxIndexSize?: number;
  rebuildThreshold?: number;
}

/**
 * Index manager for vector index optimization
 */
export class IndexManager {
  private static instance: IndexManager;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  public static getInstance(): IndexManager {
    if (!IndexManager.instance) {
      IndexManager.instance = new IndexManager();
    }
    return IndexManager.instance;
  }
  
  /**
   * Get the optimal index parameters for a given dataset size and dimension
   * 
   * @param size - The number of vectors in the dataset
   * @param dimension - The dimension of the vectors
   * @param memoryBudget - The memory budget in bytes
   * @returns The optimal index parameters
   */
  public getOptimalIndexParams(size: number, dimension: number, memoryBudget?: number): IndexParams {
    // Default memory budget: 1GB
    const budget = memoryBudget || 1024 * 1024 * 1024;
    
    // Estimate memory usage per vector
    const bytesPerVector = dimension * 4; // 4 bytes per float
    
    // Estimate total memory usage for a flat index
    const flatMemoryUsage = size * bytesPerVector;
    
    // If the flat index fits within the memory budget, use it
    if (flatMemoryUsage <= budget) {
      return {
        type: IndexType.FLAT,
        dimension,
        metric: 'cosine',
      };
    }
    
    // For larger datasets, use HNSW
    if (size < 1000000) {
      // For medium-sized datasets, use HNSW with moderate parameters
      const efConstruction = Math.min(200, Math.max(40, Math.floor(size / 1000)));
      const M = Math.min(64, Math.max(16, Math.floor(Math.log2(size))));
      
      return {
        type: IndexType.HNSW,
        dimension,
        metric: 'cosine',
        efConstruction,
        M,
      };
    }
    
    // For very large datasets, use IVF
    const nlist = Math.min(8192, Math.max(256, Math.floor(Math.sqrt(size))));
    const nprobe = Math.min(256, Math.max(16, Math.floor(nlist / 8)));
    
    return {
      type: IndexType.IVF,
      dimension,
      metric: 'cosine',
      nlist,
      nprobe,
    };
  }
  
  /**
   * Estimate the memory usage of an index
   * 
   * @param params - The index parameters
   * @param size - The number of vectors in the index
   * @returns The estimated memory usage in bytes
   */
  public estimateMemoryUsage(params: IndexParams, size: number): number {
    const bytesPerVector = params.dimension * 4; // 4 bytes per float
    
    switch (params.type) {
      case IndexType.FLAT:
        // Flat index: just the vectors
        return size * bytesPerVector;
        
      case IndexType.HNSW:
        // HNSW index: vectors + graph structure
        const M = params.M || 16;
        const graphOverhead = size * M * 4; // 4 bytes per edge
        return size * bytesPerVector + graphOverhead;
        
      case IndexType.IVF:
        // IVF index: vectors + centroids + assignments
        const nlist = params.nlist || 256;
        const centroidsSize = nlist * params.dimension * 4;
        const assignmentsSize = size * 4; // 4 bytes per assignment
        return size * bytesPerVector + centroidsSize + assignmentsSize;
        
      default:
        throw new Error(`Unsupported index type: ${params.type}`);
    }
  }
  
  /**
   * Check if an index needs optimization
   * 
   * @param stats - The current index statistics
   * @param options - The optimization options
   * @returns Whether the index needs optimization
   */
  public needsOptimization(stats: IndexStats, options: OptimizationOptions = {}): boolean {
    // Check if the index is too large
    if (options.maxIndexSize && stats.size > options.maxIndexSize) {
      return true;
    }
    
    // Check if the index is using too much memory
    if (options.targetMemoryUsage && stats.memoryUsage > options.targetMemoryUsage) {
      return true;
    }
    
    // Check if the index has too many deleted vectors
    if (options.rebuildThreshold && stats.parameters.deletedCount > stats.size * options.rebuildThreshold) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Optimize an index
   * 
   * @param chunks - The chunks in the index
   * @param currentParams - The current index parameters
   * @param options - The optimization options
   * @returns The optimized index parameters
   */
  public optimizeIndex(chunks: Chunk[], currentParams: IndexParams, options: OptimizationOptions = {}): IndexParams {
    try {
      // Get the current index size
      const size = chunks.length;
      
      // If the index is empty, return the current parameters
      if (size === 0) {
        return currentParams;
      }
      
      // Get the dimension from the first chunk
      const dimension = chunks[0].embedding.length;
      
      // Estimate the current memory usage
      const currentMemoryUsage = this.estimateMemoryUsage(currentParams, size);
      
      // Check if optimization is needed
      const currentStats: IndexStats = {
        type: currentParams.type,
        dimension,
        metric: currentParams.metric || 'cosine',
        size,
        memoryUsage: currentMemoryUsage,
        parameters: {
          ...currentParams,
          deletedCount: 0, // Placeholder, would be provided by the actual index
        },
      };
      
      if (!this.needsOptimization(currentStats, options)) {
        return currentParams;
      }
      
      // Get the optimal index parameters
      const optimalParams = this.getOptimalIndexParams(size, dimension, options.targetMemoryUsage);
      
      return optimalParams;
    } catch (error) {
      errorHandler.handleError(
        new VectorStoreError(`Index optimization failed: ${(error as Error).message}`, {
          code: ErrorCodes.VECTOR_STORE_INITIALIZATION_FAILED,
          details: {
            error,
          },
          recoverable: true,
        })
      );
      
      // Return the current parameters if optimization fails
      return currentParams;
    }
  }
  
  /**
   * Rebuild an index
   * 
   * @param chunks - The chunks to include in the index
   * @param params - The index parameters
   * @param outputPath - The path to save the index
   * @returns Whether the rebuild was successful
   */
  public async rebuildIndex(chunks: Chunk[], params: IndexParams, outputPath: string): Promise<boolean> {
    try {
      // Create output directory if it doesn't exist
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        await fs.promises.mkdir(outputDir, { recursive: true });
      }
      
      // TODO: Implement actual index rebuilding
      // This would require integration with a vector index library
      
      console.log(`Rebuilding index with ${chunks.length} chunks and parameters:`, params);
      console.log(`Index will be saved to: ${outputPath}`);
      
      // For now, just return true
      return true;
    } catch (error) {
      errorHandler.handleError(
        new VectorStoreError(`Index rebuild failed: ${(error as Error).message}`, {
          code: ErrorCodes.VECTOR_STORE_INITIALIZATION_FAILED,
          details: {
            outputPath,
            error,
          },
          recoverable: false,
        })
      );
      
      return false;
    }
  }
  
  /**
   * Merge multiple indices
   * 
   * @param indexPaths - The paths to the indices to merge
   * @param outputPath - The path to save the merged index
   * @param params - The index parameters for the merged index
   * @returns Whether the merge was successful
   */
  public async mergeIndices(indexPaths: string[], outputPath: string, params: IndexParams): Promise<boolean> {
    try {
      // Create output directory if it doesn't exist
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        await fs.promises.mkdir(outputDir, { recursive: true });
      }
      
      // Check if all index files exist
      for (const indexPath of indexPaths) {
        if (!fs.existsSync(indexPath)) {
          throw new Error(`Index file not found: ${indexPath}`);
        }
      }
      
      // TODO: Implement actual index merging
      // This would require integration with a vector index library
      
      console.log(`Merging ${indexPaths.length} indices with parameters:`, params);
      console.log(`Merged index will be saved to: ${outputPath}`);
      
      // For now, just return true
      return true;
    } catch (error) {
      errorHandler.handleError(
        new VectorStoreError(`Index merge failed: ${(error as Error).message}`, {
          code: ErrorCodes.VECTOR_STORE_INITIALIZATION_FAILED,
          details: {
            indexPaths,
            outputPath,
            error,
          },
          recoverable: false,
        })
      );
      
      return false;
    }
  }
  
  /**
   * Split an index into multiple shards
   * 
   * @param indexPath - The path to the index to split
   * @param outputDir - The directory to save the shards
   * @param numShards - The number of shards to create
   * @param params - The index parameters for the shards
   * @returns Whether the split was successful
   */
  public async splitIndex(indexPath: string, outputDir: string, numShards: number, params: IndexParams): Promise<boolean> {
    try {
      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        await fs.promises.mkdir(outputDir, { recursive: true });
      }
      
      // Check if the index file exists
      if (!fs.existsSync(indexPath)) {
        throw new Error(`Index file not found: ${indexPath}`);
      }
      
      // TODO: Implement actual index splitting
      // This would require integration with a vector index library
      
      console.log(`Splitting index into ${numShards} shards with parameters:`, params);
      console.log(`Shards will be saved to: ${outputDir}`);
      
      // For now, just return true
      return true;
    } catch (error) {
      errorHandler.handleError(
        new VectorStoreError(`Index split failed: ${(error as Error).message}`, {
          code: ErrorCodes.VECTOR_STORE_INITIALIZATION_FAILED,
          details: {
            indexPath,
            outputDir,
            numShards,
            error,
          },
          recoverable: false,
        })
      );
      
      return false;
    }
  }
}

// Export the singleton instance
export const indexManager = IndexManager.getInstance();

/**
 * Utility function to get the optimal index parameters
 * 
 * @param size - The number of vectors in the dataset
 * @param dimension - The dimension of the vectors
 * @param memoryBudget - The memory budget in bytes
 * @returns The optimal index parameters
 */
export function getOptimalIndexParams(size: number, dimension: number, memoryBudget?: number): IndexParams {
  return indexManager.getOptimalIndexParams(size, dimension, memoryBudget);
}

/**
 * Utility function to estimate the memory usage of an index
 * 
 * @param params - The index parameters
 * @param size - The number of vectors in the index
 * @returns The estimated memory usage in bytes
 */
export function estimateMemoryUsage(params: IndexParams, size: number): number {
  return indexManager.estimateMemoryUsage(params, size);
}

/**
 * Utility function to check if an index needs optimization
 * 
 * @param stats - The current index statistics
 * @param options - The optimization options
 * @returns Whether the index needs optimization
 */
export function needsOptimization(stats: IndexStats, options: OptimizationOptions = {}): boolean {
  return indexManager.needsOptimization(stats, options);
}

/**
 * Utility function to optimize an index
 * 
 * @param chunks - The chunks in the index
 * @param currentParams - The current index parameters
 * @param options - The optimization options
 * @returns The optimized index parameters
 */
export function optimizeIndex(chunks: Chunk[], currentParams: IndexParams, options: OptimizationOptions = {}): IndexParams {
  return indexManager.optimizeIndex(chunks, currentParams, options);
}

/**
 * Utility function to rebuild an index
 * 
 * @param chunks - The chunks to include in the index
 * @param params - The index parameters
 * @param outputPath - The path to save the index
 * @returns Whether the rebuild was successful
 */
export function rebuildIndex(chunks: Chunk[], params: IndexParams, outputPath: string): Promise<boolean> {
  return indexManager.rebuildIndex(chunks, params, outputPath);
}

/**
 * Utility function to merge multiple indices
 * 
 * @param indexPaths - The paths to the indices to merge
 * @param outputPath - The path to save the merged index
 * @param params - The index parameters for the merged index
 * @returns Whether the merge was successful
 */
export function mergeIndices(indexPaths: string[], outputPath: string, params: IndexParams): Promise<boolean> {
  return indexManager.mergeIndices(indexPaths, outputPath, params);
}

/**
 * Utility function to split an index into multiple shards
 * 
 * @param indexPath - The path to the index to split
 * @param outputDir - The directory to save the shards
 * @param numShards - The number of shards to create
 * @param params - The index parameters for the shards
 * @returns Whether the split was successful
 */
export function splitIndex(indexPath: string, outputDir: string, numShards: number, params: IndexParams): Promise<boolean> {
  return indexManager.splitIndex(indexPath, outputDir, numShards, params);
}
