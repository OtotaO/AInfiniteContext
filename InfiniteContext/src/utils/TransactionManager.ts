/**
 * Transaction management utilities for InfiniteContext
 * 
 * This module provides transaction management to ensure atomic operations
 * and prevent data corruption in case of failures.
 */

import { errorHandler, StorageError, ErrorCodes } from './ErrorHandler.js';

// Transaction status
export enum TransactionStatus {
  PENDING = 'pending',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
}

// Transaction operation
export interface TransactionOperation<T = any> {
  execute: () => Promise<T>;
  rollback: () => Promise<void>;
  description: string;
}

// Transaction result
export interface TransactionResult<T = any> {
  status: TransactionStatus;
  results: T[];
  error?: Error;
}

/**
 * Transaction manager for atomic operations
 */
export class TransactionManager {
  private static instance: TransactionManager;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  public static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }
  
  /**
   * Execute a transaction with multiple operations
   * 
   * @param operations - The operations to execute
   * @returns The transaction result
   */
  public async executeTransaction<T = any>(operations: TransactionOperation<T>[]): Promise<TransactionResult<T>> {
    const results: T[] = [];
    const executedOperations: TransactionOperation<T>[] = [];
    
    try {
      // Execute each operation
      for (const operation of operations) {
        const result = await operation.execute();
        results.push(result);
        executedOperations.push(operation);
      }
      
      // All operations succeeded, transaction is committed
      return {
        status: TransactionStatus.COMMITTED,
        results,
      };
    } catch (error) {
      // An operation failed, roll back all executed operations
      console.error(`Transaction failed: ${(error as Error).message}`);
      
      try {
        // Roll back in reverse order
        for (let i = executedOperations.length - 1; i >= 0; i--) {
          const operation = executedOperations[i];
          try {
            await operation.rollback();
          } catch (rollbackError) {
            console.error(`Failed to roll back operation "${operation.description}": ${(rollbackError as Error).message}`);
          }
        }
        
        return {
          status: TransactionStatus.ROLLED_BACK,
          results,
          error: error as Error,
        };
      } catch (rollbackError) {
        // Rollback failed
        const finalError = new StorageError(
          `Transaction rollback failed: ${(rollbackError as Error).message}`,
          {
            code: ErrorCodes.STORAGE_WRITE_FAILED,
            details: {
              originalError: error,
              rollbackError,
            },
            recoverable: false,
          }
        );
        
        errorHandler.handleError(finalError);
        
        return {
          status: TransactionStatus.ROLLED_BACK,
          results,
          error: finalError,
        };
      }
    }
  }
  
  /**
   * Create a transaction operation
   * 
   * @param description - Description of the operation
   * @param execute - Function to execute the operation
   * @param rollback - Function to roll back the operation
   * @returns The transaction operation
   */
  public createOperation<T = any>(
    description: string,
    execute: () => Promise<T>,
    rollback: () => Promise<void>
  ): TransactionOperation<T> {
    return {
      execute,
      rollback,
      description,
    };
  }
}

// Export the singleton instance
export const transactionManager = TransactionManager.getInstance();

/**
 * Utility function to create a transaction operation
 * 
 * @param description - Description of the operation
 * @param execute - Function to execute the operation
 * @param rollback - Function to roll back the operation
 * @returns The transaction operation
 */
export function createOperation<T = any>(
  description: string,
  execute: () => Promise<T>,
  rollback: () => Promise<void>
): TransactionOperation<T> {
  return transactionManager.createOperation(description, execute, rollback);
}

/**
 * Utility function to execute a transaction with multiple operations
 * 
 * @param operations - The operations to execute
 * @returns The transaction result
 */
export async function executeTransaction<T = any>(
  operations: TransactionOperation<T>[]
): Promise<TransactionResult<T>> {
  return transactionManager.executeTransaction(operations);
}
