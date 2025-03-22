/**
 * Advanced usage example for InfiniteContext
 * 
 * This example demonstrates more advanced features of InfiniteContext:
 * - Google Drive integration
 * - Custom embedding function
 * - Backup and recovery
 * - Data portability
 * - Data integrity verification
 * - Vector index optimization
 */

import { InfiniteContext } from 'infinite-context';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load environment variables from .env file
dotenv.config();

// Create an OpenAI client for embeddings and summarization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Custom embedding function using OpenAI but with caching
const embeddingCache = new Map<string, number[]>();

async function customEmbedding(text: string): Promise<number[]> {
  // Check if we have a cached embedding
  if (embeddingCache.has(text)) {
    console.log('Using cached embedding');
    return embeddingCache.get(text)!;
  }
  
  // Generate a new embedding
  console.log('Generating new embedding');
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  
  const embedding = response.data[0].embedding;
  
  // Cache the embedding
  embeddingCache.set(text, embedding);
  
  return embedding;
}

async function main() {
  console.log('Initializing InfiniteContext with custom embedding function...');
  
  // Initialize the system with custom embedding function
  const context = new InfiniteContext({
    basePath: path.join(process.cwd(), '.infinite-context'),
    embeddingFunction: customEmbedding,
    openai, // Still provide OpenAI for summarization
  });
  
  await context.initialize({
    enableMemoryMonitoring: true,
    memoryMonitoringConfig: {
      bucketSizeThresholdMB: 100,
      providerCapacityThresholdPercent: 80,
      monitoringIntervalMs: 30000, // 30 seconds
    },
    // Uncomment to add Google Drive integration
    // addGoogleDrive: true,
    // googleDriveCredentials: {
    //   clientId: process.env.GOOGLE_CLIENT_ID!,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    //   redirectUri: 'http://localhost:3000/oauth2callback',
    //   refreshToken: process.env.GOOGLE_REFRESH_TOKEN!,
    // },
  });
  
  // Add memory alert handler
  context.addMemoryAlertHandler((alert) => {
    console.log(`ALERT: ${alert.message}`);
    console.log(`Details: ${JSON.stringify(alert.details)}`);
    
    // Automatically acknowledge the alert
    context.acknowledgeMemoryAlert(alert.id);
  });
  
  console.log('Storing content in different buckets...');
  
  // Store content in different buckets
  const chunks = [];
  
  for (let i = 0; i < 10; i++) {
    const content = `This is test content ${i + 1} for the advanced usage example. It demonstrates how InfiniteContext handles multiple chunks of information across different buckets and domains.`;
    
    const domain = i % 2 === 0 ? 'test-domain-1' : 'test-domain-2';
    const bucket = `test-bucket-${Math.floor(i / 3) + 1}`;
    
    const chunkId = await context.storeContent(content, {
      bucketDomain: domain,
      bucketName: bucket,
      metadata: {
        index: i,
        timestamp: new Date().toISOString(),
        tags: [`tag-${i % 5 + 1}`, 'test'],
      },
    });
    
    console.log(`Stored chunk ${i + 1} with ID ${chunkId} in ${bucket} (${domain})`);
    
    // Get the chunk from the search results
    const results = await context.retrieveContent(content, {
      bucketDomain: domain,
      bucketName: bucket,
    });
    
    if (results.length > 0) {
      chunks.push(results[0].chunk);
    }
  }
  
  console.log(`Stored ${chunks.length} chunks`);
  
  console.log('Creating backup...');
  
  // Create a backup
  const backup = await context.createBackup({
    includeVectorStores: true,
    maxBackups: 3, // Keep only the 3 most recent backups
  });
  
  console.log(`Backup created: ${backup.id}`);
  
  // List available backups
  const backups = await context.listBackups();
  console.log(`Available backups: ${backups.length}`);
  for (const b of backups) {
    console.log(`- ${b.id} (${b.timestamp}): ${b.size} bytes`);
  }
  
  console.log('Exporting chunks...');
  
  // Create export directory if it doesn't exist
  const exportDir = path.join(process.cwd(), 'export');
  await fs.mkdir(exportDir, { recursive: true });
  
  // Export chunks to a file
  const exportResult = await context.exportChunks(chunks, {
    format: 'json',
    outputPath: path.join(exportDir, 'data.json'),
    compress: true,
    includeEmbeddings: true,
  });
  
  console.log(`Exported ${exportResult.count} chunks to ${exportResult.path}`);
  
  console.log('Verifying chunk integrity...');
  
  // Verify the integrity of a chunk
  if (chunks.length > 0) {
    const chunk = chunks[0];
    const storedHash = chunk.metadata.hash as string || 'unknown';
    
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
  }
  
  console.log('Optimizing vector index...');
  
  // Get optimal index parameters
  const params = await context.getOptimalIndexParams(
    chunks.length,
    chunks[0].embedding.length,
    1024 * 1024 * 1024 // 1GB memory budget
  );
  
  console.log(`Optimal index type: ${params.type}`);
  
  // Estimate memory usage
  const memoryUsage = await context.estimateIndexMemoryUsage(params, chunks.length);
  console.log(`Estimated memory usage: ${memoryUsage / (1024 * 1024)} MB`);
  
  // Optimize the index
  const optimizedParams = await context.optimizeIndex(chunks, params, {
    targetMemoryUsage: 512 * 1024 * 1024, // 512MB
    maxIndexSize: 1000000,
  });
  
  console.log('Optimized index parameters:');
  console.log(JSON.stringify(optimizedParams, null, 2));
  
  console.log('Done!');
}

main().catch(console.error);
