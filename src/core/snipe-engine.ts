import { EventEmitter } from 'events';
import { FlashNetWalletManager, FlashNetWallet } from './flashnet-wallet-manager';
import { ProfileManager } from './profile-manager';
import { Profile, Snipe, SnipeResult } from '../types/profile';
import { config } from '../utils/config';
import chalk from 'chalk';

export interface SnipeExecutionOptions {
  maxRetries?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
  slippageTolerance?: number;
  executeInParallel?: boolean;
}

export interface SnipeExecutionEvent {
  snipeId: string;
  type: 'started' | 'pool_found' | 'swap_simulated' | 'swap_executed' | 'completed' | 'failed' | 'retrying';
  data?: any;
  timestamp: Date;
}

export class SnipeEngine extends EventEmitter {
  private walletManager: FlashNetWalletManager;
  private profileManager: ProfileManager;
  private isExecuting = false;
  private executionOptions: Required<SnipeExecutionOptions>;
  private activeWallets: Map<string, FlashNetWallet> = new Map();

  constructor(baseDir: string, options: SnipeExecutionOptions = {}) {
    super();
    
    this.walletManager = new FlashNetWalletManager();
    this.profileManager = new ProfileManager(baseDir);
    
    this.executionOptions = {
      maxRetries: options.maxRetries || config.get('maxRetryAttempts'),
      retryDelay: options.retryDelay || config.get('initialRetryDelay'),
      maxRetryDelay: options.maxRetryDelay || config.get('maxRetryDelay'),
      slippageTolerance: options.slippageTolerance || 10,
      executeInParallel: options.executeInParallel ?? true
    };
  }

  /**
   * Execute all active snipes for a profile
   */
  public async executeSnipes(profile: Profile): Promise<SnipeResult[]> {
    if (this.isExecuting) {
      throw new Error('Snipe execution already in progress');
    }

    this.isExecuting = true;
    const activeSnipes = profile.snipes.filter(snipe => snipe.isActive);
    
    console.log(chalk.hex('#00D9FF')(`\n🎯 Executing ${activeSnipes.length} active snipes...`));
    
    try {
      if (this.executionOptions.executeInParallel) {
        return await this.executeSnipesInParallel(activeSnipes);
      } else {
        return await this.executeSnipesSequentially(activeSnipes);
      }
    } finally {
      this.isExecuting = false;
      // Clear active wallets
      this.activeWallets.clear();
    }
  }

  /**
   * Execute snipes in parallel (one wallet per snipe)
   */
  private async executeSnipesInParallel(snipes: Snipe[]): Promise<SnipeResult[]> {
    console.log(chalk.gray('⚡ Executing snipes in parallel mode...'));
    
    const promises = snipes.map(snipe => this.executeSingleSnipe(snipe));
    return Promise.all(promises);
  }

  /**
   * Execute snipes sequentially
   */
  private async executeSnipesSequentially(snipes: Snipe[]): Promise<SnipeResult[]> {
    console.log(chalk.gray('📝 Executing snipes in sequential mode...'));
    
    const results: SnipeResult[] = [];
    for (const snipe of snipes) {
      const result = await this.executeSingleSnipe(snipe);
      results.push(result);
    }
    return results;
  }

  /**
   * Execute a single snipe with retry logic
   */
  private async executeSingleSnipe(snipe: Snipe): Promise<SnipeResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;
    
    this.emitSnipeEvent(snipe.id, 'started', { snipe });
    
    while (attempts < this.executionOptions.maxRetries) {
      attempts++;
      
      try {
        // Restore or get wallet for this snipe
        const wallet = await this.getOrRestoreWallet(snipe);
        
        // Get balance to verify wallet is working
        const balance = await this.walletManager.getBalance(wallet);
        console.log(chalk.gray(`   Wallet balance: ${balance.balance} sats`));
        
        // Find pool using FlashNet SDK
        const poolsResponse = await this.walletManager.listPools(wallet);
        
        // Handle both array and object with pools property
        const pools = Array.isArray(poolsResponse) ? poolsResponse : (poolsResponse.pools || []);
        
        if (!Array.isArray(pools)) {
          throw new Error('Failed to retrieve pools list from FlashNet API');
        }
        
        const pool = pools.find((p: any) => 
          p.assetATokenPublicKey === snipe.tokenAddress || 
          p.assetBTokenPublicKey === snipe.tokenAddress ||
          p.tokenPublicKey === snipe.tokenAddress ||
          p.poolId === snipe.tokenAddress
        );
        
        if (!pool) {
          throw new Error(`Pool not found for token ${snipe.tokenAddress}`);
        }
        
        this.emitSnipeEvent(snipe.id, 'pool_found', { pool });
        
        // Determine which token is BTC and which is the target
        const isBtcAssetA = pool.assetATokenPublicKey === 'BTC' || pool.assetATokenPublicKey.includes('btc');
        const assetInToken = isBtcAssetA ? pool.assetATokenPublicKey : pool.assetBTokenPublicKey;
        const assetOutToken = isBtcAssetA ? pool.assetBTokenPublicKey : pool.assetATokenPublicKey;
        
        // Convert BTC amount to satoshis
        const amountInSats = Math.floor(parseFloat(snipe.amountBtc) * 100000000);
        
        // Simulate swap first
        const simulation = await this.walletManager.simulateSwap(wallet, {
          poolId: pool.poolId,
          assetInTokenPublicKey: assetInToken,
          assetOutTokenPublicKey: assetOutToken,
          amountIn: amountInSats
        });
        
        this.emitSnipeEvent(snipe.id, 'swap_simulated', { simulation });
        
        // Calculate minimum output with slippage
        const minAmountOut = Math.floor(
          (simulation.amountOut || 0) * (1 - this.executionOptions.slippageTolerance / 100)
        );
        
        // Execute the swap
        const swapResult = await this.walletManager.executeSwap(wallet, {
          poolId: pool.poolId,
          assetInTokenPublicKey: assetInToken,
          assetOutTokenPublicKey: assetOutToken,
          amountIn: BigInt(amountInSats),
          minAmountOut: BigInt(minAmountOut),
          maxSlippageBps: this.executionOptions.slippageTolerance * 100 // Convert percentage to basis points
        });
        
        this.emitSnipeEvent(snipe.id, 'swap_executed', { swapResult });
        
        // Success!
        const result: SnipeResult = {
          snipeId: snipe.id,
          success: true,
          transactionHash: swapResult.txId || swapResult.transactionHash,
          tokensReceived: swapResult.amountOut?.toString(),
          actualPrice: amountInSats / (swapResult.amountOut || 1),
          slippage: ((simulation.amountOut - (swapResult.amountOut || 0)) / simulation.amountOut) * 100,
          executionTime: Date.now() - startTime,
          attempts
        };
        
        this.emitSnipeEvent(snipe.id, 'completed', { result });
        console.log(chalk.green(`✅ Snipe ${snipe.id} successful!`));
        
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.log(chalk.yellow(`⚠️  Attempt ${attempts} failed: ${lastError}`));
        
        if (attempts < this.executionOptions.maxRetries) {
          const delay = Math.min(
            this.executionOptions.retryDelay * Math.pow(2, attempts - 1),
            this.executionOptions.maxRetryDelay
          );
          
          this.emitSnipeEvent(snipe.id, 'retrying', { 
            attempt: attempts, 
            nextAttemptIn: delay,
            error: lastError 
          });
          
          await this.sleep(delay);
        }
      }
    }
    
    // All attempts failed
    const result: SnipeResult = {
      snipeId: snipe.id,
      success: false,
      error: lastError,
      executionTime: Date.now() - startTime,
      attempts
    };
    
    this.emitSnipeEvent(snipe.id, 'failed', { result });
    console.log(chalk.red(`❌ Snipe ${snipe.id} failed after ${attempts} attempts`));
    
    return result;
  }

  /**
   * Get or restore wallet for a snipe
   */
  private async getOrRestoreWallet(snipe: Snipe, network?: 'MAINNET' | 'REGTEST'): Promise<FlashNetWallet> {
    // Check if we already have this wallet active
    if (this.activeWallets.has(snipe.id)) {
      return this.activeWallets.get(snipe.id)!;
    }
    
    // Restore wallet from encrypted mnemonic
    const targetNetwork = network || (config.get('defaultNetwork') as 'MAINNET' | 'REGTEST');
    const wallet = await this.walletManager.restoreWallet(snipe.encryptedMnemonic, targetNetwork);
    
    // Cache for this execution
    this.activeWallets.set(snipe.id, wallet);
    
    return wallet;
  }

  /**
   * Execute a single snipe on a specific network (for testing)
   */
  private async executeSingleSnipeOnNetwork(snipe: Snipe, network: 'MAINNET' | 'REGTEST'): Promise<SnipeResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;
    
    this.emitSnipeEvent(snipe.id, 'started', { snipe, network });
    
    try {
      // Restore wallet for specific network
      const wallet = await this.getOrRestoreWallet(snipe, network);
      
      // Get balance to verify wallet is working
      const balance = await this.walletManager.getBalance(wallet);
      console.log(chalk.gray(`   Wallet balance: ${balance.balance} sats`));
      
      // Find pool using FlashNet SDK
      const poolsResponse = await this.walletManager.listPools(wallet);
      
      // Handle both array and object with pools property
      const pools = Array.isArray(poolsResponse) ? poolsResponse : (poolsResponse.pools || []);
      
      if (!Array.isArray(pools)) {
        throw new Error('Failed to retrieve pools list from FlashNet API');
      }
      
      const pool = pools.find((p: any) => 
        p.assetATokenPublicKey === snipe.tokenAddress || 
        p.assetBTokenPublicKey === snipe.tokenAddress ||
        p.tokenPublicKey === snipe.tokenAddress ||
        p.poolId === snipe.tokenAddress
      );
      
      if (!pool) {
        throw new Error(`Pool not found for token ${snipe.tokenAddress}`);
      }
      
      this.emitSnipeEvent(snipe.id, 'pool_found', { pool });
      
      // Simulate swap
      const amountInSats = Math.floor(parseFloat(snipe.amountBtc) * 100000000);
      const simulation = await this.walletManager.simulateSwap(wallet, {
        poolId: pool.poolId,
        assetInTokenPublicKey: pool.assetBTokenPublicKey, // Assuming BTC
        assetOutTokenPublicKey: snipe.tokenAddress,
        amountIn: amountInSats
      });
      
      this.emitSnipeEvent(snipe.id, 'swap_simulated', { simulation });
      
      // For testing, we return success with simulation data
      const result: SnipeResult = {
        snipeId: snipe.id,
        success: true,
        tokensReceived: simulation.amountOut?.toString(),
        actualPrice: amountInSats / (simulation.amountOut || 1),
        executionTime: Date.now() - startTime,
        attempts: 1
      };
      
      this.emitSnipeEvent(snipe.id, 'completed', { result });
      return result;
      
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      
      const result: SnipeResult = {
        snipeId: snipe.id,
        success: false,
        error: lastError,
        executionTime: Date.now() - startTime,
        attempts: 1
      };
      
      this.emitSnipeEvent(snipe.id, 'failed', { result });
      return result;
    }
  }

  /**
   * Emit snipe execution event
   */
  private emitSnipeEvent(snipeId: string, type: SnipeExecutionEvent['type'], data?: any): void {
    const event: SnipeExecutionEvent = {
      snipeId,
      type,
      data,
      timestamp: new Date()
    };
    
    this.emit('snipe:event', event);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test a single snipe on regtest
   */
  public async testSnipe(snipe: Snipe): Promise<SnipeResult> {
    console.log(chalk.hex('#00D9FF')('\n🧪 Testing snipe on REGTEST...'));
    
    // Testing always uses REGTEST - we'll pass it directly to wallet restore
    try {
      // Temporarily override network in wallet restoration
      const testSnipe = { ...snipe };
      const result = await this.executeSingleSnipeOnNetwork(testSnipe, 'REGTEST');
      console.log(chalk.gray('🧪 Test completed'));
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if engine is currently executing
   */
  public isCurrentlyExecuting(): boolean {
    return this.isExecuting;
  }

  /**
   * Stop execution (best effort)
   */
  public stop(): void {
    this.isExecuting = false;
    this.removeAllListeners();
    this.activeWallets.clear();
    console.log(chalk.yellow('⏹️  Snipe engine stopped'));
  }
}