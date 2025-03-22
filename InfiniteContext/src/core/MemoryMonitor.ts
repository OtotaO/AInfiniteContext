import { Bucket } from './Bucket.js';
import { StorageProvider } from '../providers/StorageProvider.js';
import { StorageQuota, StorageTier } from './types.js';

/**
 * Interface for memory usage alerts
 */
export interface MemoryAlert {
  id: string;
  type: 'bucket-size' | 'provider-capacity' | 'domain-growth' | 'system';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: string;
  acknowledged: boolean;
}

/**
 * Memory monitoring configuration
 */
export interface MemoryMonitorConfig {
  bucketSizeThresholdMB: number;
  providerCapacityThresholdPercent: number;
  domainGrowthThresholdPercent: number;
  monitoringIntervalMs: number;
  alertCallback?: (alert: MemoryAlert) => void;
}

/**
 * The MemoryMonitor tracks memory usage across buckets and storage providers,
 * generating alerts when thresholds are exceeded.
 */
export class MemoryMonitor {
  private config: MemoryMonitorConfig;
  private buckets: Map<string, Bucket> = new Map();
  private providers: Map<string, StorageProvider> = new Map();
  private alerts: MemoryAlert[] = [];
  private bucketSizeHistory: Map<string, number[]> = new Map();
  private providerUsageHistory: Map<string, StorageQuota[]> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring: boolean = false;

  /**
   * Create a new MemoryMonitor
   * 
   * @param config - Configuration options
   */
  constructor(config: Partial<MemoryMonitorConfig> = {}) {
    this.config = {
      bucketSizeThresholdMB: config.bucketSizeThresholdMB || 100,
      providerCapacityThresholdPercent: config.providerCapacityThresholdPercent || 80,
      domainGrowthThresholdPercent: config.domainGrowthThresholdPercent || 50,
      monitoringIntervalMs: config.monitoringIntervalMs || 60000, // 1 minute
      alertCallback: config.alertCallback,
    };
  }

  /**
   * Register buckets to monitor
   * 
   * @param buckets - Map of bucket IDs to buckets
   */
  public registerBuckets(buckets: Map<string, Bucket>): void {
    this.buckets = new Map(buckets);
    
    // Initialize history for new buckets
    for (const [id, bucket] of buckets.entries()) {
      if (!this.bucketSizeHistory.has(id)) {
        this.bucketSizeHistory.set(id, []);
      }
    }
  }

  /**
   * Register storage providers to monitor
   * 
   * @param providers - Map of provider IDs to providers
   */
  public registerProviders(providers: Map<string, StorageProvider>): void {
    this.providers = new Map(providers);
    
    // Initialize history for new providers
    for (const [id] of providers.entries()) {
      if (!this.providerUsageHistory.has(id)) {
        this.providerUsageHistory.set(id, []);
      }
    }
  }

  /**
   * Start monitoring memory usage
   */
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
    }, this.config.monitoringIntervalMs);
  }

  /**
   * Stop monitoring memory usage
   */
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

  /**
   * Get all current alerts
   * 
   * @param includeAcknowledged - Whether to include acknowledged alerts
   * @returns Array of alerts
   */
  public getAlerts(includeAcknowledged: boolean = false): MemoryAlert[] {
    if (includeAcknowledged) {
      return [...this.alerts];
    }
    
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge an alert
   * 
   * @param alertId - The ID of the alert to acknowledge
   * @returns True if the alert was found and acknowledged, false otherwise
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    
    return false;
  }

  /**
   * Get memory usage statistics
   * 
   * @returns Memory usage statistics
   */
  public async getMemoryStats(): Promise<{
    bucketStats: Array<{ id: string, name: string, domain: string, chunkCount: number, estimatedSizeMB: number }>;
    providerStats: Array<{ id: string, name: string, tier: StorageTier, quota: StorageQuota, usagePercent: number }>;
    domainStats: Array<{ domain: string, chunkCount: number, estimatedSizeMB: number }>;
    totalStats: { chunkCount: number, estimatedSizeMB: number, availableStorageMB: number };
  }> {
    // Collect bucket statistics
    const bucketStats = [];
    const domainMap = new Map<string, { chunkCount: number, estimatedSizeMB: number }>();
    let totalChunkCount = 0;
    let totalEstimatedSizeMB = 0;
    
    for (const [id, bucket] of this.buckets.entries()) {
      const chunkCount = bucket.getChunkCount(true);
      // Estimate size based on average chunk size of 5KB
      const estimatedSizeMB = (chunkCount * 5) / 1024;
      
      bucketStats.push({
        id,
        name: bucket.getName(),
        domain: bucket.getDomain(),
        chunkCount,
        estimatedSizeMB
      });
      
      // Aggregate by domain
      const domain = bucket.getDomain();
      const domainStats = domainMap.get(domain) || { chunkCount: 0, estimatedSizeMB: 0 };
      domainStats.chunkCount += chunkCount;
      domainStats.estimatedSizeMB += estimatedSizeMB;
      domainMap.set(domain, domainStats);
      
      // Update totals
      totalChunkCount += chunkCount;
      totalEstimatedSizeMB += estimatedSizeMB;
    }
    
    // Collect provider statistics
    const providerStats = [];
    let totalAvailableStorageMB = 0;
    
    for (const [id, provider] of this.providers.entries()) {
      if (await provider.isConnected()) {
        const quota = await provider.getQuota();
        const usagePercent = (quota.used / quota.total) * 100;
        
        providerStats.push({
          id,
          name: provider.getName(),
          tier: provider.getTier(),
          quota,
          usagePercent
        });
        
        // Convert bytes to MB
        totalAvailableStorageMB += quota.available / (1024 * 1024);
      }
    }
    
    // Convert domain map to array
    const domainStats = Array.from(domainMap.entries()).map(([domain, stats]) => ({
      domain,
      ...stats
    }));
    
    return {
      bucketStats,
      providerStats,
      domainStats,
      totalStats: {
        chunkCount: totalChunkCount,
        estimatedSizeMB: totalEstimatedSizeMB,
        availableStorageMB: totalAvailableStorageMB
      }
    };
  }

  /**
   * Check memory usage and generate alerts if thresholds are exceeded
   */
  private async checkMemoryUsage(): Promise<void> {
    try {
      // Check bucket sizes
      await this.checkBucketSizes();
      
      // Check provider capacities
      await this.checkProviderCapacities();
      
      // Check domain growth
      await this.checkDomainGrowth();
    } catch (error) {
      console.error('Error checking memory usage:', error);
      
      // Generate system alert for monitoring error
      this.generateAlert({
        type: 'system',
        severity: 'warning',
        message: 'Error monitoring memory usage',
        details: { error: String(error) }
      });
    }
  }

  /**
   * Check bucket sizes and generate alerts if thresholds are exceeded
   */
  private async checkBucketSizes(): Promise<void> {
    for (const [id, bucket] of this.buckets.entries()) {
      const chunkCount = bucket.getChunkCount(true);
      // Estimate size based on average chunk size of 5KB
      const estimatedSizeMB = (chunkCount * 5) / 1024;
      
      // Update history
      const history = this.bucketSizeHistory.get(id) || [];
      history.push(estimatedSizeMB);
      
      // Keep only the last 10 data points
      if (history.length > 10) {
        history.shift();
      }
      
      this.bucketSizeHistory.set(id, history);
      
      // Check if bucket size exceeds threshold
      if (estimatedSizeMB > this.config.bucketSizeThresholdMB) {
        this.generateAlert({
          type: 'bucket-size',
          severity: estimatedSizeMB > this.config.bucketSizeThresholdMB * 2 ? 'critical' : 'warning',
          message: `Bucket "${bucket.getName()}" (${bucket.getDomain()}) exceeds size threshold`,
          details: {
            bucketId: id,
            bucketName: bucket.getName(),
            bucketDomain: bucket.getDomain(),
            chunkCount,
            estimatedSizeMB,
            threshold: this.config.bucketSizeThresholdMB
          }
        });
      }
    }
  }

  /**
   * Check provider capacities and generate alerts if thresholds are exceeded
   */
  private async checkProviderCapacities(): Promise<void> {
    for (const [id, provider] of this.providers.entries()) {
      if (await provider.isConnected()) {
        const quota = await provider.getQuota();
        const usagePercent = (quota.used / quota.total) * 100;
        
        // Update history
        const history = this.providerUsageHistory.get(id) || [];
        history.push(quota);
        
        // Keep only the last 10 data points
        if (history.length > 10) {
          history.shift();
        }
        
        this.providerUsageHistory.set(id, history);
        
        // Check if provider capacity exceeds threshold
        if (usagePercent > this.config.providerCapacityThresholdPercent) {
          this.generateAlert({
            type: 'provider-capacity',
            severity: usagePercent > 95 ? 'critical' : 'warning',
            message: `Storage provider "${provider.getName()}" exceeds capacity threshold`,
            details: {
              providerId: id,
              providerName: provider.getName(),
              providerTier: provider.getTier(),
              usagePercent,
              usedBytes: quota.used,
              totalBytes: quota.total,
              availableBytes: quota.available,
              threshold: this.config.providerCapacityThresholdPercent
            }
          });
        }
      }
    }
  }

  /**
   * Check domain growth and generate alerts if thresholds are exceeded
   */
  private async checkDomainGrowth(): Promise<void> {
    // Group buckets by domain
    const domainBuckets = new Map<string, Bucket[]>();
    
    for (const bucket of this.buckets.values()) {
      const domain = bucket.getDomain();
      const buckets = domainBuckets.get(domain) || [];
      buckets.push(bucket);
      domainBuckets.set(domain, buckets);
    }
    
    // Check growth for each domain
    for (const [domain, buckets] of domainBuckets.entries()) {
      let currentSize = 0;
      
      for (const bucket of buckets) {
        const chunkCount = bucket.getChunkCount(true);
        // Estimate size based on average chunk size of 5KB
        const estimatedSizeMB = (chunkCount * 5) / 1024;
        currentSize += estimatedSizeMB;
      }
      
      // Get previous size from history (if available)
      let previousSize = 0;
      let growthPercent = 0;
      
      for (const bucket of buckets) {
        const id = bucket.getId();
        const history = this.bucketSizeHistory.get(id);
        
        if (history && history.length >= 2) {
          previousSize += history[history.length - 2] || 0;
        }
      }
      
      if (previousSize > 0) {
        growthPercent = ((currentSize - previousSize) / previousSize) * 100;
      }
      
      // Check if growth exceeds threshold
      if (growthPercent > this.config.domainGrowthThresholdPercent) {
        this.generateAlert({
          type: 'domain-growth',
          severity: growthPercent > this.config.domainGrowthThresholdPercent * 2 ? 'warning' : 'info',
          message: `Domain "${domain}" is growing rapidly`,
          details: {
            domain,
            currentSizeMB: currentSize,
            previousSizeMB: previousSize,
            growthPercent,
            bucketCount: buckets.length,
            threshold: this.config.domainGrowthThresholdPercent
          }
        });
      }
    }
  }

  /**
   * Generate an alert
   * 
   * @param alert - The alert to generate
   */
  private generateAlert(alert: Omit<MemoryAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const fullAlert: MemoryAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alert
    };
    
    this.alerts.push(fullAlert);
    
    // Limit the number of stored alerts to 100
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    
    // Call alert callback if provided
    if (this.config.alertCallback) {
      this.config.alertCallback(fullAlert);
    }
  }
}
