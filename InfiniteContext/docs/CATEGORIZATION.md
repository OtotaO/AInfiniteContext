# Prompt Categorization System

The InfiniteContext library includes a powerful categorization system that automatically organizes prompts and their outputs into appropriate buckets. This document explains how the categorization system works and how to use it in your applications.

## Overview

The categorization system uses a combination of strategies to determine the most appropriate bucket for a given prompt and its output:

1. **Keyword Matching**: Fast categorization based on keywords and regex patterns
2. **Vector Similarity**: Semantic categorization using embeddings
3. **Adaptive Learning**: Learns from past categorizations and user feedback

The system is designed to be:
- **Fast**: Prioritizes speed for real-time applications
- **Accurate**: Uses multiple strategies to improve categorization accuracy
- **Adaptive**: Learns from user feedback to improve over time
- **Extensible**: Can be customized with additional strategies

## Getting Started

### Initialization

To use the categorization system, you need to initialize it when creating your InfiniteContext instance:

```typescript
import { InfiniteContext } from 'infinite-context';
import { OpenAI } from 'openai';

// Create an OpenAI client (required for embeddings)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create InfiniteContext with categorizer options
const context = new InfiniteContext({
  openai,
  categorizerOptions: {
    cacheSize: 1000,           // Number of categorizations to cache
    cacheExpiration: 86400000, // Cache expiration in ms (24 hours)
    enableLearning: true       // Enable adaptive learning
  }
});

// Initialize with categorizer enabled
await context.initialize({
  initializeCategorizer: true
});
```

### Storing Prompts with Automatic Categorization

Use the `storePromptAndOutput` method to store a prompt and its output with automatic categorization:

```typescript
const prompt = 'Explain how JavaScript promises work.';
const output = 'JavaScript promises are objects that represent...';

// Store with automatic categorization
const chunkId = await context.storePromptAndOutput(prompt, output);
```

### Manual Override with Feedback

You can override the automatic categorization and provide feedback to improve future categorizations:

```typescript
const prompt = 'What are the best practices for data visualization?';
const output = 'When creating data visualizations, follow these best practices...';

// Override with a specific bucket
const chunkId = await context.storePromptAndOutput(
  prompt,
  output,
  {
    overrideBucket: {
      name: 'visualization',
      domain: 'data'
    }
  }
);
```

### Updating the Categorizer

If you add new buckets or make significant changes to your content, you should update the categorizer:

```typescript
await context.updateCategorizer();
```

## How It Works

### Categorization Process

1. **Cache Check**: First, the system checks if the prompt has been categorized before
2. **Strategy Application**: If not in cache, it applies each strategy in sequence:
   - Keyword matching (fastest)
   - Vector similarity (more accurate but slower)
   - Adaptive learning (if enabled)
3. **Result Selection**: The best match is selected based on confidence scores
4. **Caching**: The result is cached for future use

### Bucket Initialization

The categorizer automatically initializes categories from existing buckets:

1. **Keyword Extraction**: Extracts keywords from bucket content
2. **Pattern Generation**: Generates regex patterns from keywords
3. **Embedding Generation**: Creates representative embeddings for vector similarity

## Advanced Configuration

### Custom Thresholds

You can configure the confidence thresholds for each strategy:

```typescript
const context = new InfiniteContext({
  openai,
  categorizerOptions: {
    defaultThresholds: {
      keywordMatchThreshold: 0.3,     // Minimum keyword match score (0-1)
      vectorSimilarityThreshold: 0.7  // Minimum similarity score (0-1)
    }
  }
});
```

### Metadata and Tags

You can include additional metadata and tags when storing prompts:

```typescript
const chunkId = await context.storePromptAndOutput(
  prompt,
  output,
  {
    metadata: {
      source: 'user-question',
      tags: ['javascript', 'async', 'programming']
    }
  }
);
```

## Performance Considerations

- **Cache Size**: Adjust the cache size based on your application's memory constraints and categorization frequency
- **Learning**: Adaptive learning improves accuracy but requires more memory
- **Embeddings**: Vector similarity requires embedding generation, which can be computationally expensive

## Example

See the complete example in `examples/categorization-example.ts` for a demonstration of how to use the categorization system.

## API Reference

### InfiniteContext Constructor Options

```typescript
interface CategorizerOptions {
  cacheSize?: number;         // Maximum number of entries in the cache
  cacheExpiration?: number;   // Time in milliseconds before cache entries expire
  enableLearning?: boolean;   // Whether to enable adaptive learning
  defaultThresholds?: {
    keywordMatchThreshold: number;    // Minimum keyword match score (0-1)
    vectorSimilarityThreshold: number; // Minimum similarity score (0-1)
  };
}

// Used in InfiniteContext constructor
interface InfiniteContextOptions {
  // ... other options
  categorizerOptions?: CategorizerOptions;
}
```

### storePromptAndOutput Method

```typescript
interface StorePromptAndOutputOptions {
  metadata?: Partial<Omit<Metadata, 'id' | 'timestamp'>>;
  summarize?: boolean;
  preferredTier?: StorageTier;
  overrideBucket?: { name: string, domain: string };
}

// Method signature
storePromptAndOutput(
  prompt: string,
  output: string,
  options?: StorePromptAndOutputOptions
): Promise<string>;
```

### updateCategorizer Method

```typescript
// Method signature
updateCategorizer(): Promise<void>;
```
