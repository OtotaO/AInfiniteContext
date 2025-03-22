/**
 * Advanced usage example for InfiniteContext
 * 
 * This example demonstrates the advanced features of InfiniteContext,
 * including error handling, transactions, data integrity, backup and recovery,
 * data portability, and vector index optimization.
 */

import { InfiniteContext, StorageTier, IndexType, Chunk } from '../src/index.js';
import { OpenAI } from 'openai';
import path from 'path';
import fs from 'fs';

// Optional dotenv loading
try {
  // Note: You may need to install dotenv: npm install dotenv
  // @ts-ignore - Ignore the module not found error
  const dotenv = require('dotenv');
  dotenv.config();
  console.log('Loaded environment variables from .env file');
} catch (error) {
  console.log('dotenv not installed, skipping .env file loading');
  console.log('To use .env files, install dotenv: npm install dotenv');
}

// Create an OpenAI client for embeddings and summarization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function main() {
  try {
    console.log('Initializing InfiniteContext...');
    
    // Initialize the system
    const context = new InfiniteContext({
      openai,
      embeddingModel: 'text-embedding-3-small',
      llmModel: 'gpt-3.5-turbo'
    });
    
    await context.initialize({
      enableMemoryMonitoring: true,
      memoryMonitoringConfig: {
        bucketSizeThresholdMB: 100,
        providerCapacityThresholdPercent: 80,
        monitoringIntervalMs: 60000
      }
    });
    
    // Add a memory alert handler
    context.addMemoryAlertHandler((alert) => {
      console.log(`[ALERT] ${alert.message}`);
      console.log(`Details: ${JSON.stringify(alert.details)}`);
      
      // Acknowledge the alert
      context.acknowledgeMemoryAlert(alert.id);
    });
    
    // Create some sample content
    console.log('Creating sample content...');
    const sampleTexts = [
      'InfiniteContext provides virtually unlimited memory for AI systems through distributed storage.',
      'The system uses a hierarchical bucket system to organize information by domain and topic.',
      'Vector-based retrieval enables efficient semantic search across all stored information.',
      'Multi-level summarization automatically generates summaries at different levels of abstraction.',
      'The tiered storage architecture uses different storage providers from local disk to cloud services.',
      'Error handling ensures robust operation even in the face of failures.',
      'Data integrity verification prevents corruption of stored information.',
      'Backup and recovery protects against data loss.',
      'Data portability allows for easy migration between systems.',
      'Vector index optimization ensures efficient retrieval even with large datasets.'
    ];
    
    // Store the sample content
    const chunks: Chunk[] = [];
    for (let i = 0; i < sampleTexts.length; i++) {
      const chunkId = await context.storeContent(sampleTexts[i], {
        bucketName: 'documentation',
        bucketDomain: 'features',
        metadata: {
          source: 'example',
          tags: ['documentation', 'features', `feature-${i + 1}`]
        },
        preferredTier: StorageTier.LOCAL
      });
      
      // Retrieve the stored chunk
      const results = await context.retrieveContent(sampleTexts[i], {
        bucketName: 'documentation',
        bucketDomain: 'features'
      });
      
      if (results.length > 0) {
        chunks.push(results[0].chunk);
      }
    }
    
    console.log(`Stored ${chunks.length} chunks`);
    
    // Demonstrate backup and recovery
    console.log('\n=== Backup and Recovery ===');
    
    // Create a backup
    console.log('Creating backup...');
    const backup = await context.createBackup({
      includeVectorStores: true,
      maxBackups: 5
    });
    
    console.log(`Backup created: ${backup.id}`);
    console.log(`Backup size: ${(backup.stats.totalSize / 1024).toFixed(2)} KB`);
    console.log(`Buckets: ${backup.stats.bucketCount}`);
    console.log(`Chunks: ${backup.stats.chunkCount}`);
    
    // List available backups
    const backups = await context.listBackups();
    console.log(`Available backups: ${backups.length}`);
    
    // Demonstrate data portability
    console.log('\n=== Data Portability ===');
    
    // Create export directory if it doesn't exist
    const exportDir = path.join(process.cwd(), 'export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Export chunks to different formats
    console.log('Exporting chunks...');
    
    // Export to JSON
    const jsonExport = await context.exportChunks(chunks, {
      format: 'json',
      outputPath: path.join(exportDir, 'data.json'),
      compress: false,
      includeEmbeddings: true,
      includeSummaries: true
    });
    
    console.log(`Exported to JSON: ${jsonExport.path}`);
    console.log(`Size: ${(jsonExport.size / 1024).toFixed(2)} KB`);
    
    // Export to JSONL with compression
    const jsonlExport = await context.exportChunks(chunks, {
      format: 'jsonl',
      outputPath: path.join(exportDir, 'data.jsonl'),
      compress: true,
      includeEmbeddings: true,
      includeSummaries: true
    });
    
    console.log(`Exported to JSONL: ${jsonlExport.path}`);
    console.log(`Size: ${(jsonlExport.size / 1024).toFixed(2)} KB`);
    
    // Export to CSV without embeddings
    const csvExport = await context.exportChunks(chunks, {
      format: 'csv',
      outputPath: path.join(exportDir, 'data.csv'),
      compress: false,
      includeEmbeddings: false,
      includeSummaries: true
    });
    
    console.log(`Exported to CSV: ${csvExport.path}`);
    console.log(`Size: ${(csvExport.size / 1024).toFixed(2)} KB`);
    
    // Import from JSON
    console.log('Importing chunks...');
    const importResult = await context.importChunks({
      inputPath: path.join(exportDir, 'data.json'),
      bucketName: 'imported',
      bucketDomain: 'external'
    });
    
    console.log(`Imported ${importResult.succeeded} chunks`);
    console.log(`Failed: ${importResult.failed}`);
    console.log(`Skipped: ${importResult.skipped}`);
    
    // Demonstrate data integrity
    console.log('\n=== Data Integrity ===');
    
    // Calculate hash for a chunk
    const chunk = chunks[0];
    const storedHash = chunk.metadata.hash as string;
    
    // Verify chunk integrity
    console.log('Verifying chunk integrity...');
    const verificationResult = await context.verifyChunkIntegrity(chunk, storedHash);
    
    if (verificationResult.isValid) {
      console.log('Chunk is valid');
    } else {
      console.log(`Chunk integrity issues: ${verificationResult.errors.length}`);
      
      // Try to repair the chunk
      const repairedChunk = await context.repairChunk(chunk, verificationResult);
      
      if (repairedChunk) {
        console.log('Chunk repaired successfully');
      } else {
        console.log('Chunk could not be repaired');
      }
    }
    
    // Demonstrate vector index optimization
    console.log('\n=== Vector Index Optimization ===');
    
    // Get the dimension of the embeddings
    const dimension = chunks[0].embedding.length;
    console.log(`Embedding dimension: ${dimension}`);
    
    // Get optimal index parameters
    console.log('Getting optimal index parameters...');
    const params = await context.getOptimalIndexParams(
      chunks.length,
      dimension,
      1024 * 1024 * 1024 // 1GB memory budget
    );
    
    console.log(`Optimal index type: ${IndexType[params.type]}`);
    console.log(`Parameters: ${JSON.stringify(params, null, 2)}`);
    
    // Estimate memory usage
    const memoryUsage = await context.estimateIndexMemoryUsage(params, chunks.length);
    console.log(`Estimated memory usage: ${(memoryUsage / (1024 * 1024)).toFixed(2)} MB`);
    
    // Optimize the index
    console.log('Optimizing index...');
    const optimizedParams = await context.optimizeIndex(chunks, params, {
      targetMemoryUsage: 512 * 1024 * 1024, // 512MB
      maxIndexSize: 1000000
    });
    
    console.log(`Optimized index type: ${IndexType[optimizedParams.type]}`);
    console.log(`Parameters: ${JSON.stringify(optimizedParams, null, 2)}`);
    
    // Create vector indices directory if it doesn't exist
    const indicesDir = path.join(process.cwd(), 'vector-indices');
    if (!fs.existsSync(indicesDir)) {
      fs.mkdirSync(indicesDir, { recursive: true });
    }
    
    // Rebuild the index with optimized parameters
    console.log('Rebuilding index...');
    const rebuilt = await context.rebuildIndex(
      chunks,
      optimizedParams,
      path.join(indicesDir, 'optimized.idx')
    );
    
    if (rebuilt) {
      console.log('Index rebuilt successfully');
    } else {
      console.log('Index rebuild failed');
    }
    
    console.log('\nAdvanced usage example completed successfully');
  } catch (error) {
    console.error('Error in advanced usage example:', error);
  }
}

main().catch(console.error);
