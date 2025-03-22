/**
 * Data portability utilities for InfiniteContext
 * 
 * This module provides utilities for exporting and importing data
 * to enable cross-platform compatibility and data migration.
 */

import fs from 'fs';
import path from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';
import { Chunk, ChunkSummary } from '../core/types.js';
import { errorHandler, StorageError, ErrorCodes } from './ErrorHandler.js';
import { transactionManager, createOperation } from './TransactionManager.js';
import { calculateChunkHash } from './IntegrityVerifier.js';

/**
 * Export format
 */
export enum ExportFormat {
  JSON = 'json',
  JSONL = 'jsonl',
  CSV = 'csv',
}

/**
 * Export options
 */
export interface ExportOptions {
  format?: ExportFormat;
  outputPath: string;
  bucketName?: string;
  bucketDomain?: string;
  compress?: boolean;
  includeEmbeddings?: boolean;
  includeSummaries?: boolean;
  filter?: (chunk: Chunk) => boolean;
}

/**
 * Import options
 */
export interface ImportOptions {
  inputPath: string;
  bucketName?: string;
  bucketDomain?: string;
  decompress?: boolean;
  generateEmbeddings?: boolean;
  generateSummaries?: boolean;
  filter?: (chunk: Chunk) => boolean;
  onProgress?: (progress: ImportProgress) => void;
}

/**
 * Import progress
 */
export interface ImportProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

/**
 * Export result
 */
export interface ExportResult {
  path: string;
  format: ExportFormat;
  count: number;
  size: number;
  compressed: boolean;
}

/**
 * Import result
 */
export interface ImportResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Error[];
}

/**
 * Data portability manager for exporting and importing data
 */
export class DataPortabilityManager {
  private static instance: DataPortabilityManager;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  public static getInstance(): DataPortabilityManager {
    if (!DataPortabilityManager.instance) {
      DataPortabilityManager.instance = new DataPortabilityManager();
    }
    return DataPortabilityManager.instance;
  }
  
  /**
   * Export chunks to a file
   * 
   * @param chunks - The chunks to export
   * @param options - The export options
   * @returns The export result
   */
  public async exportChunks(chunks: Chunk[], options: ExportOptions): Promise<ExportResult> {
    try {
      // Create output directory if it doesn't exist
      const outputDir = path.dirname(options.outputPath);
      if (!fs.existsSync(outputDir)) {
        await fs.promises.mkdir(outputDir, { recursive: true });
      }
      
      // Filter chunks if a filter is provided
      const filteredChunks = options.filter ? chunks.filter(options.filter) : chunks;
      
      // Process chunks for export
      const processedChunks = filteredChunks.map(chunk => {
        const processedChunk = { ...chunk };
        
        // Remove embeddings if not included
        if (!options.includeEmbeddings) {
          processedChunk.embedding = [];
        }
        
        // Remove summaries if not included
        if (!options.includeSummaries) {
          processedChunk.summaries = [];
        }
        
        // Add hash for integrity verification
        (processedChunk.metadata as any).hash = calculateChunkHash(chunk);
        
        return processedChunk;
      });
      
      // Export chunks based on format
      let outputPath = options.outputPath;
      let size = 0;
      
      if (options.compress) {
        outputPath = `${outputPath}.gz`;
      }
      
      switch (options.format || ExportFormat.JSON) {
        case ExportFormat.JSON:
          size = await this.exportAsJSON(processedChunks, outputPath, options.compress);
          break;
          
        case ExportFormat.JSONL:
          size = await this.exportAsJSONL(processedChunks, outputPath, options.compress);
          break;
          
        case ExportFormat.CSV:
          size = await this.exportAsCSV(processedChunks, outputPath, options.compress);
          break;
          
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
      
      return {
        path: outputPath,
        format: options.format || ExportFormat.JSON,
        count: processedChunks.length,
        size,
        compressed: !!options.compress,
      };
    } catch (error) {
      errorHandler.handleError(
        new StorageError(`Export failed: ${(error as Error).message}`, {
          code: ErrorCodes.STORAGE_WRITE_FAILED,
          details: {
            outputPath: options.outputPath,
            error,
          },
          recoverable: false,
        })
      );
      
      throw error;
    }
  }
  
  /**
   * Import chunks from a file
   * 
   * @param options - The import options
   * @returns The import result
   */
  public async importChunks(options: ImportOptions): Promise<ImportResult> {
    try {
      // Check if input file exists
      if (!fs.existsSync(options.inputPath)) {
        throw new Error(`Input file not found: ${options.inputPath}`);
      }
      
      // Determine import format based on file extension
      const ext = path.extname(options.inputPath).toLowerCase();
      let format: ExportFormat;
      let inputPath = options.inputPath;
      
      if (ext === '.gz') {
        // If file is compressed, get the original extension
        const baseExt = path.extname(path.basename(options.inputPath, ext)).toLowerCase();
        
        if (baseExt === '.json') {
          format = ExportFormat.JSON;
        } else if (baseExt === '.jsonl') {
          format = ExportFormat.JSONL;
        } else if (baseExt === '.csv') {
          format = ExportFormat.CSV;
        } else {
          throw new Error(`Unsupported import format: ${baseExt}`);
        }
        
        // Set decompress to true if not specified
        if (options.decompress === undefined) {
          options.decompress = true;
        }
      } else if (ext === '.json') {
        format = ExportFormat.JSON;
      } else if (ext === '.jsonl') {
        format = ExportFormat.JSONL;
      } else if (ext === '.csv') {
        format = ExportFormat.CSV;
      } else {
        throw new Error(`Unsupported import format: ${ext}`);
      }
      
      // Import chunks based on format
      let chunks: Chunk[];
      
      switch (format) {
        case ExportFormat.JSON:
          chunks = await this.importFromJSON(inputPath, options.decompress);
          break;
          
        case ExportFormat.JSONL:
          chunks = await this.importFromJSONL(inputPath, options.decompress);
          break;
          
        case ExportFormat.CSV:
          chunks = await this.importFromCSV(inputPath, options.decompress);
          break;
          
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }
      
      // Filter chunks if a filter is provided
      const filteredChunks = options.filter ? chunks.filter(options.filter) : chunks;
      
      // Process chunks
      const result: ImportResult = {
        total: filteredChunks.length,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        errors: [],
      };
      
      // Update bucket name and domain if provided
      if (options.bucketName || options.bucketDomain) {
        for (const chunk of filteredChunks) {
          if (options.bucketName) {
            chunk.metadata.bucketName = options.bucketName;
          }
          
          if (options.bucketDomain) {
            chunk.metadata.domain = options.bucketDomain;
          }
        }
      }
      
      // TODO: Generate embeddings if requested
      if (options.generateEmbeddings) {
        // This would require access to the embedding model
        // For now, we'll just log a warning
        console.warn('Generating embeddings is not implemented yet');
      }
      
      // TODO: Generate summaries if requested
      if (options.generateSummaries) {
        // This would require access to the summarization engine
        // For now, we'll just log a warning
        console.warn('Generating summaries is not implemented yet');
      }
      
      // Return the processed chunks and result
      return {
        ...result,
        succeeded: filteredChunks.length,
      };
    } catch (error) {
      errorHandler.handleError(
        new StorageError(`Import failed: ${(error as Error).message}`, {
          code: ErrorCodes.STORAGE_READ_FAILED,
          details: {
            inputPath: options.inputPath,
            error,
          },
          recoverable: false,
        })
      );
      
      throw error;
    }
  }
  
  /**
   * Export chunks as JSON
   * 
   * @param chunks - The chunks to export
   * @param outputPath - The output file path
   * @param compress - Whether to compress the output
   * @returns The size of the exported file
   */
  private async exportAsJSON(chunks: Chunk[], outputPath: string, compress?: boolean): Promise<number> {
    const jsonData = JSON.stringify(chunks, null, 2);
    
    if (compress) {
      await pipeline(
        Readable.from(jsonData),
        createGzip(),
        createWriteStream(outputPath)
      );
    } else {
      await fs.promises.writeFile(outputPath, jsonData);
    }
    
    const stats = await fs.promises.stat(outputPath);
    return stats.size;
  }
  
  /**
   * Export chunks as JSONL
   * 
   * @param chunks - The chunks to export
   * @param outputPath - The output file path
   * @param compress - Whether to compress the output
   * @returns The size of the exported file
   */
  private async exportAsJSONL(chunks: Chunk[], outputPath: string, compress?: boolean): Promise<number> {
    const jsonlData = chunks.map(chunk => JSON.stringify(chunk)).join('\n');
    
    if (compress) {
      await pipeline(
        Readable.from(jsonlData),
        createGzip(),
        createWriteStream(outputPath)
      );
    } else {
      await fs.promises.writeFile(outputPath, jsonlData);
    }
    
    const stats = await fs.promises.stat(outputPath);
    return stats.size;
  }
  
  /**
   * Export chunks as CSV
   * 
   * @param chunks - The chunks to export
   * @param outputPath - The output file path
   * @param compress - Whether to compress the output
   * @returns The size of the exported file
   */
  private async exportAsCSV(chunks: Chunk[], outputPath: string, compress?: boolean): Promise<number> {
    // Define CSV headers
    const headers = [
      'id',
      'content',
      'domain',
      'timestamp',
      'source',
      'tags',
      'embedding',
      'summaries',
    ];
    
    // Convert chunks to CSV rows
    const rows = chunks.map(chunk => {
      return [
        chunk.id,
        this.escapeCSV(chunk.content),
        chunk.metadata.domain,
        chunk.metadata.timestamp,
        chunk.metadata.source || '',
        Array.isArray(chunk.metadata.tags) ? chunk.metadata.tags.join('|') : '',
        chunk.embedding.join('|'),
        chunk.summaries.map(summary => `${summary.level}:${summary.content}`).join('||'),
      ];
    });
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    if (compress) {
      await pipeline(
        Readable.from(csvContent),
        createGzip(),
        createWriteStream(outputPath)
      );
    } else {
      await fs.promises.writeFile(outputPath, csvContent);
    }
    
    const stats = await fs.promises.stat(outputPath);
    return stats.size;
  }
  
  /**
   * Import chunks from JSON
   * 
   * @param inputPath - The input file path
   * @param decompress - Whether to decompress the input
   * @returns The imported chunks
   */
  private async importFromJSON(inputPath: string, decompress?: boolean): Promise<Chunk[]> {
    let jsonData: string;
    
    if (decompress) {
      // Create a temporary file to store the decompressed data
      const tempPath = `${inputPath}.temp`;
      
      await pipeline(
        createReadStream(inputPath),
        createGunzip(),
        createWriteStream(tempPath)
      );
      
      jsonData = await fs.promises.readFile(tempPath, 'utf-8');
      
      // Clean up temporary file
      await fs.promises.unlink(tempPath);
    } else {
      jsonData = await fs.promises.readFile(inputPath, 'utf-8');
    }
    
    return JSON.parse(jsonData) as Chunk[];
  }
  
  /**
   * Import chunks from JSONL
   * 
   * @param inputPath - The input file path
   * @param decompress - Whether to decompress the input
   * @returns The imported chunks
   */
  private async importFromJSONL(inputPath: string, decompress?: boolean): Promise<Chunk[]> {
    let jsonlData: string;
    
    if (decompress) {
      // Create a temporary file to store the decompressed data
      const tempPath = `${inputPath}.temp`;
      
      await pipeline(
        createReadStream(inputPath),
        createGunzip(),
        createWriteStream(tempPath)
      );
      
      jsonlData = await fs.promises.readFile(tempPath, 'utf-8');
      
      // Clean up temporary file
      await fs.promises.unlink(tempPath);
    } else {
      jsonlData = await fs.promises.readFile(inputPath, 'utf-8');
    }
    
    return jsonlData
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as Chunk);
  }
  
  /**
   * Import chunks from CSV
   * 
   * @param inputPath - The input file path
   * @param decompress - Whether to decompress the input
   * @returns The imported chunks
   */
  private async importFromCSV(inputPath: string, decompress?: boolean): Promise<Chunk[]> {
    let csvData: string;
    
    if (decompress) {
      // Create a temporary file to store the decompressed data
      const tempPath = `${inputPath}.temp`;
      
      await pipeline(
        createReadStream(inputPath),
        createGunzip(),
        createWriteStream(tempPath)
      );
      
      csvData = await fs.promises.readFile(tempPath, 'utf-8');
      
      // Clean up temporary file
      await fs.promises.unlink(tempPath);
    } else {
      csvData = await fs.promises.readFile(inputPath, 'utf-8');
    }
    
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).filter(line => line.trim()).map(line => {
      const values = this.parseCSVLine(line);
      
      const chunk: Chunk = {
        id: values[0],
        content: values[1],
        embedding: values[6] ? values[6].split('|').map(Number) : [],
        metadata: {
          id: values[0],
          domain: values[2],
          timestamp: values[3],
          source: values[4],
          tags: values[5] ? values[5].split('|') : [],
        },
        summaries: values[7] ? values[7].split('||').map(summary => {
          const [levelStr, content] = summary.split(':', 2);
          return {
            level: parseInt(levelStr, 10) || 0,
            content: content || summary, // If no level found, use the whole string as content
            concepts: []
          };
        }) : [],
      };
      
      return chunk;
    });
  }
  
  /**
   * Escape a string for CSV
   * 
   * @param str - The string to escape
   * @returns The escaped string
   */
  private escapeCSV(str: string): string {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  
  /**
   * Parse a CSV line
   * 
   * @param line - The CSV line to parse
   * @returns The parsed values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (i < line.length - 1 && line[i + 1] === '"') {
          // Double quotes inside quotes
          current += '"';
          i++;
        } else {
          // Toggle quotes
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current);
        current = '';
      } else {
        // Normal character
        current += char;
      }
    }
    
    // Add the last field
    result.push(current);
    
    return result;
  }
}

// Export the singleton instance
export const dataPortabilityManager = DataPortabilityManager.getInstance();

/**
 * Utility function to export chunks
 * 
 * @param chunks - The chunks to export
 * @param options - The export options
 * @returns The export result
 */
export function exportChunks(chunks: Chunk[], options: ExportOptions): Promise<ExportResult> {
  return dataPortabilityManager.exportChunks(chunks, options);
}

/**
 * Utility function to import chunks
 * 
 * @param options - The import options
 * @returns The import result
 */
export function importChunks(options: ImportOptions): Promise<ImportResult> {
  return dataPortabilityManager.importChunks(options);
}
