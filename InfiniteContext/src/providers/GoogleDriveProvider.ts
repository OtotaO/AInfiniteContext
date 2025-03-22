import { google } from 'googleapis';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ChunkLocation, StorageQuota, StorageTier } from '../core/types.js';
import { StorageProvider } from './StorageProvider.js';

/**
 * Storage provider that uses Google Drive.
 * 
 * This provider stores data in a designated folder in Google Drive. It requires
 * OAuth credentials to authenticate with the Google Drive API.
 */
export class GoogleDriveProvider implements StorageProvider {
  private id: string;
  private name: string;
  private folderId?: string;
  private credentials: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
  };
  private drive: any; // Google Drive API client
  private connected: boolean = false;

  /**
   * Create a new GoogleDriveProvider
   * 
   * @param id - The unique ID of this provider
   * @param name - The name of this provider
   * @param credentials - OAuth credentials for Google Drive
   * @param folderId - The ID of the folder to store data in (will create one if not provided)
   */
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
  ) {
    this.id = id;
    this.name = name;
    this.credentials = credentials;
    this.folderId = folderId;
  }

  /**
   * Get the unique ID of this storage provider
   */
  public getId(): string {
    return this.id;
  }

  /**
   * Get the name of this storage provider
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Get the storage tier of this provider
   */
  public getTier(): StorageTier {
    return StorageTier.CLOUD;
  }

  /**
   * Check if this provider is connected and available
   */
  public async isConnected(): Promise<boolean> {
    return this.connected;
  }

  /**
   * Connect to the storage provider
   * 
   * For Google Drive, this sets up the OAuth client and ensures the storage folder exists
   */
  public async connect(): Promise<boolean> {
    try {
      // Set up OAuth client
      const oAuth2Client = new google.auth.OAuth2(
        this.credentials.clientId,
        this.credentials.clientSecret,
        this.credentials.redirectUri
      );

      oAuth2Client.setCredentials({
        refresh_token: this.credentials.refreshToken
      });

      // Create Drive API client
      this.drive = google.drive({
        version: 'v3',
        auth: oAuth2Client
      });

      // If no folder ID was provided, create or find the InfiniteContext folder
      if (!this.folderId) {
        this.folderId = await this.findOrCreateFolder('InfiniteContext');
      }

      this.connected = true;
      return true;
    } catch (error) {
      console.error(`Failed to connect to Google Drive provider: ${error}`);
      return false;
    }
  }

  /**
   * Disconnect from the storage provider
   */
  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Store data in the provider
   * 
   * @param data - The data to store
   * @param metadata - Optional metadata to associate with the data
   * @returns A location that can be used to retrieve the data
   */
  public async store(data: Buffer | string, metadata?: Record<string, unknown>): Promise<ChunkLocation> {
    if (!this.connected || !this.folderId) {
      throw new Error('Provider not connected');
    }

    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    
    // Generate a unique file name
    const key = uuidv4();
    
    // Create a readable stream from the buffer
    const { Readable } = await import('stream');
    const stream = new Readable();
    stream.push(dataBuffer);
    stream.push(null); // Signals end of stream
    
    // Upload the file to Google Drive
    const fileResponse = await this.drive.files.create({
      requestBody: {
        name: key,
        parents: [this.folderId],
        properties: metadata ? this.flattenMetadata(metadata) : undefined
      },
      media: {
        body: stream,
        mimeType: 'application/octet-stream'
      },
      fields: 'id'
    });
    
    return {
      providerId: this.id,
      key: fileResponse.data.id
    };
  }

  /**
   * Retrieve data from the provider
   * 
   * @param location - The location to retrieve data from
   * @returns The retrieved data
   */
  public async retrieve(location: ChunkLocation): Promise<Buffer> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    if (location.providerId !== this.id) {
      throw new Error(`Location provider ID ${location.providerId} does not match this provider's ID ${this.id}`);
    }
    
    try {
      // Download the file
      const response = await this.drive.files.get({
        fileId: location.key,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to retrieve data: ${error}`);
    }
  }

  /**
   * Check if data exists at the given location
   * 
   * @param location - The location to check
   * @returns True if data exists, false otherwise
   */
  public async exists(location: ChunkLocation): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    if (location.providerId !== this.id) {
      return false;
    }
    
    try {
      // Try to get file metadata
      await this.drive.files.get({
        fileId: location.key,
        fields: 'id'
      });
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete data from the provider
   * 
   * @param location - The location to delete data from
   * @returns True if data was deleted, false otherwise
   */
  public async delete(location: ChunkLocation): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    if (location.providerId !== this.id) {
      return false;
    }
    
    try {
      // Delete the file
      await this.drive.files.delete({
        fileId: location.key
      });
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current storage quota and usage
   * 
   * @returns The current storage quota
   */
  public async getQuota(): Promise<StorageQuota> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }
    
    try {
      // Get Drive storage quota
      const response = await this.drive.about.get({
        fields: 'storageQuota'
      });
      
      const quota = response.data.storageQuota;
      
      return {
        used: parseInt(quota.usage) || 0,
        total: parseInt(quota.limit) || 0,
        available: parseInt(quota.limit) - parseInt(quota.usage) || 0
      };
    } catch (error) {
      throw new Error(`Failed to get quota: ${error}`);
    }
  }

  /**
   * Find or create a folder in Google Drive
   * 
   * @param folderName - The name of the folder to find or create
   * @returns The ID of the folder
   */
  private async findOrCreateFolder(folderName: string): Promise<string> {
    // First, try to find the folder
    const response = await this.drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)'
    });

    if (response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // If not found, create it
    const folderResponse = await this.drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });

    return folderResponse.data.id;
  }

  /**
   * Flatten a metadata object into key-value pairs compatible with Google Drive properties
   * 
   * @param metadata - The metadata object
   * @returns A flattened object with string values only
   */
  private flattenMetadata(metadata: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      // Google Drive properties only support string values
      if (typeof value === 'string') {
        result[key] = value;
      } else {
        result[key] = JSON.stringify(value);
      }
    }
    
    return result;
  }
}
