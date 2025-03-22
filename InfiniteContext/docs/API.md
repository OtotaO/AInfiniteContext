# InfiniteContext API Reference

This document provides a comprehensive reference for the InfiniteContext API, including all public classes, methods, and interfaces.

## Table of Contents

- [Main API](#main-api)
- [Core Components](#core-components)
- [Storage Providers](#storage-providers)
- [Summarization](#summarization)
- [Types](#types)

## Main API

### InfiniteContext

The main entry point for using the system. Provides a simplified API for common operations.

#### Constructor

```typescript
constructor(options: {
  basePath?: string;
  openai?: OpenAI;
  embeddingModel?: string;
  llmModel?: string;
  googleDriveCredentials?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
  };
} = {})
```

Creates a new InfiniteContext instance with the specified options:

- `basePath`: The base path for storing data (default: `~/.infinite-context`)
- `openai`: An instance of the OpenAI client for embeddings and summarization
- `embeddingModel`: The OpenAI embedding model to use (default: `text-embedding-3-small`)
- `llmModel`: The OpenAI language model to use (default: `gpt-3.5-turbo`)
- `googleDriveCredentials`: Credentials for Google Drive integration

#### Methods

##### initialize

```typescript
async initialize(options: {
  addGoogleDrive?: boolean;
  googleDriveCredentials?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
  };
  enableMemoryMonitoring?: boolean;
  memoryMonitoringConfig?: Partial<{
    bucketSizeThresholdMB: number;
    providerCapacityThresholdPercent: number;
    domainGrowthThresholdPercent: number;
    monitoringIntervalMs: number;
  }>;
} = {}): Promise<void>
```

Initializes the system with the specified options:

- `addGoogleDrive`: Whether to add Google Drive as a storage provider
- `googleDriveCredentials`: Credentials for Google Drive integration
- `enableMemoryMonitoring`: Whether to enable memory monitoring
- `memoryMonitoringConfig`: Configuration for memory monitoring

##### storeContent

```typescript
async storeContent(
  content: string,
  options: {
    bucketName?: string;
    bucketDomain?: string;
    metadata?: Partial<Omit<Metadata, 'id' | 'timestamp'>>;
    summarize?: boolean;
    preferredTier?: StorageTier;
  } = {}
): Promise<string>
```

Stores content in the system and returns the ID of the created chunk:

- `content`: The content to store
- `bucketName`: The name of the bucket to store the content in (default: `default`)
- `bucketDomain`: The domain of the bucket (default: `general`)
- `metadata`: Additional metadata to associate with the content
- `summarize`: Whether to generate summaries for the content (default: `true`)
- `preferredTier`: The preferred storage tier (default: `StorageTier.LOCAL`)

##### retrieveContent

```typescript
async retrieveContent(
  query: string,
  options: {
    bucketName?: string;
    bucketDomain?: string;
    maxResults?: number;
    minScore?: number;
  } = {}
): Promise<Array<{ chunk: Chunk, score: number }>>
```

Retrieves content from the system based on a query:

- `query`: The query to search for
- `bucketName`: The name of the bucket to search in (optional)
- `bucketDomain`: The domain of the bucket to search in (optional)
- `maxResults`: The maximum number of results to return (default: `10`)
- `minScore`: The minimum similarity score for results (default: `0.7`)

##### summarize

```typescript
async summarize(
  text: string,
  options: {
    levels?: number;
  } = {}
): Promise<string[]>
```

Generates summaries for a piece of text:

- `text`: The text to summarize
- `levels`: The number of summary levels to generate (default: `1`)

##### getMemoryStats

```typescript
async getMemoryStats(): Promise<any>
```

Gets memory usage statistics for the system.

##### getMemoryAlerts

```typescript
getMemoryAlerts(includeAcknowledged: boolean = false): any[]
```

Gets current memory alerts:

- `includeAcknowledged`: Whether to include acknowledged alerts (default: `false`)

##### acknowledgeMemoryAlert

```typescript
acknowledgeMemoryAlert(alertId: string): boolean
```

Acknowledges a memory alert:

- `alertId`: The ID of the alert to acknowledge

##### addMemoryAlertHandler

```typescript
addMemoryAlertHandler(handler: (alert: any) => void): void
```

Adds a memory alert handler:

- `handler`: The handler function to add

## Core Components

### MemoryManager

The central coordinator of the system. Manages buckets, storage providers, and memory monitoring.

#### Constructor

```typescript
constructor(options: {
  basePath?: string;
  embeddingFunction?: (text: string) => Promise<Vector>;
  monitoringConfig?: Partial<{
    bucketSizeThresholdMB: number;
    providerCapacityThresholdPercent: number;
    domainGrowthThresholdPercent: number;
    monitoringIntervalMs: number;
  }>;
} = {})
```

Creates a new MemoryManager instance with the specified options:

- `basePath`: The base path for storing data (default: `~/.infinite-context`)
- `embeddingFunction`: A function that generates embeddings for text
- `monitoringConfig`: Configuration for memory monitoring

#### Methods

##### initialize

```typescript
async initialize(options: {
  localStoragePath?: string;
} = {}): Promise<void>
```

Initializes the memory manager:

- `localStoragePath`: The path for local storage (default: `{basePath}/storage`)

##### addStorageProvider

```typescript
addStorageProvider(provider: StorageProvider): boolean
```

Adds a storage provider:

- `provider`: The storage provider to add

##### getStorageProvider

```typescript
getStorageProvider(id: string): StorageProvider | undefined
```

Gets a storage provider by ID:

- `id`: The ID of the provider to get

##### removeStorageProvider

```typescript
removeStorageProvider(id: string): boolean
```

Removes a storage provider:

- `id`: The ID of the provider to remove

##### getStorageProviders

```typescript
getStorageProviders(): Map<string, StorageProvider>
```

Gets all storage providers.

##### createBucket

```typescript
createBucket(config: Omit<BucketConfig, 'id'>): Bucket
```

Creates a new bucket:

- `config`: The bucket configuration

##### getBucket

```typescript
getBucket(id: string): Bucket | undefined
```

Gets a bucket by ID:

- `id`: The ID of the bucket to get

##### removeBucket

```typescript
removeBucket(id: string): boolean
```

Removes a bucket:

- `id`: The ID of the bucket to remove

##### getBuckets

```typescript
getBuckets(): Map<string, Bucket>
```

Gets all root buckets.

##### storeChunk

```typescript
async storeChunk(
  chunk: Chunk,
  preferredTier: StorageTier = StorageTier.LOCAL
): Promise<ChunkLocation>
```

Stores a chunk in the appropriate storage provider:

- `chunk`: The chunk to store
- `preferredTier`: The preferred storage tier (default: `StorageTier.LOCAL`)

##### retrieveChunk

```typescript
async retrieveChunk(chunkId: string): Promise<Chunk>
```

Retrieves a chunk from its stored location:

- `chunkId`: The ID of the chunk to retrieve

##### createChunk

```typescript
async createChunk(
  content: string,
  metadata: Partial<Omit<Metadata, 'id' | 'timestamp'>>,
  summarize: boolean = true
): Promise<Chunk>
```

Creates a chunk from text content:

- `content`: The text content
- `metadata`: The chunk metadata
- `summarize`: Whether to generate summaries for the chunk (default: `true`)

##### findRelevantBuckets

```typescript
async findRelevantBuckets(
  query: string | Vector,
  k: number = 3
): Promise<Array<{ bucket: Bucket, score: number }>>
```

Finds the most relevant buckets for a query:

- `query`: The query text or vector
- `k`: The number of buckets to return (default: `3`)

##### addAlertHandler

```typescript
addAlertHandler(handler: (alert: MemoryAlert) => void): void
```

Adds a memory alert handler:

- `handler`: The handler function to add

##### removeAlertHandler

```typescript
removeAlertHandler(handler: (alert: MemoryAlert) => void): boolean
```

Removes a memory alert handler:

- `handler`: The handler function to remove

##### getMemoryAlerts

```typescript
getMemoryAlerts(includeAcknowledged: boolean = false): MemoryAlert[]
```

Gets all current memory alerts:

- `includeAcknowledged`: Whether to include acknowledged alerts (default: `false`)

##### acknowledgeMemoryAlert

```typescript
acknowledgeMemoryAlert(alertId: string): boolean
```

Acknowledges a memory alert:

- `alertId`: The ID of the alert to acknowledge

##### getMemoryStats

```typescript
async getMemoryStats(): Promise<any>
```

Gets memory usage statistics.

##### startMemoryMonitoring

```typescript
startMemoryMonitoring(): void
```

Starts monitoring memory usage.

##### stopMemoryMonitoring

```typescript
stopMemoryMonitoring(): void
```

Stops monitoring memory usage.

### Bucket

Organizes chunks into domains and hierarchies.

#### Constructor

```typescript
constructor(config: BucketConfig, vectorStore?: VectorStore)
```

Creates a new Bucket instance:

- `config`: The bucket configuration
- `vectorStore`: Optional vector store to use (will create one if not provided)

#### Methods

##### getId

```typescript
getId(): string
```

Gets the bucket ID.

##### getName

```typescript
getName(): string
```

Gets the bucket name.

##### getDomain

```typescript
getDomain(): string
```

Gets the bucket domain.

##### getDescription

```typescript
getDescription(): string | undefined
```

Gets the bucket description.

##### getParentId

```typescript
getParentId(): string | undefined
```

Gets the parent bucket ID.

##### addChunk

```typescript
addChunk(chunk: Chunk): number
```

Adds a chunk to the bucket:

- `chunk`: The chunk to add

##### addChunks

```typescript
addChunks(chunks: Chunk[]): number[]
```

Adds multiple chunks to the bucket:

- `chunks`: The chunks to add

##### search

```typescript
search(queryVector: Vector, k: number = 10, recursive: boolean = true): SearchResult[]
```

Searches for chunks in the bucket:

- `queryVector`: The query vector
- `k`: The number of results to return (default: `10`)
- `recursive`: Whether to search in sub-buckets (default: `true`)

##### addSubBucket

```typescript
addSubBucket(config: Omit<BucketConfig, 'parentId'>): Bucket
```

Adds a sub-bucket:

- `config`: The sub-bucket configuration

##### getSubBucket

```typescript
getSubBucket(id: string): Bucket | undefined
```

Gets a sub-bucket by ID:

- `id`: The sub-bucket ID

##### removeSubBucket

```typescript
removeSubBucket(id: string): boolean
```

Removes a sub-bucket:

- `id`: The sub-bucket ID

##### getSubBuckets

```typescript
getSubBuckets(): Map<string, Bucket>
```

Gets all sub-buckets.

##### getAllChunks

```typescript
getAllChunks(recursive: boolean = true): Chunk[]
```

Gets a flat array of all chunks in this bucket and optionally sub-buckets:

- `recursive`: Whether to include chunks from sub-buckets (default: `true`)

##### getChunkCount

```typescript
getChunkCount(recursive: boolean = true): number
```

Gets the total number of chunks in this bucket and optionally sub-buckets:

- `recursive`: Whether to include chunks from sub-buckets (default: `true`)

##### summarize

```typescript
summarize(maxChunks: number = 10): string
```

Generates a summary of this bucket's contents:

- `maxChunks`: The maximum number of chunks to include in the summary (default: `10`)

### VectorStore

Handles storage and retrieval of vectors.

#### Constructor

```typescript
constructor(
  dimension: number = 1536,
  metric: 'cosine' | 'euclidean' | 'dot' = 'cosine',
  path?: string
)
```

Creates a new VectorStore instance:

- `dimension`: The dimensionality of vectors to be stored (default: `1536`)
- `metric`: The distance metric to use (default: `'cosine'`)
- `path`: Optional path for persistence

#### Methods

##### addChunk

```typescript
addChunk(chunk: Chunk): number
```

Adds a chunk to the vector store:

- `chunk`: The chunk to add

##### addChunks

```typescript
addChunks(chunks: Chunk[]): number[]
```

Adds multiple chunks to the vector store:

- `chunks`: The chunks to add

##### search

```typescript
search(queryVector: Vector, k: number = 10): SearchResult[]
```

Searches for chunks similar to the query vector:

- `queryVector`: The query vector
- `k`: The number of results to return (default: `10`)

##### size

```typescript
size(): number
```

Gets the number of chunks in the store.

##### save

```typescript
async save(path?: string): Promise<void>
```

Saves the vector store to a file:

- `path`: The path to save to (optional)

##### load

```typescript
async load(path?: string): Promise<void>
```

Loads the vector store from a file:

- `path`: The path to load from (optional)

### MemoryMonitor

Tracks memory usage across buckets and storage providers.

#### Constructor

```typescript
constructor(config: Partial<MemoryMonitorConfig> = {})
```

Creates a new MemoryMonitor instance:

- `config`: Configuration options

#### Methods

##### registerBuckets

```typescript
registerBuckets(buckets: Map<string, Bucket>): void
```

Registers buckets to monitor:

- `buckets`: Map of bucket IDs to buckets

##### registerProviders

```typescript
registerProviders(providers: Map<string, StorageProvider>): void
```

Registers storage providers to monitor:

- `providers`: Map of provider IDs to providers

##### startMonitoring

```typescript
startMonitoring(): void
```

Starts monitoring memory usage.

##### stopMonitoring

```typescript
stopMonitoring(): void
```

Stops monitoring memory usage.

##### getAlerts

```typescript
getAlerts(includeAcknowledged: boolean = false): MemoryAlert[]
```

Gets all current alerts:

- `includeAcknowledged`: Whether to include acknowledged alerts (default: `false`)

##### acknowledgeAlert

```typescript
acknowledgeAlert(alertId: string): boolean
```

Acknowledges an alert:

- `alertId`: The ID of the alert to acknowledge

##### getMemoryStats

```typescript
async getMemoryStats(): Promise<{
  bucketStats: Array<{ id: string, name: string, domain: string, chunkCount: number, estimatedSizeMB: number }>;
  providerStats: Array<{ id: string, name: string, tier: StorageTier, quota: StorageQuota, usagePercent: number }>;
  domainStats: Array<{ domain: string, chunkCount: number, estimatedSizeMB: number }>;
  totalStats: { chunkCount: number, estimatedSizeMB: number, availableStorageMB: number };
}>
```

Gets memory usage statistics.

## Storage Providers

### StorageProvider

Interface for storage providers.

#### Methods

##### getId

```typescript
getId(): string
```

Gets the unique ID of this storage provider.

##### getName

```typescript
getName(): string
```

Gets the name of this storage provider.

##### getTier

```typescript
getTier(): StorageTier
```

Gets the storage tier of this provider.

##### isConnected

```typescript
isConnected(): Promise<boolean>
```

Checks if this provider is connected and available.

##### connect

```typescript
connect(): Promise<boolean>
```

Connects to the storage provider.

##### disconnect

```typescript
disconnect(): Promise<void>
```

Disconnects from the storage provider.

##### store

```typescript
store(data: Buffer | string, metadata?: Record<string, unknown>): Promise<ChunkLocation>
```

Stores data in the provider:

- `data`: The data to store
- `metadata`: Optional metadata to associate with the data

##### retrieve

```typescript
retrieve(location: ChunkLocation): Promise<Buffer>
```

Retrieves data from the provider:

- `location`: The location to retrieve data from

##### exists

```typescript
exists(location: ChunkLocation): Promise<boolean>
```

Checks if data exists at the given location:

- `location`: The location to check

##### delete

```typescript
delete(location: ChunkLocation): Promise<boolean>
```

Deletes data from the provider:

- `location`: The location to delete data from

##### getQuota

```typescript
getQuota(): Promise<StorageQuota>
```

Gets the current storage quota and usage.

### LocalStorageProvider

Storage provider that uses the local filesystem.

#### Constructor

```typescript
constructor(
  id: string = 'local',
  name: string = 'Local Filesystem',
  basePath: string,
  maxSizeBytes: number = 5 * 1024 * 1024 * 1024 // 5 GB
)
```

Creates a new LocalStorageProvider instance:

- `id`: The unique ID of this provider (default: `'local'`)
- `name`: The name of this provider (default: `'Local Filesystem'`)
- `basePath`: The base path to store data in
- `maxSizeBytes`: The maximum size in bytes this provider can store (default: `5 GB`)

### GoogleDriveProvider

Storage provider that uses Google Drive.

#### Constructor

```typescript
constructor(
  id: string = 'gdrive',
  name: string = 'Google Drive',
  credentials: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
  },
  folderId?: string
)
```

Creates a new GoogleDriveProvider instance:

- `id`: The unique ID of this provider (default: `'gdrive'`)
- `name`: The name of this provider (default: `'Google Drive'`)
- `credentials`: OAuth credentials for Google Drive
- `folderId`: The ID of the folder to store data in (will create one if not provided)

## Summarization

### SummarizationEngine

Generates summaries of text at different levels of detail.

#### Constructor

```typescript
constructor(llmClient: any = null)
```

Creates a new SummarizationEngine instance:

- `llmClient`: An optional LLM client for generating summaries

#### Methods

##### summarize

```typescript
async summarize(text: string, levels: number = 3): Promise<ChunkSummary[]>
```

Generates summaries for a text at different levels of detail:

- `text`: The text to summarize
- `levels`: The number of summary levels to generate (default: `3`)

##### extractConcepts

```typescript
async extractConcepts(text: string): Promise<string[]>
```

Extracts key concepts from text:

- `text`: The text to extract concepts from

##### findRelationships

```typescript
async findRelationships(summaries: Array<{ id: string, summary: ChunkSummary }>): Promise<Map<string, string[]>>
```

Finds relationships between chunks based on their summaries and concepts:

- `summaries`: An array of chunk summaries

## Types

### StorageTier

Enum representing different storage tiers:

```typescript
enum StorageTier {
  MEMORY = 0,
  LOCAL = 1,
  CLOUD = 2,
  PLATFORM = 3,
  EXTENDED = 4
}
```

### Vector

Type alias for a vector:

```typescript
type Vector = number[];
```

### Metadata

Interface for chunk metadata:

```typescript
interface Metadata {
  id: string;
  domain: string;
  timestamp: string;
  source: string;
  tags: string[];
  [key: string]: unknown;
}
```

### ChunkSummary

Interface for chunk summaries:

```typescript
interface ChunkSummary {
  level: number;
  content: string;
  concepts: string[];
}
```

### Chunk

Interface for chunks:

```typescript
interface Chunk {
  id: string;
  content: string;
  embedding: Vector;
  metadata: Metadata;
  summaries: ChunkSummary[];
}
```

### SearchResult

Interface for search results:

```typescript
interface SearchResult {
  chunk: Chunk;
  score: number;
}
```

### StorageQuota

Interface for storage quotas:

```typescript
interface StorageQuota {
  used: number;
  total: number;
  available: number;
}
```

### ChunkLocation

Interface for chunk locations:

```typescript
interface ChunkLocation {
  providerId: string;
  key: string;
}
```

### BucketConfig

Interface for bucket configurations:

```typescript
interface BucketConfig {
  id: string;
  name: string;
  domain: string;
  description?: string;
  parentId?: string;
}
```

### MemoryAlert

Interface for memory alerts:

```typescript
interface MemoryAlert {
  id: string;
  type: 'bucket-size' | 'provider-capacity' | 'domain-growth' | 'system';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: string;
  acknowledged: boolean;
}
```

### MemoryMonitorConfig

Interface for memory monitoring configuration:

```typescript
interface MemoryMonitorConfig {
  bucketSizeThresholdMB: number;
  providerCapacityThresholdPercent: number;
  domainGrowthThresholdPercent: number;
  monitoringIntervalMs: number;
  alertCallback?: (alert: MemoryAlert) => void;
}
