# Memory Monitoring System

The InfiniteContext system includes a sophisticated memory monitoring system that tracks usage across buckets and storage providers, generating alerts when thresholds are exceeded. This document explains how the memory monitoring system works and how to configure it.

## Overview

The memory monitoring system consists of the following components:

- **MemoryMonitor**: The core component that tracks memory usage and generates alerts
- **Memory Alerts**: Notifications about potential issues with memory usage
- **Memory Statistics**: Detailed information about memory usage across the system

## Memory Monitor

The MemoryMonitor class is responsible for tracking memory usage across buckets and storage providers. It periodically checks the size of buckets, the capacity of storage providers, and the growth rate of domains, generating alerts when thresholds are exceeded.

### Configuration

The MemoryMonitor can be configured with the following options:

```typescript
interface MemoryMonitorConfig {
  bucketSizeThresholdMB: number;
  providerCapacityThresholdPercent: number;
  domainGrowthThresholdPercent: number;
  monitoringIntervalMs: number;
  alertCallback?: (alert: MemoryAlert) => void;
}
```

- `bucketSizeThresholdMB`: The threshold for bucket size in megabytes (default: `100`)
- `providerCapacityThresholdPercent`: The threshold for provider capacity in percent (default: `80`)
- `domainGrowthThresholdPercent`: The threshold for domain growth in percent (default: `50`)
- `monitoringIntervalMs`: The interval for monitoring in milliseconds (default: `60000` = 1 minute)
- `alertCallback`: An optional callback function that is called when an alert is generated

### Usage

The MemoryMonitor is automatically created and configured when you create a MemoryManager instance. You can start and stop monitoring using the following methods:

```typescript
// Start monitoring
memoryManager.startMemoryMonitoring();

// Stop monitoring
memoryManager.stopMemoryMonitoring();
```

You can also register alert handlers to be notified when alerts are generated:

```typescript
memoryManager.addAlertHandler((alert) => {
  console.log(`Memory Alert: ${alert.message}`);
});
```

## Memory Alerts

Memory alerts are generated when thresholds are exceeded. They have the following structure:

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

- `id`: A unique identifier for the alert
- `type`: The type of alert
- `severity`: The severity of the alert
- `message`: A human-readable message describing the alert
- `details`: Additional details about the alert
- `timestamp`: The time when the alert was generated
- `acknowledged`: Whether the alert has been acknowledged

### Alert Types

The following alert types are supported:

- `bucket-size`: Generated when a bucket exceeds the size threshold
- `provider-capacity`: Generated when a storage provider exceeds the capacity threshold
- `domain-growth`: Generated when a domain grows faster than the growth threshold
- `system`: Generated for system-level issues

### Alert Severity

Alerts can have the following severity levels:

- `info`: Informational alerts that don't require immediate attention
- `warning`: Warnings that may require attention
- `critical`: Critical alerts that require immediate attention

### Handling Alerts

You can get all current alerts using the following method:

```typescript
const alerts = memoryManager.getMemoryAlerts();
```

You can acknowledge an alert using the following method:

```typescript
memoryManager.acknowledgeMemoryAlert(alertId);
```

## Memory Statistics

The memory monitoring system provides detailed statistics about memory usage across the system. You can get these statistics using the following method:

```typescript
const stats = await memoryManager.getMemoryStats();
```

The statistics include the following information:

```typescript
{
  bucketStats: Array<{ 
    id: string, 
    name: string, 
    domain: string, 
    chunkCount: number, 
    estimatedSizeMB: number 
  }>;
  providerStats: Array<{ 
    id: string, 
    name: string, 
    tier: StorageTier, 
    quota: StorageQuota, 
    usagePercent: number 
  }>;
  domainStats: Array<{ 
    domain: string, 
    chunkCount: number, 
    estimatedSizeMB: number 
  }>;
  totalStats: { 
    chunkCount: number, 
    estimatedSizeMB: number, 
    availableStorageMB: number 
  };
}
```

- `bucketStats`: Statistics for each bucket
- `providerStats`: Statistics for each storage provider
- `domainStats`: Statistics for each domain
- `totalStats`: Overall statistics for the system

## Integration with InfiniteContext

The memory monitoring system is fully integrated with the InfiniteContext API. You can enable memory monitoring when initializing the system:

```typescript
const context = new InfiniteContext({
  openai,
  embeddingModel: 'text-embedding-3-small'
});

await context.initialize({
  enableMemoryMonitoring: true,
  memoryMonitoringConfig: {
    bucketSizeThresholdMB: 200,
    providerCapacityThresholdPercent: 90,
    domainGrowthThresholdPercent: 30,
    monitoringIntervalMs: 30000 // 30 seconds
  }
});
```

You can also add alert handlers:

```typescript
context.addMemoryAlertHandler((alert) => {
  console.log(`Memory Alert: ${alert.message}`);
});
```

And get memory statistics:

```typescript
const stats = await context.getMemoryStats();
```

## Example: Monitoring Dashboard

Here's an example of how you might use the memory monitoring system to create a simple monitoring dashboard:

```typescript
import { InfiniteContext, MemoryAlert } from 'infinite-context';

// Create and initialize the context
const context = new InfiniteContext({
  openai,
  embeddingModel: 'text-embedding-3-small'
});

await context.initialize({
  enableMemoryMonitoring: true
});

// Add an alert handler
context.addMemoryAlertHandler((alert) => {
  displayAlert(alert);
});

// Update the dashboard every 5 seconds
setInterval(async () => {
  const stats = await context.getMemoryStats();
  updateDashboard(stats);
}, 5000);

// Display an alert in the dashboard
function displayAlert(alert: MemoryAlert) {
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${alert.severity}`;
  alertElement.innerHTML = `
    <h3>${alert.type}</h3>
    <p>${alert.message}</p>
    <button onclick="acknowledgeAlert('${alert.id}')">Acknowledge</button>
  `;
  document.getElementById('alerts').appendChild(alertElement);
}

// Update the dashboard with the latest statistics
function updateDashboard(stats: any) {
  // Update bucket statistics
  const bucketTable = document.getElementById('bucket-stats');
  bucketTable.innerHTML = stats.bucketStats.map(bucket => `
    <tr>
      <td>${bucket.name}</td>
      <td>${bucket.domain}</td>
      <td>${bucket.chunkCount}</td>
      <td>${bucket.estimatedSizeMB.toFixed(2)} MB</td>
    </tr>
  `).join('');

  // Update provider statistics
  const providerTable = document.getElementById('provider-stats');
  providerTable.innerHTML = stats.providerStats.map(provider => `
    <tr>
      <td>${provider.name}</td>
      <td>${provider.tier}</td>
      <td>${provider.usagePercent.toFixed(2)}%</td>
      <td>${(provider.quota.used / (1024 * 1024)).toFixed(2)} MB</td>
      <td>${(provider.quota.total / (1024 * 1024)).toFixed(2)} MB</td>
    </tr>
  `).join('');

  // Update domain statistics
  const domainTable = document.getElementById('domain-stats');
  domainTable.innerHTML = stats.domainStats.map(domain => `
    <tr>
      <td>${domain.domain}</td>
      <td>${domain.chunkCount}</td>
      <td>${domain.estimatedSizeMB.toFixed(2)} MB</td>
    </tr>
  `).join('');

  // Update total statistics
  document.getElementById('total-chunks').textContent = stats.totalStats.chunkCount;
  document.getElementById('total-size').textContent = `${stats.totalStats.estimatedSizeMB.toFixed(2)} MB`;
  document.getElementById('available-storage').textContent = `${stats.totalStats.availableStorageMB.toFixed(2)} MB`;
}

// Acknowledge an alert
function acknowledgeAlert(alertId: string) {
  context.acknowledgeMemoryAlert(alertId);
  document.querySelector(`[data-alert-id="${alertId}"]`).remove();
}
```

This example creates a simple dashboard that displays memory statistics and alerts. It updates the dashboard every 5 seconds and allows users to acknowledge alerts.

## Best Practices

Here are some best practices for using the memory monitoring system:

1. **Enable memory monitoring in production**: Memory monitoring is essential for detecting and addressing potential issues before they become critical.

2. **Configure appropriate thresholds**: The default thresholds may not be appropriate for your use case. Adjust them based on your expected usage patterns.

3. **Handle alerts appropriately**: Set up alert handlers that notify the appropriate people or systems when alerts are generated.

4. **Monitor growth trends**: Pay attention to domain growth alerts, as they can indicate unexpected usage patterns.

5. **Regularly review memory statistics**: Even without alerts, it's a good idea to regularly review memory statistics to understand how your system is being used.

6. **Implement automatic scaling**: Consider implementing automatic scaling based on memory statistics, such as adding more storage providers when capacity thresholds are approached.

7. **Archive or delete old data**: Implement policies for archiving or deleting old data to free up space.

8. **Use multiple storage tiers**: Take advantage of the tiered storage architecture to optimize cost and performance.
