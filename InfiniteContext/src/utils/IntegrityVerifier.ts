/**
 * Data integrity verification utilities for InfiniteContext
 * 
 * This module provides utilities for verifying the integrity of stored data
 * to ensure it has not been corrupted.
 */

import crypto from 'crypto';
import { Chunk } from '../core/types.js';
import { errorHandler, StorageError, ErrorCodes } from './ErrorHandler.js';

/**
 * Integrity verification result
 */
export interface VerificationResult {
  isValid: boolean;
  errors: VerificationError[];
}

/**
 * Verification error
 */
export interface VerificationError {
  type: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Integrity verifier for stored data
 */
export class IntegrityVerifier {
  private static instance: IntegrityVerifier;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  public static getInstance(): IntegrityVerifier {
    if (!IntegrityVerifier.instance) {
      IntegrityVerifier.instance = new IntegrityVerifier();
    }
    return IntegrityVerifier.instance;
  }
  
  /**
   * Calculate a hash for a chunk
   * 
   * @param chunk - The chunk to hash
   * @returns The hash
   */
  public calculateChunkHash(chunk: Chunk): string {
    const hash = crypto.createHash('sha256');
    
    // Hash the content
    hash.update(chunk.content);
    
    // Hash the embedding
    hash.update(chunk.embedding.join(','));
    
    // Hash the metadata
    hash.update(JSON.stringify(chunk.metadata));
    
    // Hash the summaries
    hash.update(chunk.summaries.join('|'));
    
    return hash.digest('hex');
  }
  
  /**
   * Verify the integrity of a chunk
   * 
   * @param chunk - The chunk to verify
   * @param storedHash - The stored hash to compare against
   * @returns The verification result
   */
  public verifyChunk(chunk: Chunk, storedHash: string): VerificationResult {
    const errors: VerificationError[] = [];
    
    try {
      // Calculate the current hash
      const currentHash = this.calculateChunkHash(chunk);
      
      // Compare the hashes
      if (currentHash !== storedHash) {
        errors.push({
          type: 'HASH_MISMATCH',
          message: 'Chunk hash does not match stored hash',
          details: {
            chunkId: chunk.id,
            currentHash,
            storedHash,
          },
        });
      }
      
      // Verify the embedding
      if (!this.verifyEmbedding(chunk.embedding)) {
        errors.push({
          type: 'INVALID_EMBEDDING',
          message: 'Chunk embedding is invalid',
          details: {
            chunkId: chunk.id,
          },
        });
      }
      
      // Verify the metadata
      if (!this.verifyMetadata(chunk.metadata)) {
        errors.push({
          type: 'INVALID_METADATA',
          message: 'Chunk metadata is invalid',
          details: {
            chunkId: chunk.id,
          },
        });
      }
      
      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      const verificationError: VerificationError = {
        type: 'VERIFICATION_FAILED',
        message: `Failed to verify chunk: ${(error as Error).message}`,
        details: {
          chunkId: chunk.id,
          error,
        },
      };
      
      errorHandler.handleError(
        new StorageError(`Chunk verification failed: ${(error as Error).message}`, {
          code: ErrorCodes.STORAGE_READ_FAILED,
          details: {
            chunkId: chunk.id,
            error,
          },
          recoverable: true,
        })
      );
      
      return {
        isValid: false,
        errors: [verificationError],
      };
    }
  }
  
  /**
   * Verify the integrity of an embedding
   * 
   * @param embedding - The embedding to verify
   * @returns Whether the embedding is valid
   */
  private verifyEmbedding(embedding: number[]): boolean {
    // Check if the embedding is an array
    if (!Array.isArray(embedding)) {
      return false;
    }
    
    // Check if the embedding has at least one element
    if (embedding.length === 0) {
      return false;
    }
    
    // Check if all elements are numbers
    return embedding.every(value => typeof value === 'number' && !isNaN(value));
  }
  
  /**
   * Verify the integrity of metadata
   * 
   * @param metadata - The metadata to verify
   * @returns Whether the metadata is valid
   */
  private verifyMetadata(metadata: Record<string, any>): boolean {
    // Check if the metadata is an object
    if (typeof metadata !== 'object' || metadata === null) {
      return false;
    }
    
    // Check required fields
    if (!metadata.id || !metadata.timestamp || !metadata.domain) {
      return false;
    }
    
    // Check if the timestamp is a valid date
    try {
      const date = new Date(metadata.timestamp);
      if (isNaN(date.getTime())) {
        return false;
      }
    } catch {
      return false;
    }
    
    // Check if tags is an array
    if (metadata.tags && !Array.isArray(metadata.tags)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Repair a chunk if possible
   * 
   * @param chunk - The chunk to repair
   * @param verificationResult - The verification result
   * @returns The repaired chunk, or null if repair is not possible
   */
  public repairChunk(chunk: Chunk, verificationResult: VerificationResult): Chunk | null {
    if (verificationResult.isValid) {
      return chunk;
    }
    
    try {
      const repairedChunk = { ...chunk };
      let repaired = false;
      
      // Try to repair each error
      for (const error of verificationResult.errors) {
        switch (error.type) {
          case 'INVALID_METADATA':
            // Try to repair metadata
            if (this.repairMetadata(repairedChunk)) {
              repaired = true;
            }
            break;
            
          case 'INVALID_EMBEDDING':
            // Cannot repair embeddings, they need to be regenerated
            return null;
            
          default:
            // Cannot repair other errors
            break;
        }
      }
      
      return repaired ? repairedChunk : null;
    } catch (error) {
      errorHandler.handleError(
        new StorageError(`Chunk repair failed: ${(error as Error).message}`, {
          code: ErrorCodes.STORAGE_WRITE_FAILED,
          details: {
            chunkId: chunk.id,
            error,
          },
          recoverable: false,
        })
      );
      
      return null;
    }
  }
  
  /**
   * Repair chunk metadata if possible
   * 
   * @param chunk - The chunk to repair
   * @returns Whether the repair was successful
   */
  private repairMetadata(chunk: Chunk): boolean {
    try {
      // Ensure metadata is an object
      if (typeof chunk.metadata !== 'object' || chunk.metadata === null) {
        chunk.metadata = {
          id: chunk.id,
          timestamp: new Date().toISOString(),
          domain: 'unknown',
          source: 'repair',
          tags: [],
        };
        return true;
      }
      
      // Ensure required fields
      if (!chunk.metadata.id) {
        chunk.metadata.id = chunk.id;
      }
      
      if (!chunk.metadata.timestamp || isNaN(new Date(chunk.metadata.timestamp).getTime())) {
        chunk.metadata.timestamp = new Date().toISOString();
      }
      
      if (!chunk.metadata.domain) {
        chunk.metadata.domain = 'unknown';
      }
      
      if (!chunk.metadata.source) {
        chunk.metadata.source = 'repair';
      }
      
      // Ensure tags is an array
      if (!Array.isArray(chunk.metadata.tags)) {
        chunk.metadata.tags = [];
      }
      
      return true;
    } catch {
      return false;
    }
  }
}

// Export the singleton instance
export const integrityVerifier = IntegrityVerifier.getInstance();

/**
 * Utility function to calculate a hash for a chunk
 * 
 * @param chunk - The chunk to hash
 * @returns The hash
 */
export function calculateChunkHash(chunk: Chunk): string {
  return integrityVerifier.calculateChunkHash(chunk);
}

/**
 * Utility function to verify the integrity of a chunk
 * 
 * @param chunk - The chunk to verify
 * @param storedHash - The stored hash to compare against
 * @returns The verification result
 */
export function verifyChunk(chunk: Chunk, storedHash: string): VerificationResult {
  return integrityVerifier.verifyChunk(chunk, storedHash);
}

/**
 * Utility function to repair a chunk if possible
 * 
 * @param chunk - The chunk to repair
 * @param verificationResult - The verification result
 * @returns The repaired chunk, or null if repair is not possible
 */
export function repairChunk(chunk: Chunk, verificationResult: VerificationResult): Chunk | null {
  return integrityVerifier.repairChunk(chunk, verificationResult);
}
