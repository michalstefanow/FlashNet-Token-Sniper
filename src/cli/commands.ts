import { ProfileManager } from '../core/profile-manager';
import { FlashNetWalletManager } from '../core/flashnet-wallet-manager';
import { FlashNetClient } from '../services/flashnet-client';
import { NetworkDetector } from '../core/network-detector';
import { ValidationService } from '../utils/validation';
import { TokenResolver } from '../utils/token-resolver';
import { CommandResult, ValidationResult } from '../types/cli';
import { Profile, Snipe } from '../types/profile';
import chalk from 'chalk';

export class CommandHandler {
  private profileManager: ProfileManager;
  private walletManager: FlashNetWalletManager;
  private flashnetClient: FlashNetClient;
  private networkDetector: NetworkDetector;
  private tokenResolver: TokenResolver;
  private currentProfile?: Profile;

  constructor(baseDir: string) {
    this.profileManager = new ProfileManager(baseDir);
    this.walletManager = new FlashNetWalletManager();
    this.flashnetClient = new FlashNetClient();
    this.networkDetector = new NetworkDetector();
    this.tokenResolver = new TokenResolver();
  }

  /**
   * Create a new profile
   */
  public async createProfile(name: string): Promise<CommandResult> {
    try {
      const validation = ValidationService.validateProfileName(name);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const profile = await this.profileManager.createProfile(name);
      this.currentProfile = profile;

      return {
        success: true,
        message: `✅ Created profile: ${chalk.cyan(name)}`,
        data: profile
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create profile'
      };
    }
  }

  /**
   * Switch to an existing profile
   */
  public async switchProfile(name: string): Promise<CommandResult> {
    try {
      const profile = await this.profileManager.loadProfile(name);
      if (!profile) {
        return { success: false, error: `Profile '${name}' not found` };
      }

      // Check if profile is locked
      const isLocked = await this.profileManager.acquireLock(name);
      if (!isLocked) {
        return { 
          success: false, 
          error: `Profile '${name}' is currently in use by another process` 
        };
      }

      this.currentProfile = profile;

      return {
        success: true,
        message: `🔄 Switched to profile: ${chalk.cyan(name)}`,
        data: profile
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch profile'
      };
    }
  }

  /**
   * List all profiles
   */
  public async listProfiles(): Promise<CommandResult> {
    try {
      const profiles = await this.profileManager.listProfiles();
      
      if (profiles.length === 0) {
        return {
          success: true,
          message: 'No profiles found. Create one with: create-profile <name>'
        };
      }

      return {
        success: true,
        data: profiles
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list profiles'
      };
    }
  }

  /**
   * Delete a profile
   */
  public async deleteProfile(name: string): Promise<CommandResult> {
    try {
      await this.profileManager.deleteProfile(name);
      
      // Clear current profile if it was deleted
      if (this.currentProfile?.name === name) {
        this.currentProfile = undefined;
      }

      return {
        success: true,
        message: `🗑️  Deleted profile: ${chalk.red(name)}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete profile'
      };
    }
  }

  /**
   * Add a snipe to current profile
   */
  public async addSnipe(tokenAddress: string, amountBtc: string): Promise<CommandResult> {
    try {
      if (!this.currentProfile) {
        return { success: false, error: 'No profile selected. Use switch-profile first.' };
      }

      // Validate inputs
      const tokenValidation = ValidationService.validateTokenAddress(tokenAddress);
      if (!tokenValidation.valid) {
        return { success: false, error: tokenValidation.error };
      }

      const amountValidation = ValidationService.validateBTCAmount(amountBtc);
      if (!amountValidation.valid) {
        return { success: false, error: amountValidation.error };
      }

      // Resolve token to hex identifier and find pool
      console.log(chalk.gray('🔍 Resolving token and searching for pools...'));
      const tokenInfo = await this.tokenResolver.resolveToken(tokenAddress);
      
      if (!tokenInfo.poolId) {
        console.log(chalk.yellow('⚠️  No pool found for this token yet'));
        console.log(chalk.gray('   The pool might be created later or on a different network'));
      } else {
        console.log(chalk.green(`✅ Found pool: ${tokenInfo.poolId.substring(0, 20)}...`));
      }

      // Use the hex identifier for storage
      const snipe = await this.profileManager.addSnipe(
        this.currentProfile.name,
        tokenInfo.hexIdentifier,
        amountBtc
      );

      // Generate FlashNet wallet for this snipe
      const wallet = await this.walletManager.generateWallet({
        network: this.currentProfile.settings.network
      });

      // Update snipe with wallet information
      snipe.walletAddress = wallet.address;
      snipe.bitcoinAddress = wallet.bitcoinAddress; // Bitcoin Taproot address for funding
      snipe.encryptedMnemonic = wallet.encryptedMnemonic!; // FlashNet wallet mnemonic
      snipe.status = 'VALIDATED';

      // Save updated profile
      const reloadedProfile = await this.profileManager.loadProfile(this.currentProfile.name);
      this.currentProfile = reloadedProfile || undefined;
      if (this.currentProfile) {
        const snipeIndex = this.currentProfile.snipes.findIndex(s => s.id === snipe.id);
        if (snipeIndex >= 0) {
          this.currentProfile.snipes[snipeIndex] = snipe;
          await this.profileManager.saveProfile(this.currentProfile);
        }
      }

      const walletInfo = wallet.bitcoinAddress 
        ? `   Spark:   ${chalk.cyan(wallet.address)}\n` +
          `   Bitcoin: ${chalk.hex('#FFA500')(wallet.bitcoinAddress)} ← Fund this address`
        : `   Wallet: ${chalk.cyan(wallet.address)}`;

      return {
        success: true,
        message: `📍 Added snipe: ${chalk.yellow(tokenAddress.substring(0, 10))}... → ${chalk.green(amountBtc)} BTC\n${walletInfo}`,
        data: { snipe, wallet: { address: wallet.address, bitcoinAddress: wallet.bitcoinAddress } }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add snipe'
      };
    }
  }

  /**
   * List snipes in current profile
   */
  public async listSnipes(): Promise<CommandResult> {
    try {
      if (!this.currentProfile) {
        return { success: false, error: 'No profile selected. Use switch-profile first.' };
      }

      if (this.currentProfile.snipes.length === 0) {
        return {
          success: true,
          message: 'No snipes configured. Add one with: add-snipe <token_address> <btc_amount>'
        };
      }

      return {
        success: true,
        data: this.currentProfile.snipes
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list snipes'
      };
    }
  }

  /**
   * Toggle snipe active state
   */
  public async toggleSnipe(index: string): Promise<CommandResult> {
    try {
      if (!this.currentProfile) {
        return { success: false, error: 'No profile selected. Use switch-profile first.' };
      }

      const validation = ValidationService.validateSnipeIndex(index, this.currentProfile.snipes.length);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const snipeIndex = parseInt(index, 10) - 1; // Convert to 0-based index
      const snipe = this.currentProfile.snipes[snipeIndex];
      if (!snipe) {
        return { success: false, error: 'Snipe not found' };
      }

      const newState = await this.profileManager.toggleSnipe(this.currentProfile.name, snipe.id);
      
      // Reload profile to get updated data
      const reloadedProfile = await this.profileManager.loadProfile(this.currentProfile.name);
      this.currentProfile = reloadedProfile || undefined;

      return {
        success: true,
        message: `${newState ? '✅' : '⏸️'} ${newState ? 'Activated' : 'Deactivated'} snipe: ${chalk.yellow(snipe.tokenAddress.substring(0, 10))}...`,
        data: { snipe, active: newState }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle snipe'
      };
    }
  }

  /**
   * Remove a snipe
   */
  public async removeSnipe(index: string): Promise<CommandResult> {
    try {
      if (!this.currentProfile) {
        return { success: false, error: 'No profile selected. Use switch-profile first.' };
      }

      const validation = ValidationService.validateSnipeIndex(index, this.currentProfile.snipes.length);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const snipeIndex = parseInt(index, 10) - 1; // Convert to 0-based index
      const snipe = this.currentProfile.snipes[snipeIndex];
      if (!snipe) {
        return { success: false, error: 'Snipe not found' };
      }

      await this.profileManager.removeSnipe(this.currentProfile.name, snipe.id);
      
      // Reload profile to get updated data
      const reloadedProfile = await this.profileManager.loadProfile(this.currentProfile.name);
      this.currentProfile = reloadedProfile || undefined;

      return {
        success: true,
        message: `🗑️  Removed snipe: ${chalk.red(snipe.tokenAddress.substring(0, 10))}...`,
        data: { removedSnipe: snipe }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove snipe'
      };
    }
  }

  /**
   * Test a snipe on regtest
   */
  public async testSnipe(index: string): Promise<CommandResult> {
    try {
      if (!this.currentProfile) {
        return { success: false, error: 'No profile selected. Use switch-profile first.' };
      }

      const validation = ValidationService.validateSnipeIndex(index, this.currentProfile.snipes.length);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const snipeIndex = parseInt(index, 10) - 1;
      const snipe = this.currentProfile.snipes[snipeIndex];
      if (!snipe) {
        return { success: false, error: 'Snipe not found' };
      }

      // Restore FlashNet wallet for this snipe
      const wallet = await this.walletManager.restoreWallet(snipe.encryptedMnemonic, 'REGTEST');

      // Find pool using FlashNet SDK
      const poolsResponse = await this.walletManager.listPools(wallet);
      
      // Handle both array and object with pools property
      const pools = Array.isArray(poolsResponse) ? poolsResponse : (poolsResponse.pools || []);
      
      if (!Array.isArray(pools)) {
        console.log(chalk.yellow('⚠️  Unexpected pools response format:', typeof poolsResponse));
        return {
          success: false,
          error: 'Failed to retrieve pools list from FlashNet API'
        };
      }
      
      const pool = pools.find((p: any) => 
        p.assetATokenPublicKey === snipe.tokenAddress || 
        p.assetBTokenPublicKey === snipe.tokenAddress ||
        p.tokenPublicKey === snipe.tokenAddress ||
        p.poolId === snipe.tokenAddress
      );
      
      if (!pool) {
        return {
          success: false,
          error: `Pool not found for token ${snipe.tokenAddress.substring(0, 10)}... on REGTEST network`
        };
      }

      // Simulate the swap using FlashNet SDK
      const amountInSats = Math.floor(parseFloat(snipe.amountBtc) * 100000000); // Convert BTC to satoshis
      const simulation = await this.walletManager.simulateSwap(wallet, {
        poolId: pool.poolId,
        assetInTokenPublicKey: pool.assetBTokenPublicKey, // Assuming BTC is asset B
        assetOutTokenPublicKey: snipe.tokenAddress,
        amountIn: amountInSats
      });

      return {
        success: true,
        message: `🧪 Test simulation successful on REGTEST:\n` +
                `   Pool: ${chalk.yellow(pool.poolId.substring(0, 10))}...\n` +
                `   Amount In: ${chalk.green(snipe.amountBtc)} BTC\n` +
                `   Expected Out: ${chalk.cyan(simulation.amountOut || 'N/A')} tokens\n` +
                `   Price Impact: ${chalk.yellow((simulation.priceImpact || 0).toFixed(2))}%`,
        data: { snipe, pool, simulation }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test snipe'
      };
    }
  }

  /**
   * Start monitoring mode
   */
  public async startMonitoring(): Promise<CommandResult> {
    try {
      if (!this.currentProfile) {
        return { success: false, error: 'No profile selected. Use switch-profile first.' };
      }

      const activeSnipes = this.currentProfile.snipes.filter(s => s.isActive);
      if (activeSnipes.length === 0) {
        return { success: false, error: 'No active snipes configured. Add and activate snipes first.' };
      }

      // Start network monitoring
      await this.networkDetector.startMonitoring('MAINNET');

      return {
        success: true,
        message: `🔍 Started monitoring for ${chalk.cyan(activeSnipes.length)} active snipes`,
        data: { activeSnipes, profile: this.currentProfile.name }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start monitoring'
      };
    }
  }

  /**
   * Stop monitoring mode
   */
  public stopMonitoring(): CommandResult {
    try {
      this.networkDetector.stopMonitoring();
      
      return {
        success: true,
        message: '⏹️  Stopped monitoring'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop monitoring'
      };
    }
  }

  /**
   * Get current profile
   */
  public getCurrentProfile(): Profile | undefined {
    return this.currentProfile;
  }

  /**
   * Get network detector
   */
  public getNetworkDetector(): NetworkDetector {
    return this.networkDetector;
  }

  /**
   * Get network status
   */
  public getNetworkStatus(): CommandResult {
    const status = this.networkDetector.getStatus();
    const isMonitoring = this.networkDetector.isMonitoring();

    return {
      success: true,
      data: { ...status, isMonitoring }
    };
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.networkDetector.destroy();
    
    if (this.currentProfile) {
      await this.profileManager.releaseLock(this.currentProfile.name);
    }
  }
}