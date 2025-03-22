/**
 * Basic usage example for InfiniteContext
 */

import { InfiniteContext } from 'infinite-context';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Create an OpenAI client for embeddings and summarization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function main() {
  console.log('Initializing InfiniteContext...');
  
  // Initialize the system
  const context = new InfiniteContext({
    openai,
    embeddingModel: 'text-embedding-3-small'
  });
  
  await context.initialize({
    enableMemoryMonitoring: true
  });
  
  console.log('Storing content...');
  
  // Store some content
  const chunkId1 = await context.storeContent(
    'InfiniteContext provides virtually unlimited memory for AI systems through distributed storage.',
    {
      bucketName: 'documentation',
      bucketDomain: 'product',
      metadata: {
        source: 'readme',
        tags: ['documentation', 'overview']
      }
    }
  );
  
  const chunkId2 = await context.storeContent(
    'The system uses a hierarchical bucket system to organize information by domain and topic.',
    {
      bucketName: 'documentation',
      bucketDomain: 'product',
      metadata: {
        source: 'architecture',
        tags: ['documentation', 'architecture']
      }
    }
  );
  
  const chunkId3 = await context.storeContent(
    'Vector-based retrieval enables efficient semantic search across all stored information.',
    {
      bucketName: 'documentation',
      bucketDomain: 'product',
      metadata: {
        source: 'features',
        tags: ['documentation', 'features']
      }
    }
  );
  
  console.log(`Stored chunks with IDs: ${chunkId1}, ${chunkId2}, ${chunkId3}`);
  
  console.log('Retrieving content...');
  
  // Retrieve content based on a query
  const results = await context.retrieveContent('How does InfiniteContext organize information?');
  
  console.log('Search results:');
  for (const { chunk, score } of results) {
    console.log(`Score: ${score.toFixed(3)}`);
    console.log(`Content: ${chunk.content}`);
    console.log(`Metadata: ${JSON.stringify(chunk.metadata)}`);
    console.log('---');
  }
  
  console.log('Generating summary...');
  
  // Generate a summary of a longer text
  const longText = `
    InfiniteContext is a TypeScript library that provides a structured way to store, organize, and retrieve
    large amounts of contextual information across different storage tiers. It's designed to solve the
    context limitation problem for AI systems by creating a robust, hierarchical memory architecture
    that seamlessly scales from local to cloud storage.
    
    The system uses a hierarchical bucket system to organize information by domain and topic in a
    hierarchical structure. It supports different storage providers from local disk to cloud services,
    and uses vector-based retrieval for efficient semantic search across all stored information.
    
    InfiniteContext includes a multi-level summarization engine that automatically generates summaries
    at different levels of abstraction. This allows the system to provide concise overviews of large
    amounts of information, while still maintaining access to the full details when needed.
    
    The system is highly extensible, allowing you to add custom storage providers to integrate with
    any system, and includes ready-to-use integration with OpenAI for embeddings and summarization.
  `;
  
  const summaries = await context.summarize(longText, { levels: 3 });
  
  console.log('Summaries:');
  for (let i = 0; i < summaries.length; i++) {
    console.log(`Level ${i + 1}:`);
    console.log(summaries[i]);
    console.log('---');
  }
  
  console.log('Getting memory stats...');
  
  // Get memory usage statistics
  const stats = await context.getMemoryStats();
  
  console.log('Memory stats:');
  console.log(JSON.stringify(stats, null, 2));
  
  console.log('Done!');
}

main().catch(console.error);
