import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';

// Initialize Bitcoin library with secp256k1
bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);

export interface BitcoinWalletInfo {
  address: string;
  publicKey: string;
  derivationPath: string;
}

export class BitcoinWalletUtils {
  /**
   * Generate Bitcoin Taproot address from mnemonic or hex seed
   * Compatible with funding wallets on Bitcoin network
   */
  public static generateBitcoinAddress(
    mnemonicOrSeed: string,
    network: 'MAINNET' | 'REGTEST' = 'REGTEST',
    accountIndex: number = 0
  ): BitcoinWalletInfo {
    // Determine Bitcoin network
    const btcNetwork = network === 'MAINNET' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.regtest;

    // Check if input is hex seed or mnemonic
    let seed: Buffer;
    if (mnemonicOrSeed.match(/^[0-9a-fA-F]{64}$/)) {
      // It's a hex seed
      seed = Buffer.from(mnemonicOrSeed, 'hex');
    } else if (bip39.validateMnemonic(mnemonicOrSeed)) {
      // It's a mnemonic
      seed = bip39.mnemonicToSeedSync(mnemonicOrSeed);
    } else {
      // Treat as hex seed (for compatibility with FlashNet SDK)
      seed = Buffer.from(mnemonicOrSeed, 'hex');
    }

    // Create HD wallet from seed
    const root = bip32.fromSeed(seed, btcNetwork);
    
    // Use BIP86 derivation path for Taproot (P2TR)
    // m/86'/0'/account'/0/0 for mainnet
    // m/86'/1'/account'/0/0 for testnet/regtest
    const coinType = network === 'MAINNET' ? 0 : 1;
    const derivationPath = `m/86'/${coinType}'/${accountIndex}'/0/0`;
    
    const child = root.derivePath(derivationPath);
    
    // Generate Taproot address (P2TR)
    const internalPubkey = child.publicKey.slice(1, 33); // Remove prefix byte
    
    const { address } = bitcoin.payments.p2tr({
      internalPubkey: Buffer.from(internalPubkey),
      network: btcNetwork
    });

    if (!address) {
      throw new Error('Failed to generate Bitcoin Taproot address');
    }

    return {
      address,
      publicKey: child.publicKey.toString('hex'),
      derivationPath
    };
  }

  /**
   * Generate Bitcoin Taproot address from the same seed used by FlashNet
   * This ensures the Bitcoin address is linked to the same wallet
   */
  public static generateLinkedBitcoinAddress(
    hexSeed: string,
    network: 'MAINNET' | 'REGTEST' = 'REGTEST'
  ): BitcoinWalletInfo {
    return this.generateBitcoinAddress(hexSeed, network, 0);
  }

  /**
   * Validate if an address is a valid Bitcoin Taproot address
   */
  public static isValidTaprootAddress(address: string, network: 'MAINNET' | 'REGTEST' = 'REGTEST'): boolean {
    try {
      const btcNetwork = network === 'MAINNET' 
        ? bitcoin.networks.bitcoin 
        : bitcoin.networks.regtest;

      const decoded = bitcoin.address.fromBech32(address);
      
      // Check if it's a Taproot address (witness version 1)
      if (decoded.version !== 1) {
        return false;
      }

      // Check network prefix
      const expectedPrefix = network === 'MAINNET' ? 'bc' : 'bcrt';
      return address.startsWith(expectedPrefix + '1p');
    } catch {
      return false;
    }
  }

  /**
   * Get the network prefix for Bitcoin addresses
   */
  public static getNetworkPrefix(network: 'MAINNET' | 'REGTEST'): string {
    return network === 'MAINNET' ? 'bc1p' : 'bcrt1p';
  }
}