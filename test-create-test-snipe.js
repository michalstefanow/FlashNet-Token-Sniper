#!/usr/bin/env node

const { FlashNetWalletManager } = require('./dist/core/flashnet-wallet-manager');
const chalk = require('chalk');

async function createTestSnipe() {
  console.log(chalk.cyan('\n🎯 Creating Test Snipe with Existing Pool\n'));
  
  try {
    const walletManager = new FlashNetWalletManager();
    
    // Generate a test wallet
    console.log(chalk.yellow('1. Generating test wallet...'));
    const wallet = await walletManager.generateWallet({
      network: 'REGTEST'
    });
    
    // List pools to find an existing one
    console.log(chalk.yellow('\n2. Finding existing pools...'));
    const poolsResponse = await walletManager.listPools(wallet, { limit: 10 });
    const pools = poolsResponse.pools || [];
    
    if (pools.length === 0) {
      console.log(chalk.red('   ❌ No pools available on REGTEST'));
      return;
    }
    
    // Find a pool with reasonable liquidity
    const activePool = pools.find(p => 
      p.assetBReserve > 0 && 
      p.assetAReserve > 0 &&
      p.assetBAddress === '020202020202020202020202020202020202020202020202020202020202020202' // BTC
    );
    
    if (!activePool) {
      console.log(chalk.yellow('   ⚠️  No active BTC pools found'));
      console.log('\n   Available pools:');
      pools.forEach((p, i) => {
        console.log(`   ${i+1}. Token: ${p.assetAAddress.substring(0, 20)}...`);
        console.log(`      BTC Reserve: ${p.assetBReserve} sats`);
      });
      return;
    }
    
    console.log(chalk.green('\n   ✅ Found active pool!'));
    console.log('   Pool ID:', activePool.lpPublicKey);
    console.log('   Token:', activePool.assetAAddress);
    console.log('   BTC Reserve:', activePool.assetBReserve, 'sats');
    console.log('   Token Reserve:', activePool.assetAReserve);
    console.log('   Current Price:', activePool.currentPriceAInB);
    
    console.log(chalk.cyan('\n3. Suggested test snipe command:'));
    console.log(chalk.white(`   npm run start`));
    console.log(chalk.white(`   Then: Add Snipe`));
    console.log(chalk.white(`   Token Address: ${chalk.yellow(activePool.assetAAddress)}`));
    console.log(chalk.white(`   BTC Amount: ${chalk.green('0.0001')}`));
    
    console.log(chalk.cyan('\n4. Alternative - Use Pool ID directly:'));
    console.log(chalk.white(`   Token Address: ${chalk.yellow(activePool.lpPublicKey)}`));
    
    // Test swap simulation
    console.log(chalk.yellow('\n5. Testing swap simulation...'));
    try {
      const simulation = await walletManager.simulateSwap(wallet, {
        poolId: activePool.lpPublicKey,
        assetInTokenPublicKey: activePool.assetBAddress, // BTC
        assetOutTokenPublicKey: activePool.assetAAddress, // Token
        amountIn: 10000 // 0.0001 BTC in sats
      });
      
      console.log(chalk.green('   ✅ Swap simulation successful!'));
      console.log('   Input: 10000 sats (0.0001 BTC)');
      console.log('   Expected output:', simulation.amountOut, 'tokens');
      console.log('   Price impact:', simulation.priceImpact || 'N/A');
    } catch (error) {
      console.log(chalk.yellow('   ⚠️  Swap simulation failed:', error.message));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error.message);
    console.error(error);
  }
}

createTestSnipe();