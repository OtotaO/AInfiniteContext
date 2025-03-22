/**
 * Error handling utilities for InfiniteContext
 * 
 * This module provides a comprehensive error handling system for InfiniteContext,
 * including custom error types, error logging, and recovery mechanisms.
 */

import winston from 'winston';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Define custom error types
export class InfiniteContextError extends Error {
  public code: string;
  public details?: Record<string, any>;
  public recoverable: boolean;
  public timestamp: string;

  constructor(message: string, options: {
    code: string;
    details?: Record<string, any>;
    recoverable?: boolean;
    cause?: Error;
  }) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.details = options.details;
    this.recoverable = options.recoverable ?? false;
    this.timestamp = new Date().toISOString();
    
    // Set the cause if provided
    if (options.cause) {
      this.cause = options.cause;
    }
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Type for error options without code
type ErrorOptionsWithoutCode = Omit<{
  details?: Record<string, any>;
  recoverable?: boolean;
  cause?: Error;
}, 'code'>;

// Specific error types
export class StorageError extends InfiniteContextError {
  constructor(message: string, options: ErrorOptionsWithoutCode & { code?: string }) {
    super(message, { ...options, code: options.code || 'STORAGE_ERROR' });
  }
}

export class VectorStoreError extends InfiniteContextError {
  constructor(message: string, options: ErrorOptionsWithoutCode & { code?: string }) {
    super(message, { ...options, code: options.code || 'VECTOR_STORE_ERROR' });
  }
}

export class EmbeddingError extends InfiniteContextError {
  constructor(message: string, options: ErrorOptionsWithoutCode & { code?: string }) {
    super(message, { ...options, code: options.code || 'EMBEDDING_ERROR' });
  }
}

export class SummarizationError extends InfiniteContextError {
  constructor(message: string, options: ErrorOptionsWithoutCode & { code?: string }) {
    super(message, { ...options, code: options.code || 'SUMMARIZATION_ERROR' });
  }
}

export class ConfigurationError extends InfiniteContextError {
  constructor(message: string, options: ErrorOptionsWithoutCode & { code?: string }) {
    super(message, { ...options, code: options.code || 'CONFIGURATION_ERROR' });
  }
}

// Error codes
export const ErrorCodes = {
  // Storage errors
  STORAGE_PROVIDER_NOT_FOUND: 'STORAGE_PROVIDER_NOT_FOUND',
  STORAGE_PROVIDER_CONNECTION_FAILED: 'STORAGE_PROVIDER_CONNECTION_FAILED',
  STORAGE_PROVIDER_DISCONNECTED: 'STORAGE_PROVIDER_DISCONNECTED',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  STORAGE_DELETE_FAILED: 'STORAGE_DELETE_FAILED',
  
  // Vector store errors
  VECTOR_STORE_INITIALIZATION_FAILED: 'VECTOR_STORE_INITIALIZATION_FAILED',
  VECTOR_STORE_ADD_FAILED: 'VECTOR_STORE_ADD_FAILED',
  VECTOR_STORE_SEARCH_FAILED: 'VECTOR_STORE_SEARCH_FAILED',
  VECTOR_STORE_DIMENSION_MISMATCH: 'VECTOR_STORE_DIMENSION_MISMATCH',
  
  // Embedding errors
  EMBEDDING_GENERATION_FAILED: 'EMBEDDING_GENERATION_FAILED',
  EMBEDDING_MODEL_NOT_FOUND: 'EMBEDDING_MODEL_NOT_FOUND',
  EMBEDDING_API_ERROR: 'EMBEDDING_API_ERROR',
  
  // Summarization errors
  SUMMARIZATION_FAILED: 'SUMMARIZATION_FAILED',
  SUMMARIZATION_MODEL_NOT_FOUND: 'SUMMARIZATION_MODEL_NOT_FOUND',
  SUMMARIZATION_API_ERROR: 'SUMMARIZATION_API_ERROR',
  
  // Configuration errors
  CONFIGURATION_INVALID: 'CONFIGURATION_INVALID',
  CONFIGURATION_MISSING: 'CONFIGURATION_MISSING',
  
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  OPERATION_ABORTED: 'OPERATION_ABORTED',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
};

// Ensure log directory exists
const logDir = path.join(os.homedir(), '.infinite-context', 'logs');
try {
  if (!fs.existsSync(path.dirname(logDir))) {
    fs.mkdirSync(path.dirname(logDir), { recursive: true });
  }
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (error) {
  console.error('Failed to create log directory:', error);
}

// Create a logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'infinite-context' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Error handler class
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: Array<(error: InfiniteContextError) => void> = [];
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  /**
   * Handle an error
   * 
   * @param error - The error to handle
   * @param context - Additional context for the error
   * @returns True if the error was handled, false otherwise
   */
  public handleError(error: Error, context?: Record<string, any>): boolean {
    // Convert to InfiniteContextError if it's not already
    const icError = this.convertError(error, context);
    
    // Log the error
    this.logError(icError);
    
    // Notify listeners
    this.notifyListeners(icError);
    
    // Return whether the error is recoverable
    return icError.recoverable;
  }
  
  /**
   * Add an error listener
   * 
   * @param listener - The listener function
   */
  public addErrorListener(listener: (error: InfiniteContextError) => void): void {
    this.errorListeners.push(listener);
  }
  
  /**
   * Remove an error listener
   * 
   * @param listener - The listener function to remove
   * @returns True if the listener was removed, false otherwise
   */
  public removeErrorListener(listener: (error: InfiniteContextError) => void): boolean {
    const index = this.errorListeners.indexOf(listener);
    if (index >= 0) {
      this.errorListeners.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Convert an error to an InfiniteContextError
   * 
   * @param error - The error to convert
   * @param context - Additional context for the error
   * @returns The converted error
   */
  private convertError(error: Error, context?: Record<string, any>): InfiniteContextError {
    if (error instanceof InfiniteContextError) {
      // Add context if provided
      if (context) {
        error.details = { ...error.details, ...context };
      }
      return error;
    }
    
    // Create a new InfiniteContextError
    return new InfiniteContextError(error.message, {
      code: ErrorCodes.UNKNOWN_ERROR,
      details: {
        originalError: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        ...context,
      },
      recoverable: false,
      cause: error,
    });
  }
  
  /**
   * Log an error
   * 
   * @param error - The error to log
   */
  private logError(error: InfiniteContextError): void {
    logger.error({
      message: error.message,
      code: error.code,
      details: error.details,
      recoverable: error.recoverable,
      timestamp: error.timestamp,
      stack: error.stack,
    });
  }
  
  /**
   * Notify error listeners
   * 
   * @param error - The error to notify about
   */
  private notifyListeners(error: InfiniteContextError): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (listenerError) {
        logger.error('Error in error listener', {
          listenerError,
          originalError: error,
        });
      }
    }
  }
}

// Utility function to wrap async functions with error handling
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, any>
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorHandler = ErrorHandler.getInstance();
      const handled = errorHandler.handleError(error as Error, {
        functionName: fn.name,
        arguments: args,
        ...context,
      });
      
      if (handled) {
        // If the error is recoverable, return a default value
        return undefined as unknown as ReturnType<T>;
      }
      
      // Re-throw the error
      throw error;
    }
  };
}

// Export the singleton instance
export const errorHandler = ErrorHandler.getInstance();
