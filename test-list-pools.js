#!/usr/bin/env node

const { FlashNetWalletManager } = require('./dist/core/flashnet-wallet-manager');
const chalk = require('chalk');

async function testListPools() {
  console.log(chalk.cyan('\n🔍 Testing FlashNet Pool Listing\n'));
  
  try {
    const walletManager = new FlashNetWalletManager();
    
    // Generate a test wallet
    console.log(chalk.yellow('1. Generating test wallet...'));
    const wallet = await walletManager.generateWallet({
      network: 'REGTEST'
    });
    console.log(chalk.green('   ✅ Wallet generated'));
    console.log('   Spark:', wallet.address);
    
    // List pools
    console.log(chalk.yellow('\n2. Listing pools from FlashNet...'));
    const poolsResponse = await walletManager.listPools(wallet, { limit: 5 });
    
    console.log(chalk.cyan('\n3. Response structure:'));
    console.log('   Type:', typeof poolsResponse);
    console.log('   Is Array:', Array.isArray(poolsResponse));
    console.log('   Has pools property:', poolsResponse.pools !== undefined);
    
    // Extract pools array
    const pools = Array.isArray(poolsResponse) ? poolsResponse : (poolsResponse.pools || []);
    
    if (Array.isArray(pools)) {
      console.log(chalk.green(`\n   ✅ Found ${pools.length} pools`));
      
      if (pools.length > 0) {
        console.log(chalk.cyan('\n4. First pool structure:'));
        const firstPool = pools[0];
        console.log('   Keys:', Object.keys(firstPool).join(', '));
        
        console.log(chalk.cyan('\n5. Sample pools:'));
        pools.slice(0, 3).forEach((pool, index) => {
          console.log(chalk.yellow(`\n   Pool ${index + 1}:`));
          console.log('   poolId:', pool.poolId || pool.lpPublicKey || 'N/A');
          console.log('   assetA:', pool.assetATokenPublicKey || pool.assetAAddress || 'N/A');
          console.log('   assetB:', pool.assetBTokenPublicKey || pool.assetBAddress || 'N/A');
          console.log('   tokenPublicKey:', pool.tokenPublicKey || 'N/A');
        });
      }
    } else {
      console.log(chalk.red('   ❌ Pools is not an array'));
      console.log('   Actual response:', JSON.stringify(poolsResponse, null, 2).substring(0, 500));
    }
    
    // Test BTKN address
    const btknAddress = 'btknrt14jjr89gvd62tzhz8qcgp2u8l9guce0ss47m8zjkcp98tepky7y4qesh0dl';
    console.log(chalk.yellow(`\n6. Searching for BTKN token: ${btknAddress.substring(0, 30)}...`));
    
    const btknPool = pools.find(p => 
      p.assetATokenPublicKey === btknAddress ||
      p.assetBTokenPublicKey === btknAddress ||
      p.tokenPublicKey === btknAddress ||
      p.assetAAddress === btknAddress ||
      p.assetBAddress === btknAddress
    );
    
    if (btknPool) {
      console.log(chalk.green('   ✅ Found pool for BTKN token!'));
      console.log('   Pool ID:', btknPool.poolId || btknPool.lpPublicKey);
    } else {
      console.log(chalk.yellow('   ⚠️  No pool found for this BTKN token'));
      console.log('   This token might not have a pool yet on REGTEST');
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error.message);
    console.error(error);
  }
}

testListPools();