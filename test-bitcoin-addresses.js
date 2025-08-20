#!/usr/bin/env node

const { BitcoinWalletUtils } = require('./dist/utils/bitcoin-wallet');
const { FlashNetWalletManager } = require('./dist/core/flashnet-wallet-manager');
const crypto = require('crypto');
const chalk = require('chalk');

async function testBitcoinAddressGeneration() {
  console.log(chalk.cyan('\n🔍 Testing Bitcoin Taproot Address Generation\n'));
  
  try {
    // Test 1: Generate Bitcoin address from hex seed
    console.log(chalk.yellow('Test 1: Generate Bitcoin address from hex seed'));
    const hexSeed = crypto.randomBytes(32).toString('hex');
    console.log('Hex seed:', hexSeed.substring(0, 20) + '...');
    
    const btcInfo = BitcoinWalletUtils.generateLinkedBitcoinAddress(hexSeed, 'REGTEST');
    console.log(chalk.green('✅ Bitcoin address generated:'));
    console.log('  Address:', chalk.hex('#FFA500')(btcInfo.address));
    console.log('  Public Key:', btcInfo.publicKey.substring(0, 20) + '...');
    console.log('  Derivation Path:', btcInfo.derivationPath);
    
    // Validate the address format
    const isValid = BitcoinWalletUtils.isValidTaprootAddress(btcInfo.address, 'REGTEST');
    console.log('  Valid Taproot:', isValid ? chalk.green('YES') : chalk.red('NO'));
    console.log('  Expected prefix:', BitcoinWalletUtils.getNetworkPrefix('REGTEST'));
    
    // Test 2: Generate FlashNet wallet with Bitcoin address
    console.log(chalk.yellow('\nTest 2: FlashNet wallet with Bitcoin address'));
    const walletManager = new FlashNetWalletManager();
    const wallet = await walletManager.generateWallet({
      network: 'REGTEST'
    });
    
    console.log(chalk.green('✅ FlashNet wallet generated:'));
    console.log('  Spark address:', chalk.cyan(wallet.address));
    if (wallet.bitcoinAddress) {
      console.log('  Bitcoin address:', chalk.hex('#FFA500')(wallet.bitcoinAddress));
      console.log(chalk.green('  ✅ Both addresses available for this wallet!'));
    } else {
      console.log(chalk.yellow('  ⚠️  Bitcoin address not available from SDK'));
    }
    
    // Test 3: Multiple addresses from same seed
    console.log(chalk.yellow('\nTest 3: Multiple Bitcoin addresses from same seed'));
    const testSeed = crypto.randomBytes(32).toString('hex');
    
    for (let i = 0; i < 3; i++) {
      const btc = BitcoinWalletUtils.generateBitcoinAddress(testSeed, 'REGTEST', i);
      console.log(`  Account ${i}: ${chalk.hex('#FFA500')(btc.address)}`);
    }
    
    console.log(chalk.green('\n✅ All tests completed successfully!'));
    console.log(chalk.dim('\nYou can now fund the Bitcoin (bcrt1p...) addresses with BTC'));
    console.log(chalk.dim('The Spark (sprt1p...) addresses are used for FlashNet trading'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error.message);
    console.error(error);
  }
}

testBitcoinAddressGeneration();