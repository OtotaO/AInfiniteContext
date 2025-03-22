/**
 * Basic usage example for InfiniteContext
 * 
 * This example demonstrates the core functionality of the InfiniteContext system,
 * including initialization, content storage, and retrieval.
 * 
 * To run this example:
 * 1. Build the project: `npm run build`
 * 2. Run the example: `node dist/examples/basic-usage.js`
 */

import { InfiniteContext, StorageTier } from '../src/index.js';
import { config } from 'dotenv';
import path from 'path';
import os from 'os';
import { OpenAI } from 'openai';

// Load environment variables from .env file
config();

async function main() {
  console.log('===== InfiniteContext Basic Usage Example =====');

  // Create an OpenAI client if API key is available
  let openaiClient: OpenAI | undefined;
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('OpenAI client initialized');
  } else {
    console.log('No OpenAI API key found, running without embeddings and LLM support');
  }

  // Initialize InfiniteContext
  const context = new InfiniteContext({
    basePath: path.join(os.homedir(), '.infinite-context-example'),
    openai: openaiClient,
  });

  console.log('Initializing InfiniteContext...');
  await context.initialize();
  console.log('Initialization complete');

  // Example 1: Store and retrieve simple content
  console.log('\n--- Example 1: Store and Retrieve Simple Content ---');
  
  const sampleContent1 = `
    InfiniteContext is an extensible memory architecture for AI systems.
    It provides virtually unlimited context through distributed storage across multiple tiers.
    The system organizes information into buckets and uses vector embeddings for efficient retrieval.
  `;

  console.log('Storing content...');
  const chunkId1 = await context.storeContent(sampleContent1, {
    bucketName: 'documentation',
    bucketDomain: 'product',
    metadata: {
      source: 'example',
      tags: ['documentation', 'overview'],
    },
  });
  console.log(`Content stored with ID: ${chunkId1}`);

  // Example 2: Store more complex content in a different bucket
  console.log('\n--- Example 2: Store Complex Content ---');
  
  const sampleContent2 = `
    # Vector Search Implementation Guide
    
    Vector search is implemented using a vector store abstraction that supports:
    
    1. Multiple distance metrics (cosine, euclidean, dot product)
    2. Storage and retrieval of embeddings
    3. Approximate nearest neighbor search
    
    The default implementation uses a simple in-memory store, but more advanced 
    implementations like HNSW (Hierarchical Navigable Small World) are available
    for larger datasets.
    
    To optimize search performance, consider:
    - Normalizing vectors for cosine similarity
    - Using appropriate indexing parameters
    - Limiting the number of dimensions when possible
  `;

  console.log('Storing technical documentation...');
  const chunkId2 = await context.storeContent(sampleContent2, {
    bucketName: 'documentation',
    bucketDomain: 'technical',
    metadata: {
      source: 'example',
      tags: ['documentation', 'technical', 'vector-search'],
    },
  });
  console.log(`Technical content stored with ID: ${chunkId2}`);

  // Example 3: Store a personal note in a different bucket
  console.log('\n--- Example 3: Store Personal Note ---');
  
  const sampleContent3 = `
    Reminder: Need to improve the summarization engine to handle longer texts more efficiently.
    Current implementation works well for short texts but struggles with documents longer than 10 pages.
    Consider implementing hierarchical summarization approach.
  `;

  console.log('Storing personal note...');
  const chunkId3 = await context.storeContent(sampleContent3, {
    bucketName: 'notes',
    bucketDomain: 'personal',
    metadata: {
      source: 'example',
      tags: ['note', 'todo', 'summarization'],
    },
  });
  console.log(`Personal note stored with ID: ${chunkId3}`);

  // Example 4: Search across all buckets
  console.log('\n--- Example 4: General Search ---');
  
  const searchQuery1 = 'What is InfiniteContext?';
  console.log(`Searching for: "${searchQuery1}"...`);
  
  const searchResults1 = await context.retrieveContent(searchQuery1);
  
  console.log(`Found ${searchResults1.length} results:`);
  for (const { chunk, score } of searchResults1) {
    console.log(`\nScore: ${score.toFixed(3)}`);
    console.log(`Content: ${chunk.content.substring(0, 100).trim()}...`);
    console.log(`Bucket: ${chunk.metadata.domain}`);
    console.log(`Tags: ${chunk.metadata.tags.join(', ')}`);
  }

  // Example 5: Targeted bucket search
  console.log('\n--- Example 5: Targeted Search ---');
  
  const searchQuery2 = 'vector search performance';
  console.log(`Searching specifically in technical documentation for: "${searchQuery2}"...`);
  
  const searchResults2 = await context.retrieveContent(searchQuery2, {
    bucketName: 'documentation',
    bucketDomain: 'technical',
  });
  
  console.log(`Found ${searchResults2.length} results:`);
  for (const { chunk, score } of searchResults2) {
    console.log(`\nScore: ${score.toFixed(3)}`);
    console.log(`Content: ${chunk.content.substring(0, 100).trim()}...`);
  }

  // Example 6: Summarization (if OpenAI API key is available)
  if (openaiClient) {
    console.log('\n--- Example 6: Text Summarization ---');
    
    const textToSummarize = `
      InfiniteContext is a comprehensive memory management system designed to provide AI systems
      with virtually unlimited context storage capabilities. It uses a tiered architecture that spans
      from fast in-memory storage to extensible cloud storage solutions. The system organizes
      information into conceptual "buckets" based on domains and topics, and uses vector embeddings
      to enable semantic search and retrieval. Each chunk of information is automatically summarized
      at multiple levels of abstraction to facilitate faster browsing and conceptual organization.
      The architecture is designed to be extensible, allowing integration with various storage providers
      including local filesystems, cloud services like Google Drive, and specialized platforms.
    `;
    
    console.log('Generating summaries...');
    const summaries = await context.summarize(textToSummarize, { levels: 2 });
    
    console.log('Generated summaries:');
    summaries.forEach((summary, index) => {
      console.log(`\nLevel ${index + 1}: ${summary}`);
    });
  }

  console.log('\n===== Example Complete =====');
}

main().catch((error) => {
  console.error('Error in example:', error);
});
