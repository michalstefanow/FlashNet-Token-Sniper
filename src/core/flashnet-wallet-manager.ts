import { IssuerSparkWallet } from '@buildonspark/issuer-sdk';
import { FlashnetClient } from '@flashnet/sdk';
import { EncryptionService } from '../utils/encryption';
import { BitcoinWalletUtils } from '../utils/bitcoin-wallet';
import { Wallet, WalletGenerationOptions, WalletImportOptions } from '../types/wallet';

export interface FlashNetWallet {
  address: string;
  bitcoinAddress?: string; // Bitcoin Taproot address for funding
  client: FlashnetClient;
  encryptedMnemonic?: string;
  network: 'MAINNET' | 'REGTEST';
  createdAt: Date;
}

export class FlashNetWalletManager {
  private encryption: EncryptionService;

  constructor() {
    this.encryption = EncryptionService.getInstance();
  }

  /**
   * Generate a new FlashNet wallet with SDK
   */
  public async generateWallet(options: WalletGenerationOptions): Promise<FlashNetWallet> {
    try {
      let mnemonic: string;
      
      if (options.useCustomEntropy && options.customEntropy) {
        // For testing - use entropy as hex seed
        mnemonic = Buffer.from(options.customEntropy).toString('hex');
      } else {
        // Generate random hex seed
        const crypto = require('crypto');
        mnemonic = crypto.randomBytes(32).toString('hex');
      }

      // Initialize wallet with FlashNet SDK
      const { wallet } = await IssuerSparkWallet.initialize({
        mnemonicOrSeed: mnemonic,
        options: { network: options.network }
      });

      // Create FlashNet client
      const client = new FlashnetClient(wallet);
      await client.initialize(); // Auto-authenticates

      // Generate Bitcoin Taproot address for funding
      let bitcoinAddress: string | undefined;
      try {
        const btcInfo = BitcoinWalletUtils.generateLinkedBitcoinAddress(mnemonic, options.network);
        bitcoinAddress = btcInfo.address;
      } catch (error) {
        console.log('⚠️  Could not generate Bitcoin deposit address:', error);
      }

      const flashNetWallet: FlashNetWallet = {
        address: client.address,
        bitcoinAddress,
        client,
        encryptedMnemonic: this.encryption.encrypt(mnemonic),
        network: options.network,
        createdAt: new Date()
      };

      console.log(`🔑 Generated FlashNet wallet:`);
      console.log(`   Spark: ${flashNetWallet.address.substring(0, 20)}...`);
      if (bitcoinAddress) {
        console.log(`   Bitcoin: ${bitcoinAddress.substring(0, 20)}...`);
      }
      return flashNetWallet;
    } catch (error) {
      throw new Error(`Failed to generate FlashNet wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import wallet from mnemonic using FlashNet SDK
   */
  public async importWallet(options: WalletImportOptions): Promise<FlashNetWallet> {
    try {
      if (!options.mnemonic) {
        throw new Error('Mnemonic is required for FlashNet wallet import');
      }

      // Initialize wallet with FlashNet SDK
      const { wallet } = await IssuerSparkWallet.initialize({
        mnemonicOrSeed: options.mnemonic,
        options: { network: options.network }
      });

      // Create FlashNet client
      const client = new FlashnetClient(wallet);
      await client.initialize(); // Auto-authenticates

      // Generate Bitcoin Taproot address for funding
      let bitcoinAddress: string | undefined;
      try {
        const btcInfo = BitcoinWalletUtils.generateLinkedBitcoinAddress(options.mnemonic, options.network);
        bitcoinAddress = btcInfo.address;
      } catch (error) {
        console.log('⚠️  Could not generate Bitcoin deposit address:', error);
      }

      const flashNetWallet: FlashNetWallet = {
        address: client.address,
        bitcoinAddress,
        client,
        encryptedMnemonic: this.encryption.encrypt(options.mnemonic),
        network: options.network,
        createdAt: new Date()
      };

      console.log(`📥 Imported FlashNet wallet:`);
      console.log(`   Spark: ${flashNetWallet.address.substring(0, 20)}...`);
      if (bitcoinAddress) {
        console.log(`   Bitcoin: ${bitcoinAddress.substring(0, 20)}...`);
      }
      return flashNetWallet;
    } catch (error) {
      throw new Error(`Failed to import FlashNet wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore wallet from encrypted mnemonic
   */
  public async restoreWallet(encryptedMnemonic: string, network: 'MAINNET' | 'REGTEST'): Promise<FlashNetWallet> {
    try {
      const mnemonic = this.encryption.decrypt(encryptedMnemonic);
      
      return await this.importWallet({
        mnemonic,
        network
      });
    } catch (error) {
      throw new Error(`Failed to restore FlashNet wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wallet balance using FlashNet SDK
   */
  public async getBalance(wallet: FlashNetWallet): Promise<any> {
    try {
      return await wallet.client.getBalance();
    } catch (error) {
      throw new Error(`Failed to get wallet balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute swap using FlashNet SDK
   */
  public async executeSwap(wallet: FlashNetWallet, swapParams: any): Promise<any> {
    try {
      return await wallet.client.executeSwap(swapParams);
    } catch (error) {
      throw new Error(`Failed to execute swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Simulate swap using FlashNet SDK
   */
  public async simulateSwap(wallet: FlashNetWallet, swapParams: any): Promise<any> {
    try {
      return await wallet.client.simulateSwap(swapParams);
    } catch (error) {
      throw new Error(`Failed to simulate swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List pools using FlashNet SDK
   */
  public async listPools(wallet: FlashNetWallet, params?: any): Promise<any> {
    try {
      return await wallet.client.listPools(params);
    } catch (error) {
      throw new Error(`Failed to list pools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific pool using FlashNet SDK
   */
  public async getPool(wallet: FlashNetWallet, poolId: string): Promise<any> {
    try {
      return await wallet.client.getPool(poolId);
    } catch (error) {
      throw new Error(`Failed to get pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get decrypted mnemonic
   */
  public getMnemonic(wallet: FlashNetWallet): string | null {
    if (!wallet.encryptedMnemonic) {
      return null;
    }

    try {
      return this.encryption.decrypt(wallet.encryptedMnemonic);
    } catch (error) {
      throw new Error(`Failed to decrypt mnemonic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate deterministic wallet for testing
   */
  public async generateTestWallet(seed: string, network: 'MAINNET' | 'REGTEST' = 'REGTEST'): Promise<FlashNetWallet> {
    // Create a deterministic hex seed from the string
    const crypto = require('crypto');
    const hexSeed = crypto.createHash('sha256').update(seed).digest('hex');
    
    return this.importWallet({
      mnemonic: hexSeed, // Use hex seed directly
      network
    });
  }

  /**
   * Verify wallet is working correctly
   */
  public async verifyWallet(wallet: FlashNetWallet): Promise<boolean> {
    try {
      // Try to get balance to verify wallet is functional
      await wallet.client.getBalance();
      return true;
    } catch {
      return false;
    }
  }
}