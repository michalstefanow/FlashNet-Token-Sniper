#!/usr/bin/env node

const { IssuerSparkWallet } = require('@buildonspark/issuer-sdk');
const crypto = require('crypto');

async function testBitcoinAddress() {
  console.log('Exploring wallet for Bitcoin addresses...\n');
  
  try {
    // Generate test wallet
    const hexSeed = crypto.randomBytes(32).toString('hex');
    const { wallet } = await IssuerSparkWallet.initialize({
      mnemonicOrSeed: hexSeed,
      options: { network: 'REGTEST' }
    });
    
    console.log('Spark Address:', wallet.sparkAddress);
    
    // Check methods
    console.log('\nWallet methods:');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(wallet))
      .filter(name => typeof wallet[name] === 'function' && !name.startsWith('_'));
    
    methods.forEach(method => {
      console.log(`- ${method}()`);
    });
    
    // Try to get Bitcoin address
    if (wallet.getBitcoinAddress) {
      console.log('\nBitcoin Address:', wallet.getBitcoinAddress());
    }
    
    if (wallet.getTaprootAddress) {
      console.log('Taproot Address:', wallet.getTaprootAddress());
    }
    
    if (wallet.getAddress) {
      console.log('Address:', wallet.getAddress());
    }
    
    // Check for address conversion
    if (wallet.sparkAddressToBitcoin) {
      console.log('Converted:', wallet.sparkAddressToBitcoin(wallet.sparkAddress));
    }
    
    // Try accessing internal properties
    console.log('\nInternal properties:');
    if (wallet._wallet) {
      console.log('Has _wallet');
    }
    if (wallet._keypair) {
      console.log('Has _keypair');
    }
    if (wallet._address) {
      console.log('Has _address:', wallet._address);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testBitcoinAddress();