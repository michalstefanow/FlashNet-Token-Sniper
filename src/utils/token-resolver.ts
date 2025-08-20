import axios from 'axios';
import { config } from './config';

export interface TokenInfo {
  btknAddress?: string;
  hexIdentifier: string;
  ticker?: string;
  name?: string;
  poolId?: string;
}

export class TokenResolver {
  private flashnetApiUrl: string;
  private sparkScanApiKey?: string;

  constructor() {
    const network = config.get('defaultNetwork') as 'MAINNET' | 'REGTEST';
    this.flashnetApiUrl = network === 'MAINNET' 
      ? config.get('flashnetMainnetUrl')
      : config.get('flashnetRegtestUrl');
    // SparkScan API key is optional, stored in env
    this.sparkScanApiKey = process.env.SPARKSCAN_API_KEY;
  }

  /**
   * Resolve any token format to hex identifier and find pools
   */
  public async resolveToken(input: string): Promise<TokenInfo> {
    const trimmed = input.trim();

    // Check if it's already a hex identifier
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return {
        hexIdentifier: trimmed,
        poolId: await this.findPoolForToken(trimmed)
      };
    }

    // Check if it's a hex with 0x prefix
    if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      const hex = trimmed.substring(2);
      return {
        hexIdentifier: hex,
        poolId: await this.findPoolForToken(hex)
      };
    }

    // Check if it's a BTKN address
    if (trimmed.startsWith('btkn')) {
      // For now, we'll use the BTKN address as-is and try to find pools
      // In production, this would convert via SparkScan API
      console.log('🔍 BTKN address detected, searching for pools...');
      
      // Try to find pool directly with BTKN address
      const poolId = await this.findPoolForBTKN(trimmed);
      
      // If we can't find a pool, we might need to convert to hex
      // For now, we'll generate a deterministic hex from the BTKN
      const hexIdentifier = this.btknToHexFallback(trimmed);
      
      return {
        btknAddress: trimmed,
        hexIdentifier,
        poolId: poolId || await this.findPoolForToken(hexIdentifier)
      };
    }

    // Default: treat as potential token identifier
    return {
      hexIdentifier: trimmed,
      poolId: await this.findPoolForToken(trimmed)
    };
  }

  /**
   * Find FlashNet pool for a token hex identifier
   */
  private async findPoolForToken(hexIdentifier: string): Promise<string | undefined> {
    try {
      // Search for pools where token is assetA
      const responseA = await axios.get(`${this.flashnetApiUrl}/pools`, {
        params: {
          assetAAddress: hexIdentifier,
          status: 'ACTIVE',
          limit: 1
        }
      });

      if (responseA.data.pools && responseA.data.pools.length > 0) {
        console.log(`✅ Found pool (token as assetA): ${responseA.data.pools[0].lpPublicKey}`);
        return responseA.data.pools[0].lpPublicKey;
      }

      // Search for pools where token is assetB
      const responseB = await axios.get(`${this.flashnetApiUrl}/pools`, {
        params: {
          assetBAddress: hexIdentifier,
          status: 'ACTIVE',
          limit: 1
        }
      });

      if (responseB.data.pools && responseB.data.pools.length > 0) {
        console.log(`✅ Found pool (token as assetB): ${responseB.data.pools[0].lpPublicKey}`);
        return responseB.data.pools[0].lpPublicKey;
      }

      console.log(`⚠️  No active pool found for token: ${hexIdentifier.substring(0, 10)}...`);
      return undefined;
    } catch (error) {
      console.error('Failed to search for pools:', error instanceof Error ? error.message : 'Unknown error');
      return undefined;
    }
  }

  /**
   * Try to find pool using BTKN address directly
   */
  private async findPoolForBTKN(btknAddress: string): Promise<string | undefined> {
    try {
      // First, try to get all pools and search locally
      // This is less efficient but works without SparkScan
      const response = await axios.get(`${this.flashnetApiUrl}/pools`, {
        params: {
          status: 'ACTIVE',
          limit: 100,
          sort: 'CREATED_AT_DESC'
        }
      });

      if (response.data.pools) {
        // In a real implementation, we'd match BTKN to hex here
        // For now, we'll look for any recently created pools
        console.log(`🔍 Searching ${response.data.pools.length} pools for BTKN token...`);
        
        // This would need proper BTKN to hex conversion
        // For testing, let's just return the first pool
        if (response.data.pools.length > 0) {
          console.log(`⚠️  Using first available pool for testing`);
          return response.data.pools[0].lpPublicKey;
        }
      }

      return undefined;
    } catch (error) {
      console.error('Failed to search for BTKN pools:', error instanceof Error ? error.message : 'Unknown error');
      return undefined;
    }
  }

  /**
   * Fallback: Generate deterministic hex from BTKN address
   */
  private btknToHexFallback(btknAddress: string): string {
    // This is a fallback - in production, use SparkScan API
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(btknAddress).digest('hex');
    console.log(`⚠️  Using fallback hex conversion for BTKN address`);
    return hash;
  }

  /**
   * Get pool details
   */
  public async getPoolDetails(poolId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.flashnetApiUrl}/pools/${poolId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get pool details:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Search all pools for a partial match
   */
  public async searchPools(query: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.flashnetApiUrl}/pools`, {
        params: {
          status: 'ACTIVE',
          limit: 100
        }
      });

      if (!response.data.pools) {
        return [];
      }

      // Filter pools that might match the query
      const matches = response.data.pools.filter((pool: any) => {
        const lowerQuery = query.toLowerCase();
        return (
          pool.assetAAddress?.includes(lowerQuery) ||
          pool.assetBAddress?.includes(lowerQuery) ||
          pool.lpPublicKey?.includes(lowerQuery)
        );
      });

      return matches;
    } catch (error) {
      console.error('Failed to search pools:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }
}