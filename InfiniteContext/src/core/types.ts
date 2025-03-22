/**
 * Core type definitions for the Infinite Context system
 */

export type Vector = number[];

export interface Metadata {
  id: string;
  domain: string;
  timestamp: string;
  source: string;
  tags: string[];
  [key: string]: unknown;
}

export interface ChunkSummary {
  level: number;
  content: string;
  concepts: string[];
}

export interface Chunk {
  id: string;
  content: string;
  embedding: Vector;
  metadata: Metadata;
  summaries: ChunkSummary[];
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export interface StorageQuota {
  used: number;
  total: number;
  available: number;
}

export enum StorageTier {
  MEMORY = 0,
  LOCAL = 1,
  CLOUD = 2,
  PLATFORM = 3,
  EXTENDED = 4
}

export interface StorageProviderInfo {
  id: string;
  name: string;
  tier: StorageTier;
  isConnected: boolean;
  quota: StorageQuota;
}

export interface ChunkLocation {
  providerId: string;
  key: string;
}

export type EmbeddingFunction = (text: string) => Promise<Vector>;

export interface BucketConfig {
  id: string;
  name: string;
  domain: string;
  description?: string;
  parentId?: string;
}
