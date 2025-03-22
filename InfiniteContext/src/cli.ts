#!/usr/bin/env node

/**
 * Command-line interface for InfiniteContext
 * 
 * This provides a simple CLI for interacting with InfiniteContext,
 * making it usable as a standalone executable.
 */

import { Command } from 'commander';
import { OpenAI } from 'openai';
import { InfiniteContext, StorageTier } from './index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import readline from 'readline';

// Load environment variables
dotenv.config();

// Create CLI program
const program = new Command();

// Set up program metadata
program
  .name('infinite-context')
  .description('An extensible memory architecture for AI systems')
  .version(process.env.npm_package_version || '0.1.0');

// Initialize context
let context: InfiniteContext | null = null;

// Helper function to ensure context is initialized
async function ensureContext(options: any = {}): Promise<InfiniteContext> {
  if (context) return context;

  // Create OpenAI client if API key is available
  let openaiClient: OpenAI | undefined;
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('OpenAI client initialized');
  } else if (options.requireOpenAI) {
    console.error('Error: OPENAI_API_KEY environment variable is required for this operation');
    process.exit(1);
  } else {
    console.log('No OpenAI API key found, running without embeddings and LLM support');
  }

  // Initialize InfiniteContext
  context = new InfiniteContext({
    basePath: options.basePath || path.join(os.homedir(), '.infinite-context'),
    openai: openaiClient,
    embeddingModel: options.embeddingModel || 'text-embedding-3-small',
  });

  console.log('Initializing InfiniteContext...');
  await context.initialize({
    enableMemoryMonitoring: options.enableMonitoring !== false,
  });
  console.log('Initialization complete');

  return context;
}

// Store command
program
  .command('store')
  .description('Store content in InfiniteContext')
  .argument('<content>', 'Content to store')
  .option('-b, --bucket <name>', 'Bucket name', 'default')
  .option('-d, --domain <domain>', 'Bucket domain', 'general')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('--no-summarize', 'Disable summarization')
  .option('--tier <tier>', 'Storage tier (0-4)', '1')
  .action(async (content, options) => {
    const ctx = await ensureContext({ requireOpenAI: true });
    
    const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
    const tier = parseInt(options.tier, 10) as StorageTier;
    
    try {
      const chunkId = await ctx.storeContent(content, {
        bucketName: options.bucket,
        bucketDomain: options.domain,
        metadata: {
          source: 'cli',
          tags,
        },
        summarize: options.summarize,
        preferredTier: tier,
      });
      
      console.log(`Content stored with ID: ${chunkId}`);
    } catch (error) {
      console.error('Error storing content:', error);
    }
  });

// Retrieve command
program
  .command('retrieve')
  .description('Retrieve content from InfiniteContext')
  .argument('<query>', 'Query to search for')
  .option('-b, --bucket <name>', 'Bucket name')
  .option('-d, --domain <domain>', 'Bucket domain')
  .option('-n, --max-results <number>', 'Maximum number of results', '5')
  .option('-s, --min-score <number>', 'Minimum similarity score (0-1)', '0.7')
  .action(async (query, options) => {
    const ctx = await ensureContext({ requireOpenAI: true });
    
    try {
      const results = await ctx.retrieveContent(query, {
        bucketName: options.bucket,
        bucketDomain: options.domain,
        maxResults: parseInt(options.maxResults, 10),
        minScore: parseFloat(options.minScore),
      });
      
      console.log(`Found ${results.length} results:`);
      
      for (const [i, { chunk, score }] of results.entries()) {
        console.log(`\n[${i + 1}] Score: ${score.toFixed(3)}`);
        console.log(`Content: ${chunk.content}`);
        console.log(`Domain: ${chunk.metadata.domain}`);
        console.log(`Tags: ${chunk.metadata.tags.join(', ')}`);
        console.log(`ID: ${chunk.id}`);
      }
    } catch (error) {
      console.error('Error retrieving content:', error);
    }
  });

// Summarize command
program
  .command('summarize')
  .description('Summarize text')
  .argument('<text>', 'Text to summarize')
  .option('-l, --levels <number>', 'Number of summary levels', '1')
  .action(async (text, options) => {
    const ctx = await ensureContext({ requireOpenAI: true });
    
    try {
      const summaries = await ctx.summarize(text, {
        levels: parseInt(options.levels, 10),
      });
      
      console.log('Generated summaries:');
      
      summaries.forEach((summary, index) => {
        console.log(`\nLevel ${index + 1}:`);
        console.log(summary);
      });
    } catch (error) {
      console.error('Error summarizing text:', error);
    }
  });

// Memory stats command
program
  .command('stats')
  .description('Show memory usage statistics')
  .action(async () => {
    const ctx = await ensureContext();
    
    try {
      const stats = await ctx.getMemoryStats();
      
      console.log('\n=== Memory Usage Statistics ===\n');
      
      console.log('Total Statistics:');
      console.log(`  Chunks: ${stats.totalStats.chunkCount}`);
      console.log(`  Size: ${stats.totalStats.estimatedSizeMB.toFixed(2)} MB`);
      console.log(`  Available Storage: ${stats.totalStats.availableStorageMB.toFixed(2)} MB`);
      
      console.log('\nDomain Statistics:');
      for (const domain of stats.domainStats) {
        console.log(`  ${domain.domain}: ${domain.chunkCount} chunks, ${domain.estimatedSizeMB.toFixed(2)} MB`);
      }
      
      console.log('\nBucket Statistics:');
      for (const bucket of stats.bucketStats) {
        console.log(`  ${bucket.name} (${bucket.domain}): ${bucket.chunkCount} chunks, ${bucket.estimatedSizeMB.toFixed(2)} MB`);
      }
      
      console.log('\nStorage Provider Statistics:');
      for (const provider of stats.providerStats) {
        console.log(`  ${provider.name} (Tier ${provider.tier}):`);
        console.log(`    Usage: ${provider.usagePercent.toFixed(2)}%`);
        console.log(`    Used: ${(provider.quota.used / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`    Available: ${(provider.quota.available / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`    Total: ${(provider.quota.total / (1024 * 1024)).toFixed(2)} MB`);
      }
    } catch (error) {
      console.error('Error getting memory statistics:', error);
    }
  });

// Alerts command
program
  .command('alerts')
  .description('Show memory alerts')
  .option('-a, --all', 'Show all alerts, including acknowledged ones')
  .action(async (options) => {
    const ctx = await ensureContext();
    
    try {
      const alerts = ctx.getMemoryAlerts(options.all);
      
      console.log(`\n=== Memory Alerts (${alerts.length}) ===\n`);
      
      if (alerts.length === 0) {
        console.log('No alerts found.');
        return;
      }
      
      for (const alert of alerts) {
        console.log(`[${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}`);
        console.log(`  Time: ${new Date(alert.timestamp).toLocaleString()}`);
        console.log(`  ID: ${alert.id}`);
        console.log(`  Acknowledged: ${alert.acknowledged ? 'Yes' : 'No'}`);
        console.log('');
      }
    } catch (error) {
      console.error('Error getting memory alerts:', error);
    }
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    const ctx = await ensureContext({ requireOpenAI: true });
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    console.log('\n=== InfiniteContext Interactive Mode ===');
    console.log('Type "help" for a list of commands, or "exit" to quit.\n');
    
    const promptUser = () => {
      rl.question('> ', async (input) => {
        const trimmedInput = input.trim();
        
        if (trimmedInput === 'exit' || trimmedInput === 'quit') {
          rl.close();
          return;
        }
        
        if (trimmedInput === 'help') {
          console.log('\nAvailable commands:');
          console.log('  store <text>                - Store text in memory');
          console.log('  retrieve <query>            - Retrieve content based on query');
          console.log('  summarize <text>            - Summarize text');
          console.log('  stats                       - Show memory statistics');
          console.log('  alerts                      - Show memory alerts');
          console.log('  exit                        - Exit interactive mode');
          promptUser();
          return;
        }
        
        if (trimmedInput.startsWith('store ')) {
          const content = trimmedInput.substring(6);
          try {
            const chunkId = await ctx.storeContent(content);
            console.log(`Content stored with ID: ${chunkId}`);
          } catch (error) {
            console.error('Error storing content:', error);
          }
          promptUser();
          return;
        }
        
        if (trimmedInput.startsWith('retrieve ')) {
          const query = trimmedInput.substring(9);
          try {
            const results = await ctx.retrieveContent(query);
            console.log(`Found ${results.length} results:`);
            for (const [i, { chunk, score }] of results.entries()) {
              console.log(`\n[${i + 1}] Score: ${score.toFixed(3)}`);
              console.log(`Content: ${chunk.content}`);
            }
          } catch (error) {
            console.error('Error retrieving content:', error);
          }
          promptUser();
          return;
        }
        
        if (trimmedInput.startsWith('summarize ')) {
          const text = trimmedInput.substring(10);
          try {
            const summaries = await ctx.summarize(text);
            console.log('Generated summary:');
            console.log(summaries[0]);
          } catch (error) {
            console.error('Error summarizing text:', error);
          }
          promptUser();
          return;
        }
        
        if (trimmedInput === 'stats') {
          try {
            const stats = await ctx.getMemoryStats();
            console.log(`Total chunks: ${stats.totalStats.chunkCount}`);
            console.log(`Total size: ${stats.totalStats.estimatedSizeMB.toFixed(2)} MB`);
          } catch (error) {
            console.error('Error getting memory statistics:', error);
          }
          promptUser();
          return;
        }
        
        if (trimmedInput === 'alerts') {
          try {
            const alerts = ctx.getMemoryAlerts();
            console.log(`${alerts.length} alerts found.`);
            for (const alert of alerts) {
              console.log(`[${alert.severity.toUpperCase()}] ${alert.message}`);
            }
          } catch (error) {
            console.error('Error getting memory alerts:', error);
          }
          promptUser();
          return;
        }
        
        console.log('Unknown command. Type "help" for a list of commands.');
        promptUser();
      });
    };
    
    promptUser();
  });

// Parse command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}
