import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  FlashNetPingResponse, 
  FlashNetPoolResponse, 
  FlashNetPoolsResponse,
  FlashNetAuthChallengeRequest,
  FlashNetAuthChallengeResponse,
  FlashNetAuthVerifyRequest,
  FlashNetAuthVerifyResponse,
  FlashNetSwapSimulateRequest,
  FlashNetSwapSimulateResponse,
  FlashNetSwapRequest,
  FlashNetSwapResponse,
  APIError,
  NetworkError
} from '../types/api';
import { PoolData } from '../types/profile';
import { config } from '../utils/config';

export class FlashNetClient {
  private mainnetClient: AxiosInstance;
  private regtestClient: AxiosInstance;
  private currentNetwork: 'MAINNET' | 'REGTEST' = 'REGTEST';
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor() {
    this.mainnetClient = this.createAxiosInstance(config.get('flashnetMainnetUrl'));
    this.regtestClient = this.createAxiosInstance(config.get('flashnetRegtestUrl'));
    this.currentNetwork = config.get('defaultNetwork');
  }

  /**
   * Create configured axios instance
   */
  private createAxiosInstance(baseURL: string): AxiosInstance {
    const instance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Clunkers-Sniper/1.0.0'
      }
    });

    // Request interceptor for authentication
    instance.interceptors.request.use(
      (config) => {
        if (this.accessToken && this.isTokenValid()) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired, clear it
          this.clearToken();
        }
        return Promise.reject(this.transformError(error));
      }
    );

    return instance;
  }

  /**
   * Get current axios client based on network
   */
  private getClient(): AxiosInstance {
    return this.currentNetwork === 'MAINNET' ? this.mainnetClient : this.regtestClient;
  }

  /**
   * Switch network
   */
  public switchNetwork(network: 'MAINNET' | 'REGTEST'): void {
    this.currentNetwork = network;
    this.clearToken(); // Clear token when switching networks
    console.log(`🔄 Switched to ${network} network`);
  }

  /**
   * Get current network
   */
  public getCurrentNetwork(): 'MAINNET' | 'REGTEST' {
    return this.currentNetwork;
  }

  /**
   * Ping endpoint for health check
   */
  public async ping(): Promise<FlashNetPingResponse> {
    try {
      const response = await this.getClient().get<FlashNetPingResponse>('/ping');
      return response.data;
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * Check if network is online
   */
  public async isNetworkOnline(): Promise<boolean> {
    try {
      const response = await this.ping();
      return response.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Get all pools with optional filters
   */
  public async getPools(filters?: {
    limit?: number;
    offset?: number;
    sort?: string;
    isGraduated?: boolean;
    hostNames?: string;
    curveTypes?: string;
    status?: string;
    afterUpdatedAt?: string;
  }): Promise<FlashNetPoolsResponse> {
    try {
      const params: any = {
        limit: filters?.limit || 100,
        offset: filters?.offset || 0,
        sort: filters?.sort || 'CREATED_AT_DESC',
        ...filters
      };

      const response = await this.getClient().get<FlashNetPoolsResponse>('/pools', { params });
      return response.data;
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * Get a specific pool by ID
   */
  public async getPool(poolId: string): Promise<FlashNetPoolResponse> {
    try {
      const response = await this.getClient().get<FlashNetPoolResponse>(`/pools/${poolId}`);
      return response.data;
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * Find pool by token address
   */
  public async findPoolByToken(tokenAddress: string): Promise<FlashNetPoolResponse | null> {
    try {
      const pools = await this.getPools({ limit: 100 });
      
      // Look for pool with matching token address
      const pool = pools.pools.find(p => 
        p.assetAAddress.toLowerCase() === tokenAddress.toLowerCase()
      );
      
      return pool || null;
    } catch (error) {
      console.error('Failed to find pool by token:', error);
      return null;
    }
  }

  /**
   * Transform FlashNet pool to internal PoolData format
   */
  public transformPoolData(pool: FlashNetPoolResponse): PoolData {
    const currentPrice = pool.currentPriceAInB || 0;
    const btcReserve = parseFloat(pool.assetBReserve || '0');
    const tokenReserve = parseFloat(pool.assetAReserve || '0');
    
    // Estimate tokens to receive (simplified calculation)
    const estimatedTokens = currentPrice > 0 ? (1 / currentPrice).toFixed(8) : '0';

    return {
      poolId: pool.lpPublicKey,
      tokenSymbol: pool.tokenSymbol || 'TOKEN',
      tokenName: pool.tokenName || 'Unknown Token',
      currentPrice,
      estimatedTokens,
      slippageTolerance: 10, // Default 10%
      liquidityBtc: btcReserve,
      bondingProgress: pool.bondingProgressPercent || 0,
      isGraduated: pool.isGraduated || false,
      network: this.currentNetwork,
      lastUpdated: new Date()
    };
  }

  /**
   * Get authentication challenge
   */
  public async getAuthChallenge(publicKey: string): Promise<FlashNetAuthChallengeResponse> {
    try {
      const request: FlashNetAuthChallengeRequest = { publicKey };
      const response = await this.getClient().post<FlashNetAuthChallengeResponse>('/auth/challenge', request);
      return response.data;
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * Verify authentication and get access token
   */
  public async verifyAuth(publicKey: string, signature: string, requestId: string): Promise<string> {
    try {
      const request: FlashNetAuthVerifyRequest = {
        publicKey,
        signature,
        requestId
      };
      
      const response = await this.getClient().post<FlashNetAuthVerifyResponse>('/auth/verify', request);
      
      // Store token and expiration
      this.accessToken = response.data.accessToken;
      this.tokenExpiresAt = new Date(Date.now() + (response.data.expiresIn * 1000));
      
      console.log(`🔐 Authenticated successfully, token expires at ${this.tokenExpiresAt.toISOString()}`);
      return this.accessToken;
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * Simulate a swap to estimate output
   */
  public async simulateSwap(poolId: string, amountIn: string, isBuy: boolean = true): Promise<FlashNetSwapSimulateResponse> {
    try {
      const request: FlashNetSwapSimulateRequest = {
        poolId,
        amountIn,
        isBuy
      };
      
      const response = await this.getClient().post<FlashNetSwapSimulateResponse>('/swap/simulate', request);
      return response.data;
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * Execute a swap transaction
   */
  public async executeSwap(swapRequest: FlashNetSwapRequest): Promise<FlashNetSwapResponse> {
    try {
      if (!this.isAuthenticated()) {
        throw new Error('Authentication required for swap execution');
      }

      const response = await this.getClient().post<FlashNetSwapResponse>('/swap', swapRequest);
      return response.data;
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * Check if client is authenticated
   */
  public isAuthenticated(): boolean {
    return !!(this.accessToken && this.isTokenValid());
  }

  /**
   * Check if access token is valid
   */
  private isTokenValid(): boolean {
    if (!this.tokenExpiresAt) return false;
    return new Date() < this.tokenExpiresAt;
  }

  /**
   * Clear authentication token
   */
  private clearToken(): void {
    this.accessToken = undefined;
    this.tokenExpiresAt = undefined;
  }

  /**
   * Transform axios error to internal error format
   */
  private transformError(error: any): Error {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      const networkError: NetworkError = {
        type: 'CONNECTION_FAILED',
        message: `Cannot connect to FlashNet ${this.currentNetwork} network`,
        originalError: error
      };
      return new Error(JSON.stringify(networkError));
    }

    if (error.code === 'ECONNABORTED') {
      const networkError: NetworkError = {
        type: 'TIMEOUT',
        message: 'Request timeout',
        originalError: error
      };
      return new Error(JSON.stringify(networkError));
    }

    if (error.response) {
      const apiError: APIError = {
        code: error.response.status.toString(),
        message: error.response.data?.message || error.response.statusText,
        details: error.response.data,
        timestamp: new Date().toISOString(),
        requestId: error.response.headers['x-request-id']
      };

      if (error.response.status === 429) {
        const networkError: NetworkError = {
          type: 'RATE_LIMITED',
          message: 'Rate limit exceeded',
          retryAfter: parseInt(error.response.headers['retry-after'] || '60'),
          originalError: apiError
        };
        return new Error(JSON.stringify(networkError));
      }

      return new Error(JSON.stringify(apiError));
    }

    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Get network status information
   */
  public async getNetworkStatus(): Promise<{
    isOnline: boolean;
    network: 'MAINNET' | 'REGTEST';
    latency?: number;
    lastCheck: Date;
  }> {
    const startTime = Date.now();
    const lastCheck = new Date();
    
    try {
      await this.ping();
      const latency = Date.now() - startTime;
      
      return {
        isOnline: true,
        network: this.currentNetwork,
        latency,
        lastCheck
      };
    } catch {
      return {
        isOnline: false,
        network: this.currentNetwork,
        lastCheck
      };
    }
  }

  /**
   * Test network connectivity
   */
  public async testConnectivity(): Promise<boolean> {
    try {
      const status = await this.getNetworkStatus();
      return status.isOnline;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed error information from error object
   */
  public static parseError(error: Error): { type: string; message: string; details?: any } {
    try {
      const parsed = JSON.parse(error.message);
      return {
        type: parsed.type || 'UNKNOWN',
        message: parsed.message || error.message,
        details: parsed.details || parsed.originalError
      };
    } catch {
      return {
        type: 'UNKNOWN',
        message: error.message
      };
    }
  }
}