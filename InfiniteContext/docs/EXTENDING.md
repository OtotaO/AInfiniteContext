# Extending InfiniteContext

InfiniteContext is designed to be highly extensible, allowing you to customize and extend its functionality to meet your specific needs. This document explains how to extend the system with custom components.

## Table of Contents

- [Custom Storage Providers](#custom-storage-providers)
- [Custom Vector Stores](#custom-vector-stores)
- [Custom Embedding Functions](#custom-embedding-functions)
- [Custom Summarization](#custom-summarization)
- [Custom Memory Monitoring](#custom-memory-monitoring)
- [Custom Error Handling](#custom-error-handling)
- [Custom Transaction Management](#custom-transaction-management)
- [Custom Data Integrity](#custom-data-integrity)
- [Custom Backup Management](#custom-backup-management)
- [Custom Data Portability](#custom-data-portability)
- [Custom Vector Index Optimization](#custom-vector-index-optimization)

## Custom Storage Providers

One of the most common ways to extend InfiniteContext is by adding custom storage providers. This allows you to integrate with different storage systems, such as cloud storage services, databases, or specialized storage solutions.

### Implementing a Custom Storage Provider

To create a custom storage provider, you need to implement the `StorageProvider` interface:

```typescript
import { StorageProvider, StorageTier, StorageQuota, ChunkLocation } from 'infinite-context';

export class CustomStorageProvider implements StorageProvider {
  private id: string;
  private name: string;
  private tier: StorageTier;
  private isConnectedFlag: boolean = false;

  constructor(
    id: string,
    name: string,
    tier: StorageTier = StorageTier.CLOUD
  ) {
    this.id = id;
    this.name = name;
    this.tier = tier;
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getTier(): StorageTier {
    return this.tier;
  }

  public async isConnected(): Promise<boolean> {
    return this.isConnectedFlag;
  }

  public async connect(): Promise<boolean> {
    // Implement connection logic here
    this.isConnectedFlag = true;
    return true;
  }

  public async disconnect(): Promise<void> {
    // Implement disconnection logic here
    this.isConnectedFlag = false;
  }

  public async store(data: Buffer | string, metadata?: Record<string, unknown>): Promise<ChunkLocation> {
    // Implement storage logic here
    const key = `chunk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Store the data in your custom storage system
    await this.storeData(key, data);
    
    // Return the location where the data was stored
    return {
      providerId: this.id,
      key
    };
  }

  public async retrieve(location: ChunkLocation): Promise<Buffer> {
    // Implement retrieval logic here
    if (location.providerId !== this.id) {
      throw new Error(`Invalid provider ID: ${location.providerId}`);
    }
    
    // Retrieve the data from your custom storage system
    return await this.retrieveData(location.key);
  }

  public async exists(location: ChunkLocation): Promise<boolean> {
    // Implement existence check logic here
    if (location.providerId !== this.id) {
      return false;
    }
    
    // Check if the data exists in your custom storage system
    return await this.dataExists(location.key);
  }

  public async delete(location: ChunkLocation): Promise<boolean> {
    // Implement deletion logic here
    if (location.providerId !== this.id) {
      return false;
    }
    
    // Delete the data from your custom storage system
    return await this.deleteData(location.key);
  }

  public async getQuota(): Promise<StorageQuota> {
    // Implement quota retrieval logic here
    const used = await this.getUsedSpace();
    const total = await this.getTotalSpace();
    
    return {
      used,
      total,
      available: total - used
    };
  }

  // Private methods for interacting with your custom storage system
  private async storeData(key: string, data: Buffer | string): Promise<void> {
    // Implement storage logic specific to your system
  }

  private async retrieveData(key: string): Promise<Buffer> {
    // Implement retrieval logic specific to your system
    return Buffer.from('');
  }

  private async dataExists(key: string): Promise<boolean> {
    // Implement existence check logic specific to your system
    return false;
  }

  private async deleteData(key: string): Promise<boolean> {
    // Implement deletion logic specific to your system
    return false;
  }

  private async getUsedSpace(): Promise<number> {
    // Implement used space calculation logic specific to your system
    return 0;
  }

  private async getTotalSpace(): Promise<number> {
    // Implement total space calculation logic specific to your system
    return 1024 * 1024 * 1024; // 1 GB
  }
}
```

### Registering a Custom Storage Provider

Once you've implemented your custom storage provider, you can register it with the MemoryManager:

```typescript
import { InfiniteContext } from 'infinite-context';
import { CustomStorageProvider } from './CustomStorageProvider';

const context = new InfiniteContext();
await context.initialize();

// Create and connect your custom storage provider
const customProvider = new CustomStorageProvider('custom', 'Custom Storage');
await customProvider.connect();

// Add the provider to the memory manager
context.memoryManager.addStorageProvider(customProvider);
```

### Example: S3 Storage Provider

Here's an example of a storage provider that uses Amazon S3:

```typescript
import { StorageProvider, StorageTier, StorageQuota, ChunkLocation } from 'infinite-context';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export class S3StorageProvider implements StorageProvider {
  private id: string;
  private name: string;
  private tier: StorageTier;
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(
    id: string,
    name: string,
    config: {
      region: string;
      bucket: string;
      prefix?: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
      };
    },
    tier: StorageTier = StorageTier.CLOUD
  ) {
    this.id = id;
    this.name = name;
    this.tier = tier;
    this.bucket = config.bucket;
    this.prefix = config.prefix || '';
    
    this.client = new S3Client({
      region: config.region,
      credentials: config.credentials
    });
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getTier(): StorageTier {
    return this.tier;
  }

  public async isConnected(): Promise<boolean> {
    try {
      // Check if we can list objects in the bucket
      await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
        Prefix: this.prefix
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  public async connect(): Promise<boolean> {
    return await this.isConnected();
  }

  public async disconnect(): Promise<void> {
    // No need to disconnect from S3
  }

  public async store(data: Buffer | string, metadata?: Record<string, unknown>): Promise<ChunkLocation> {
    const key = `${this.prefix}chunk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: typeof data === 'string' ? data : data,
      Metadata: metadata ? this.flattenMetadata(metadata) : undefined
    }));
    
    return {
      providerId: this.id,
      key
    };
  }

  public async retrieve(location: ChunkLocation): Promise<Buffer> {
    if (location.providerId !== this.id) {
      throw new Error(`Invalid provider ID: ${location.providerId}`);
    }
    
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: location.key
    }));
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }

  public async exists(location: ChunkLocation): Promise<boolean> {
    if (location.providerId !== this.id) {
      return false;
    }
    
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: location.key
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  public async delete(location: ChunkLocation): Promise<boolean> {
    if (location.providerId !== this.id) {
      return false;
    }
    
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: location.key
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  public async getQuota(): Promise<StorageQuota> {
    // S3 doesn't have a fixed quota, so we'll return a large number
    const used = await this.getUsedSpace();
    const total = 1024 * 1024 * 1024 * 1024; // 1 TB
    
    return {
      used,
      total,
      available: total - used
    };
  }

  private async getUsedSpace(): Promise<number> {
    let used = 0;
    let continuationToken: string | undefined;
    
    do {
      const response = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
        ContinuationToken: continuationToken
      }));
      
      if (response.Contents) {
        for (const object of response.Contents) {
          used += object.Size || 0;
        }
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    
    return used;
  }

  private flattenMetadata(metadata: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    
    return result;
  }
}
```

## Custom Vector Stores

The default vector store implementation in InfiniteContext is a simple in-memory store. For larger datasets or more advanced search capabilities, you might want to implement a custom vector store.

### Implementing a Custom Vector Store

To create a custom vector store, you can extend the `VectorStore` class or implement a compatible interface:

```typescript
import { Chunk, Vector, SearchResult } from 'infinite-context';

export class CustomVectorStore {
  private dimension: number;
  private metric: 'cosine' | 'euclidean' | 'dot';
  private chunks: Chunk[] = [];
  private indices: number[] = [];

  constructor(
    dimension: number = 1536,
    metric: 'cosine' | 'euclidean' | 'dot' = 'cosine'
  ) {
    this.dimension = dimension;
    this.metric = metric;
  }

  public addChunk(chunk: Chunk): number {
    const index = this.chunks.length;
    this.chunks.push(chunk);
    this.indices.push(index);
    return index;
  }

  public addChunks(chunks: Chunk[]): number[] {
    return chunks.map(chunk => this.addChunk(chunk));
  }

  public search(queryVector: Vector, k: number = 10): SearchResult[] {
    // Implement search logic here
    // This could use a more sophisticated algorithm like HNSW
    
    // For simplicity, we'll just do a linear search
    const scores: Array<{ index: number, score: number }> = [];
    
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      const score = this.calculateSimilarity(queryVector, chunk.embedding);
      scores.push({ index: i, score });
    }
    
    // Sort by score (descending) and limit to k results
    scores.sort((a, b) => b.score - a.score);
    const topK = scores.slice(0, k);
    
    // Convert to SearchResult format
    return topK.map(({ index, score }) => ({
      chunk: this.chunks[index],
      score
    }));
  }

  public size(): number {
    return this.chunks.length;
  }

  private calculateSimilarity(a: Vector, b: Vector): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions do not match: ${a.length} vs ${b.length}`);
    }
    
    if (this.metric === 'cosine') {
      return this.cosineSimilarity(a, b);
    } else if (this.metric === 'euclidean') {
      return this.euclideanSimilarity(a, b);
    } else {
      return this.dotProduct(a, b);
    }
  }

  private cosineSimilarity(a: Vector, b: Vector): number {
    const dotProduct = this.dotProduct(a, b);
    const magnitudeA = Math.sqrt(this.dotProduct(a, a));
    const magnitudeB = Math.sqrt(this.dotProduct(b, b));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private euclideanSimilarity(a: Vector, b: Vector): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    const distance = Math.sqrt(sum);
    // Convert distance to similarity (1 / (1 + distance))
    return 1 / (1 + distance);
  }

  private dotProduct(a: Vector, b: Vector): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }
}
```

### Using a Custom Vector Store with Buckets

To use your custom vector store with buckets, you can pass it to the bucket constructor:

```typescript
import { Bucket, BucketConfig } from 'infinite-context';
import { CustomVectorStore } from './CustomVectorStore';

const bucketConfig: BucketConfig = {
  id: 'custom-bucket',
  name: 'Custom Bucket',
  domain: 'custom',
  description: 'A bucket with a custom vector store'
};

const vectorStore = new CustomVectorStore(1536, 'cosine');
const bucket = new Bucket(bucketConfig, vectorStore);
```

### Example: FAISS Vector Store

Here's an example of a vector store that uses FAISS (Facebook AI Similarity Search) for efficient similarity search:

```typescript
import { Chunk, Vector, SearchResult } from 'infinite-context';
import * as faiss from 'node-faiss';

export class FaissVectorStore {
  private dimension: number;
  private metric: 'cosine' | 'euclidean' | 'dot';
  private chunks: Chunk[] = [];
  private indices: number[] = [];
  private index: any;

  constructor(
    dimension: number = 1536,
    metric: 'cosine' | 'euclidean' | 'dot' = 'cosine'
  ) {
    this.dimension = dimension;
    this.metric = metric;
    
    // Create a FAISS index
    if (metric === 'cosine') {
      this.index = new faiss.IndexFlatIP(dimension);
    } else if (metric === 'euclidean') {
      this.index = new faiss.IndexFlatL2(dimension);
    } else {
      this.index = new faiss.IndexFlatIP(dimension);
    }
  }

  public addChunk(chunk: Chunk): number {
    const index = this.chunks.length;
    this.chunks.push(chunk);
    this.indices.push(index);
    
    // Add the embedding to the FAISS index
    this.index.add([chunk.embedding]);
    
    return index;
  }

  public addChunks(chunks: Chunk[]): number[] {
    const indices: number[] = [];
    const embeddings: Vector[] = [];
    
    for (const chunk of chunks) {
      const index = this.chunks.length;
      this.chunks.push(chunk);
      this.indices.push(index);
      indices.push(index);
      embeddings.push(chunk.embedding);
    }
    
    // Add the embeddings to the FAISS index
    this.index.add(embeddings);
    
    return indices;
  }

  public search(queryVector: Vector, k: number = 10): SearchResult[] {
    // Search the FAISS index
    const result = this.index.search(queryVector, k);
    
    // Convert to SearchResult format
    const searchResults: SearchResult[] = [];
    
    for (let i = 0; i < result.labels.length; i++) {
      const label = result.labels[i];
      const score = result.distances[i];
      
      if (label >= 0 && label < this.chunks.length) {
        searchResults.push({
          chunk: this.chunks[label],
          score: this.metric === 'euclidean' ? 1 / (1 + score) : score
        });
      }
    }
    
    return searchResults;
  }

  public size(): number {
    return this.chunks.length;
  }
}
```

## Custom Embedding Functions

InfiniteContext uses embeddings to represent chunks of text in a high-dimensional space. By default, it uses OpenAI's embedding models, but you can provide your own embedding function.

### Implementing a Custom Embedding Function

An embedding function is simply a function that takes a string and returns a vector (array of numbers):

```typescript
import { Vector } from 'infinite-context';

export async function customEmbedding(text: string): Promise<Vector> {
  // Implement your embedding logic here
  // This could use a local model, a different API, or a custom algorithm
  
  // For simplicity, we'll just return a random vector
  const dimension = 1536;
  const vector: Vector = [];
  
  for (let i = 0; i < dimension; i++) {
    vector.push(Math.random() * 2 - 1); // Random value between -1 and 1
  }
  
  return vector;
}
```

### Using a Custom Embedding Function

To use your custom embedding function, pass it to the InfiniteContext constructor:

```typescript
import { InfiniteContext } from 'infinite-context';
import { customEmbedding } from './customEmbedding';

const context = new InfiniteContext({
  embeddingFunction: customEmbedding
});

await context.initialize();
```

### Example: Sentence Transformers Embedding

Here's an example of an embedding function that uses the Sentence Transformers library:

```typescript
import { Vector } from 'infinite-context';
import * as tf from '@tensorflow/tfjs-node';
import * as use from '@tensorflow-models/universal-sentence-encoder';

let model: any = null;

export async function sentenceTransformerEmbedding(text: string): Promise<Vector> {
  // Load the model if it's not already loaded
  if (!model) {
    model = await use.load();
  }
  
  // Generate embeddings
  const embeddings = await model.embed([text]);
  
  // Convert to array
  const vector = Array.from(await embeddings.array())[0] as Vector;
  
  return vector;
}
```

## Custom Summarization

InfiniteContext includes a summarization engine that generates summaries of text at different levels of detail. You can customize this by providing your own summarization logic.

### Implementing a Custom Summarization Engine

To create a custom summarization engine, you can extend the `SummarizationEngine` class or implement a compatible interface:

```typescript
import { ChunkSummary } from 'infinite-context';

export class CustomSummarizationEngine {
  constructor() {
    // Initialize your summarization engine
  }

  public async summarize(text: string, levels: number = 3): Promise<ChunkSummary[]> {
    // Implement your summarization logic here
    const summaries: ChunkSummary[] = [];
    
    for (let level = 1; level <= levels; level++) {
      const summary = await this.generateSummary(text, level);
      summaries.push(summary);
    }
    
    return summaries;
  }

  public async extractConcepts(text: string): Promise<string[]> {
    // Implement your concept extraction logic here
    const concepts: string[] = [];
    
    // For simplicity, we'll just split the text and take the first few words
    const words = text.split(/\s+/).filter(word => word.length > 3);
    const uniqueWords = Array.from(new Set(words));
    
    return uniqueWords.slice(0, 5);
  }

  private async generateSummary(text: string, level: number): Promise<ChunkSummary> {
    // Implement your summary generation logic here
    let content = '';
    
    if (level === 1) {
      // High-level summary (1-2 sentences)
      content = text.split('.')[0] + '.';
    } else if (level === 2) {
      // Medium-level summary (paragraph)
      const sentences = text.split('.');
      content = sentences.slice(0, 3).join('.') + '.';
    } else {
      // Detailed summary (multiple paragraphs)
      content = text.substring(0, 500) + '...';
    }
    
    const concepts = await this.extractConcepts(content);
    
    return {
      level,
      content,
      concepts
    };
  }
}
```

### Using a Custom Summarization Engine

To use your custom summarization engine, you'll need to modify the MemoryManager to use it:

```typescript
import { InfiniteContext, MemoryManager } from 'infinite-context';
import { CustomSummarizationEngine } from './CustomSummarizationEngine';

// Create a custom memory manager that uses your summarization engine
class CustomMemoryManager extends MemoryManager {
  private customSummarizationEngine: CustomSummarizationEngine;

  constructor(options: any = {}) {
    super(options);
    this.customSummarizationEngine = new CustomSummarizationEngine();
  }

  protected async generateSummaries(content: string): Promise<any[]> {
    return this.customSummarizationEngine.summarize(content);
  }
}

// Create a custom InfiniteContext that uses your memory manager
class CustomInfiniteContext extends InfiniteContext {
  constructor(options: any = {}) {
    super(options);
    this.memoryManager = new CustomMemoryManager(options);
  }
}

// Use your custom InfiniteContext
const context = new CustomInfiniteContext();
await context.initialize();
```

## Custom Memory Monitoring

InfiniteContext includes a memory monitoring system that tracks usage across buckets and storage providers. You can customize this by providing your own monitoring logic.

### Implementing a Custom Memory Monitor

To create a custom memory monitor, you can extend the `MemoryMonitor` class or implement a compatible interface:

```typescript
import { Bucket, StorageProvider, MemoryAlert } from 'infinite-context';

export class CustomMemoryMonitor {
  private buckets: Map<string, Bucket> = new Map();
  private providers: Map<string, StorageProvider> = new Map();
  private alerts: MemoryAlert[] = [];
  private alertHandlers: Array<(alert: MemoryAlert) => void> = [];
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring: boolean = false;

  constructor() {
    // Initialize your memory monitor
  }

  public registerBuckets(buckets: Map<string, Bucket>): void {
    this.buckets = new Map(buckets);
  }

  public registerProviders(providers: Map<string, StorageProvider>): void {
    this.providers = new Map(providers);
  }

  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    
    // Perform initial check
    this.checkMemoryUsage();
    
    // Set up interval for regular checks
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 60000); // 1 minute
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  public getAlerts(includeAcknowledged: boolean = false): MemoryAlert[] {
    if (includeAcknowledged) {
      return [...this.alerts];
    }
    
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    
    return false;
  }

  public addAlertHandler(handler: (alert: MemoryAlert) => void): void {
    this.alertHandlers.push(handler);
  }

  public removeAlertHandler(handler: (alert: MemoryAlert) => void): boolean {
    const index = this.alertHandlers.indexOf(handler);
    if (index >= 0) {
      this.alertHandlers.splice(index, 1);
      return true;
    }
    return false;
  }

  public async getMemoryStats(): Promise<any> {
    // Implement your memory statistics logic here
    return {
      bucketStats: [],
      providerStats: [],
      domainStats: [],
      totalStats: {
        chunkCount: 0,
        estimatedSizeMB: 0,
        availableStorageMB: 0
      }
    };
  }

  private async checkMemoryUsage(): Promise<void> {
    // Implement your memory usage checking logic here
    // Generate alerts as needed
  }

  private generateAlert(alert: Omit<MemoryAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const fullAlert: MemoryAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alert
    };
    
    this.alerts.push(fullAlert);
    
    // Notify alert handlers
    for (const handler of this.alertHandlers) {
      try {
        handler(fullAlert);
      } catch (error) {
        console.error('Error in memory alert handler:', error);
      }
    }
  }
}
```

### Using a Custom Memory Monitor

To use your custom memory monitor, you'll need to modify the MemoryManager to use it:

```typescript
import { InfiniteContext, MemoryManager } from 'infinite-context';
import { CustomMemoryMonitor } from './CustomMemoryMonitor';

// Create a custom memory manager that uses your memory monitor
class CustomMemoryManager extends MemoryManager {
  private customMemoryMonitor: CustomMemoryMonitor;

  constructor(options: any = {}) {
    super(options);
    this.customMemoryMonitor = new CustomMemoryMonitor();
  }

  public startMemoryMonitoring(): void {
    this.customMemoryMonitor.registerBuckets(this.rootBuckets);
    this.customMemoryMonitor.registerProviders(this.storageProviders);
    this.customMemoryMonitor.startMonitoring();
  }

  public stopMemoryMonitoring(): void {
    this.customMemoryMonitor.stopMonitoring();
  }

  public getMemoryAlerts(includeAcknowledged: boolean = false): any[] {
    return this.customMemoryMonitor.getAlerts(includeAcknowledged);
  }

  public acknowledgeMemoryAlert(alertId: string): boolean {
    return this.customMemoryMonitor.acknowledgeAlert(alertId);
  }

  public addAlertHandler(handler: (alert: any) => void): void {
    this.customMemoryMonitor.addAlertHandler(handler);
  }

  public removeAlertHandler(handler: (alert: any) => void): boolean {
    return this.customMemoryMonitor.removeAlertHandler(handler);
  }

  public async getMemoryStats(): Promise<any> {
    return this.customMemoryMonitor.getMemoryStats();
  }
}

// Create a custom InfiniteContext that uses your memory manager
class CustomInfiniteContext extends InfiniteContext {
  constructor(options: any = {}) {
    super(options);
    this.memoryManager = new CustomMemoryManager(options);
  }
}

// Use your custom InfiniteContext
const context = new CustomInfiniteContext();
await context.initialize();
```

## Custom Error Handling

InfiniteContext includes a robust error handling system that provides detailed error information and recovery mechanisms. You can customize this by providing your own error handling logic.

### Implementing a Custom Error Handler

To create a custom error handler, you can implement the `ErrorHandler` interface:

```typescript
import { ErrorHandler, ErrorType, ErrorContext, ErrorOptions } from 'infinite-context';

export class CustomErrorHandler implements ErrorHandler {
  private errorListeners: Array<(error: Error, context?: ErrorContext) => void> = [];

  constructor() {
    // Initialize your error handler
  }

  public handleError(error: Error, context?: ErrorContext, options?: ErrorOptions): void {
    // Implement your error handling logic here
    
    // Log the error
    console.error(`[${new Date().toISOString()}] Error:`, error.message);
    
    if (context) {
      console.error('Context:', JSON.stringify(context));
    }
    
    // Notify error listeners
    for (const listener of this.errorListeners) {
      try {
        listener(error, context);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    }
    
    // Handle specific error types
    if (options?.throwError !== false) {
      throw error;
    }
  }

  public addErrorListener(listener: (error: Error, context?: ErrorContext) => void): void {
    this.errorListeners.push(listener);
  }

  public removeErrorListener(listener: (error: Error, context?: ErrorContext) => void): boolean {
    const index = this.errorListeners.indexOf(listener);
    if (index >= 0) {
      this.
