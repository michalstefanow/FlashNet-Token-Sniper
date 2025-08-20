import { EventEmitter } from 'events';
import { FlashNetClient } from '../services/flashnet-client';
import { NetworkStatus } from '../types/cli';
import { config } from '../utils/config';

export interface NetworkStatusEvent {
  isOnline: boolean;
  network: 'MAINNET' | 'REGTEST';
  timestamp: Date;
  latency?: number;
  previousStatus?: boolean;
}

export interface NetworkDetectorOptions {
  pollInterval?: number;      // Polling interval in milliseconds
  maxFailures?: number;       // Max consecutive failures before marking offline
  healthcheckTimeout?: number; // Timeout for individual health checks
}

export class NetworkDetector extends EventEmitter {
  private flashnetClient: FlashNetClient;
  private pollInterval: number;
  private maxFailures: number;
  private healthcheckTimeout: number;
  
  private isPolling = false;
  private pollTimer?: NodeJS.Timeout;
  private currentStatus: NetworkStatus;
  private consecutiveFailures = 0;
  
  constructor(options: NetworkDetectorOptions = {}) {
    super();
    
    this.flashnetClient = new FlashNetClient();
    this.pollInterval = options.pollInterval || config.get('mainnetPollInterval');
    this.maxFailures = options.maxFailures || 3;
    this.healthcheckTimeout = options.healthcheckTimeout || 5000;
    
    this.currentStatus = {
      isOnline: false,
      network: config.get('defaultNetwork'),
      lastCheck: new Date(),
      consecutiveFailures: 0
    };
  }

  /**
   * Start monitoring network status
   */
  public async startMonitoring(network: 'MAINNET' | 'REGTEST' = 'MAINNET'): Promise<void> {
    if (this.isPolling) {
      console.warn('⚠️  Network monitoring already started');
      return;
    }

    this.flashnetClient.switchNetwork(network);
    this.currentStatus.network = network;
    this.isPolling = true;
    this.consecutiveFailures = 0;

    console.log(`🔍 Starting ${network} network monitoring (${this.pollInterval}ms intervals)`);
    
    // Emit monitoring started event
    this.emit('monitoring:started', { network, timestamp: new Date() });
    
    // Start immediate check
    await this.performHealthCheck();
    
    // Schedule regular checks
    this.scheduleNextCheck();
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (!this.isPolling) {
      return;
    }

    this.isPolling = false;
    
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    console.log('⏹️  Stopped network monitoring');
    this.emit('monitoring:stopped', { timestamp: new Date() });
  }

  /**
   * Get current network status
   */
  public getStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }

  /**
   * Check if currently monitoring
   */
  public isMonitoring(): boolean {
    return this.isPolling;
  }

  /**
   * Perform immediate health check
   */
  public async checkNow(): Promise<NetworkStatus> {
    return await this.performHealthCheck();
  }

  /**
   * Switch to different network
   */
  public switchNetwork(network: 'MAINNET' | 'REGTEST'): void {
    const wasMonitoring = this.isPolling;
    
    if (wasMonitoring) {
      this.stopMonitoring();
    }

    this.flashnetClient.switchNetwork(network);
    this.currentStatus.network = network;
    this.consecutiveFailures = 0;

    console.log(`🔄 Switched to ${network} network`);
    this.emit('network:switched', { network, timestamp: new Date() });

    if (wasMonitoring) {
      this.startMonitoring(network);
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<NetworkStatus> {
    const startTime = Date.now();
    const checkTimestamp = new Date();
    const previousStatus = this.currentStatus.isOnline;

    try {
      // Perform ping with timeout
      const pingPromise = this.flashnetClient.ping();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.healthcheckTimeout);
      });

      const response = await Promise.race([pingPromise, timeoutPromise]) as any;
      const latency = Date.now() - startTime;
      const isOnline = response.status === 'ok';

      // Update status
      this.currentStatus = {
        isOnline,
        network: this.currentStatus.network,
        lastCheck: checkTimestamp,
        latency,
        consecutiveFailures: isOnline ? 0 : this.consecutiveFailures + 1
      };

      // Reset failure counter on success
      if (isOnline) {
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures++;
      }

      // Emit status events
      this.emitStatusEvents(previousStatus, latency);

      if (config.get('debug')) {
        console.log(`🔍 Health check: ${isOnline ? '✅ ONLINE' : '❌ OFFLINE'} (${latency}ms)`);
      }

    } catch (error) {
      this.consecutiveFailures++;
      const latency = Date.now() - startTime;

      this.currentStatus = {
        isOnline: false,
        network: this.currentStatus.network,
        lastCheck: checkTimestamp,
        latency,
        consecutiveFailures: this.consecutiveFailures
      };

      this.emitStatusEvents(previousStatus, latency);

      if (config.get('debug')) {
        console.log(`🔍 Health check failed: ${error instanceof Error ? error.message : 'Unknown error'} (${latency}ms)`);
      }
    }

    return this.currentStatus;
  }

  /**
   * Emit appropriate status events
   */
  private emitStatusEvents(previousStatus: boolean, latency: number): void {
    const statusEvent: NetworkStatusEvent = {
      isOnline: this.currentStatus.isOnline,
      network: this.currentStatus.network,
      timestamp: this.currentStatus.lastCheck,
      latency,
      previousStatus
    };

    // Always emit status update
    this.emit('status:update', statusEvent);

    // Emit specific status change events
    if (previousStatus !== this.currentStatus.isOnline) {
      if (this.currentStatus.isOnline) {
        console.log(`🟢 ${this.currentStatus.network} NETWORK ONLINE! (${latency}ms)`);
        this.emit('network:online', statusEvent);
        
        // This is the critical event that triggers sniping
        if (this.currentStatus.network === 'MAINNET') {
          this.emit('mainnet:online', statusEvent);
        }
      } else {
        console.log(`🔴 ${this.currentStatus.network} network offline`);
        this.emit('network:offline', statusEvent);
        
        if (this.currentStatus.network === 'MAINNET') {
          this.emit('mainnet:offline', statusEvent);
        }
      }
    }

    // Emit warning for consecutive failures
    if (this.consecutiveFailures >= this.maxFailures && !this.currentStatus.isOnline) {
      this.emit('network:degraded', {
        ...statusEvent,
        consecutiveFailures: this.consecutiveFailures
      });
    }

    // Emit latency warnings
    if (latency > 10000) { // 10 seconds
      this.emit('network:slow', {
        ...statusEvent,
        latency
      });
    }
  }

  /**
   * Schedule next health check
   */
  private scheduleNextCheck(): void {
    if (!this.isPolling) {
      return;
    }

    this.pollTimer = setTimeout(async () => {
      if (this.isPolling) {
        await this.performHealthCheck();
        this.scheduleNextCheck();
      }
    }, this.pollInterval);
  }

  /**
   * Get monitoring statistics
   */
  public getStats(): {
    uptime: number;
    totalChecks: number;
    successRate: number;
    averageLatency: number;
  } {
    // This is a simplified implementation
    // In a production system, you'd track these metrics over time
    const uptime = this.isPolling ? Date.now() - this.currentStatus.lastCheck.getTime() : 0;
    
    return {
      uptime,
      totalChecks: 0, // Would be tracked
      successRate: 0, // Would be calculated
      averageLatency: this.currentStatus.latency || 0
    };
  }

  /**
   * Set custom poll interval
   */
  public setPollInterval(intervalMs: number): void {
    if (intervalMs < 1000) {
      throw new Error('Poll interval must be at least 1000ms');
    }

    this.pollInterval = intervalMs;
    console.log(`🕐 Updated poll interval to ${intervalMs}ms`);

    // Restart monitoring with new interval if currently active
    if (this.isPolling) {
      const network = this.currentStatus.network;
      this.stopMonitoring();
      this.startMonitoring(network);
    }
  }

  /**
   * Wait for network to come online
   */
  public async waitForOnline(timeoutMs?: number): Promise<NetworkStatus> {
    return new Promise((resolve, reject) => {
      if (this.currentStatus.isOnline) {
        resolve(this.currentStatus);
        return;
      }

      const timeout = timeoutMs ? setTimeout(() => {
        this.removeListener('network:online', onOnline);
        reject(new Error('Timeout waiting for network'));
      }, timeoutMs) : null;

      const onOnline = (event: NetworkStatusEvent) => {
        if (timeout) clearTimeout(timeout);
        this.removeListener('network:online', onOnline);
        resolve(this.currentStatus);
      };

      this.once('network:online', onOnline);
    });
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}