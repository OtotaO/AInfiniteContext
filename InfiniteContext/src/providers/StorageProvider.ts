import { ChunkLocation, StorageQuota, StorageTier } from '../core/types.js';

/**
 * Base interface for storage providers.
 * 
 * Storage providers are responsible for storing and retrieving chunks across
 * different storage systems, from local disk to cloud services.
 */
export interface StorageProvider {
  /**
   * Get the unique ID of this storage provider
   */
  getId(): string;
  
  /**
   * Get the name of this storage provider
   */
  getName(): string;
  
  /**
   * Get the storage tier of this provider
   */
  getTier(): StorageTier;
  
  /**
   * Check if this provider is connected and available
   */
  isConnected(): Promise<boolean>;
  
  /**
   * Connect to the storage provider
   */
  connect(): Promise<boolean>;
  
  /**
   * Disconnect from the storage provider
   */
  disconnect(): Promise<void>;
  
  /**
   * Store data in the provider
   * 
   * @param data - The data to store
   * @param metadata - Optional metadata to associate with the data
   * @returns A location that can be used to retrieve the data
   */
  store(data: Buffer | string, metadata?: Record<string, unknown>): Promise<ChunkLocation>;
  
  /**
   * Retrieve data from the provider
   * 
   * @param location - The location to retrieve data from
   * @returns The retrieved data
   */
  retrieve(location: ChunkLocation): Promise<Buffer>;
  
  /**
   * Check if data exists at the given location
   * 
   * @param location - The location to check
   * @returns True if data exists, false otherwise
   */
  exists(location: ChunkLocation): Promise<boolean>;
  
  /**
   * Delete data from the provider
   * 
   * @param location - The location to delete data from
   * @returns True if data was deleted, false otherwise
   */
  delete(location: ChunkLocation): Promise<boolean>;
  
  /**
   * Get the current storage quota and usage
   * 
   * @returns The current storage quota
   */
  getQuota(): Promise<StorageQuota>;
}
