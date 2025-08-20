#!/usr/bin/env node

const { IssuerSparkWallet } = require('@buildonspark/issuer-sdk');
const crypto = require('crypto');

async function testWalletAddress() {
  console.log('Testing wallet address formats...\n');
  
  try {
    // Generate test wallet
    const hexSeed = crypto.randomBytes(32).toString('hex');
    const { wallet } = await IssuerSparkWallet.initialize({
      mnemonicOrSeed: hexSeed,
      options: { network: 'REGTEST' }
    });
    
    console.log('Wallet object properties:');
    console.log('- address:', wallet.address);
    console.log('- publicKey:', wallet.publicKey);
    console.log('- network:', wallet.network);
    
    // Check if wallet has Bitcoin address
    if (wallet.bitcoinAddress) {
      console.log('- bitcoinAddress:', wallet.bitcoinAddress);
    }
    
    if (wallet.taprootAddress) {
      console.log('- taprootAddress:', wallet.taprootAddress);
    }
    
    // List all properties
    console.log('\nAll wallet properties:');
    Object.keys(wallet).forEach(key => {
      if (!key.includes('private') && !key.includes('Private')) {
        const value = wallet[key];
        if (typeof value === 'string' && value.length < 100) {
          console.log(`- ${key}:`, value);
        } else if (typeof value !== 'function' && typeof value !== 'object') {
          console.log(`- ${key}:`, value);
        }
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWalletAddress();