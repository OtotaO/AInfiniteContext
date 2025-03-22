import { v4 as uuidv4 } from 'uuid';
import { Vector, Chunk, SearchResult, BucketConfig, ChunkSummary } from './types.js';
import { VectorStore } from './VectorStore.js';

/**
 * Bucket class for organizing chunks into domains and hierarchies.
 * 
 * Buckets can contain chunks and sub-buckets, forming a hierarchical structure
 * for organizing information by domain, topic, or any other classification.
 */
export class Bucket {
  private id: string;
  private name: string;
  private domain: string;
  private description?: string;
  private vectorStore: VectorStore;
  private subBuckets: Map<string, Bucket> = new Map();
  private parentId?: string;

  /**
   * Create a new Bucket
   * 
   * @param config - The bucket configuration
   * @param vectorStore - Optional vector store to use (will create one if not provided)
   */
  constructor(config: BucketConfig, vectorStore?: VectorStore) {
    this.id = config.id || uuidv4();
    this.name = config.name;
    this.domain = config.domain;
    this.description = config.description;
    this.parentId = config.parentId;
    this.vectorStore = vectorStore || new VectorStore();
  }

  /**
   * Get the bucket ID
   */
  public getId(): string {
    return this.id;
  }

  /**
   * Get the bucket name
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Get the bucket domain
   */
  public getDomain(): string {
    return this.domain;
  }

  /**
   * Get the bucket description
   */
  public getDescription(): string | undefined {
    return this.description;
  }

  /**
   * Get the parent bucket ID
   */
  public getParentId(): string | undefined {
    return this.parentId;
  }

  /**
   * Add a chunk to the bucket
   * 
   * @param chunk - The chunk to add
   * @returns The ID of the chunk in the vector store
   */
  public addChunk(chunk: Chunk): number {
    // Ensure the chunk has the correct domain
    chunk.metadata.domain = this.domain;
    return this.vectorStore.addChunk(chunk);
  }

  /**
   * Add multiple chunks to the bucket
   * 
   * @param chunks - The chunks to add
   * @returns The IDs of the chunks in the vector store
   */
  public addChunks(chunks: Chunk[]): number[] {
    // Ensure all chunks have the correct domain
    for (const chunk of chunks) {
      chunk.metadata.domain = this.domain;
    }
    return this.vectorStore.addChunks(chunks);
  }

  /**
   * Search for chunks in the bucket
   * 
   * @param queryVector - The query vector
   * @param k - The number of results to return
   * @param recursive - Whether to search in sub-buckets
   * @returns The search results
   */
  public search(queryVector: Vector, k: number = 10, recursive: boolean = true): SearchResult[] {
    let results = this.vectorStore.search(queryVector, k);
    
    if (recursive && this.subBuckets.size > 0) {
      // Get results from all sub-buckets
      const subResults: SearchResult[] = [];
      for (const subBucket of this.subBuckets.values()) {
        subResults.push(...subBucket.search(queryVector, k, true));
      }
      
      // Combine results
      results = [...results, ...subResults];
      
      // Sort by score
      results.sort((a, b) => b.score - a.score);
      
      // Limit to k results
      if (results.length > k) {
        results = results.slice(0, k);
      }
    }
    
    return results;
  }

  /**
   * Add a sub-bucket
   * 
   * @param config - The sub-bucket configuration
   * @returns The created sub-bucket
   */
  public addSubBucket(config: Omit<BucketConfig, 'parentId'>): Bucket {
    const fullConfig: BucketConfig = {
      ...config,
      parentId: this.id
    };
    
    const subBucket = new Bucket(fullConfig);
    this.subBuckets.set(subBucket.getId(), subBucket);
    
    return subBucket;
  }

  /**
   * Get a sub-bucket by ID
   * 
   * @param id - The sub-bucket ID
   * @returns The sub-bucket, or undefined if not found
   */
  public getSubBucket(id: string): Bucket | undefined {
    return this.subBuckets.get(id);
  }

  /**
   * Remove a sub-bucket
   * 
   * @param id - The sub-bucket ID
   * @returns True if the sub-bucket was removed, false if not found
   */
  public removeSubBucket(id: string): boolean {
    return this.subBuckets.delete(id);
  }

  /**
   * Get all sub-buckets
   * 
   * @returns A map of sub-bucket IDs to sub-buckets
   */
  public getSubBuckets(): Map<string, Bucket> {
    return new Map(this.subBuckets);
  }

  /**
   * Get a flat array of all chunks in this bucket and optionally sub-buckets
   * 
   * @param recursive - Whether to include chunks from sub-buckets
   * @returns An array of chunks
   */
  public getAllChunks(recursive: boolean = true): Chunk[] {
    const chunks: Chunk[] = [];
    
    // Add chunks from this bucket's vector store
    for (let i = 0; i < this.vectorStore.size(); i++) {
      const results = this.vectorStore.search([], 1);
      if (results.length > 0) {
        chunks.push(results[0].chunk);
      }
    }
    
    // Add chunks from sub-buckets if recursive
    if (recursive) {
      for (const subBucket of this.subBuckets.values()) {
        chunks.push(...subBucket.getAllChunks(true));
      }
    }
    
    return chunks;
  }

  /**
   * Get the total number of chunks in this bucket and optionally sub-buckets
   * 
   * @param recursive - Whether to include chunks from sub-buckets
   * @returns The number of chunks
   */
  public getChunkCount(recursive: boolean = true): number {
    let count = this.vectorStore.size();
    
    if (recursive) {
      for (const subBucket of this.subBuckets.values()) {
        count += subBucket.getChunkCount(true);
      }
    }
    
    return count;
  }

  /**
   * Generate a summary of this bucket's contents
   * 
   * @param maxChunks - The maximum number of chunks to include in the summary
   * @returns A summary of the bucket's contents
   */
  public summarize(maxChunks: number = 10): string {
    const chunks = this.getAllChunks();
    const chunkCount = chunks.length;
    
    // If there are no chunks, return a simple summary
    if (chunkCount === 0) {
      return `Bucket "${this.name}" (${this.domain}) contains no chunks.`;
    }
    
    // Get the most recent chunks
    chunks.sort((a, b) => 
      new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime()
    );
    
    const recentChunks = chunks.slice(0, maxChunks);
    
    // Extract summaries from chunks
    const summaries = recentChunks.flatMap(chunk => 
      chunk.summaries
        .filter(summary => summary.level === 1) // Use highest-level summaries
        .map(summary => summary.content)
    );

    // Combine into a single summary
    return `Bucket "${this.name}" (${this.domain}) contains ${chunkCount} chunks. 
Recent content includes: ${summaries.join(' ')}`;
  }
}
