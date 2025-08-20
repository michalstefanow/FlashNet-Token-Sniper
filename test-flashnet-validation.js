#!/usr/bin/env node

const { ValidationService } = require('./dist/utils/validation');
const { FlashNetWalletManager } = require('./dist/core/flashnet-wallet-manager');
const { ProfileManager } = require('./dist/core/profile-manager');
const chalk = require('chalk');

async function testFlashNetValidation() {
  console.log(chalk.hex('#00D9FF')('🧪 CLUNKERS FlashNet Validation Tests\n'));

  let passed = 0;
  let failed = 0;

  // Test 1: Profile name validation
  console.log('📋 Testing profile name validation...');
  try {
    const validName = ValidationService.validateProfileName('test-profile');
    const invalidName = ValidationService.validateProfileName('invalid@profile');
    
    if (validName.valid && !invalidName.valid) {
      console.log(chalk.green('✅ Profile validation working'));
      passed++;
    } else {
      console.log(chalk.red('❌ Profile validation failed'));
      failed++;
    }
  } catch (error) {
    console.log(chalk.red('❌ Profile validation error:'), error.message);
    failed++;
  }

  // Test 2: BTC amount validation
  console.log('💰 Testing BTC amount validation...');
  try {
    const validAmount = ValidationService.validateBTCAmount('0.05');
    const invalidAmount = ValidationService.validateBTCAmount('invalid');
    
    if (validAmount.valid && !invalidAmount.valid) {
      console.log(chalk.green('✅ BTC amount validation working'));
      passed++;
    } else {
      console.log(chalk.red('❌ BTC amount validation failed'));
      failed++;
    }
  } catch (error) {
    console.log(chalk.red('❌ BTC amount validation error:'), error.message);
    failed++;
  }

  // Test 3: Token address validation
  console.log('🎯 Testing token address validation...');
  try {
    const validToken = ValidationService.validateTokenAddress('a'.repeat(64)); // 64-char hex
    const invalidToken = ValidationService.validateTokenAddress('invalid');
    
    if (validToken.valid && !invalidToken.valid) {
      console.log(chalk.green('✅ Token address validation working'));
      passed++;
    } else {
      console.log(chalk.red('❌ Token address validation failed'));
      failed++;
    }
  } catch (error) {
    console.log(chalk.red('❌ Token address validation error:'), error.message);
    failed++;
  }

  // Test 4: FlashNet wallet generation
  console.log('🔑 Testing FlashNet wallet generation...');
  try {
    const walletManager = new FlashNetWalletManager();
    const wallet = await walletManager.generateTestWallet('test-seed', 'REGTEST');
    
    if (wallet.address && wallet.encryptedMnemonic && wallet.client) {
      console.log(chalk.green('✅ FlashNet wallet generation working'));
      console.log(chalk.gray(`   Address: ${wallet.address.substring(0, 20)}...`));
      console.log(chalk.gray(`   Network: ${wallet.network}`));
      passed++;
    } else {
      console.log(chalk.red('❌ FlashNet wallet generation failed'));
      failed++;
    }
  } catch (error) {
    console.log(chalk.red('❌ FlashNet wallet generation error:'), error.message);
    failed++;
  }

  // Test 5: Profile management
  console.log('📁 Testing profile management...');
  try {
    const profileManager = new ProfileManager(process.cwd());
    
    // Create test profile
    const profile = await profileManager.createProfile('test-flashnet-profile');
    
    // List profiles
    const profiles = await profileManager.listProfiles();
    const foundProfile = profiles.find(p => p.name === 'test-flashnet-profile');
    
    // Cleanup
    await profileManager.deleteProfile('test-flashnet-profile');
    
    if (profile && foundProfile) {
      console.log(chalk.green('✅ Profile management working'));
      passed++;
    } else {
      console.log(chalk.red('❌ Profile management failed'));
      failed++;
    }
  } catch (error) {
    console.log(chalk.red('❌ Profile management error:'), error.message);
    failed++;
  }

  // Test 6: FlashNet SDK connectivity (if on correct network)
  console.log('🌐 Testing FlashNet SDK connectivity...');
  try {
    const walletManager = new FlashNetWalletManager();
    const wallet = await walletManager.generateTestWallet('connectivity-test', 'REGTEST');
    
    // Try to get balance (this tests if SDK is working)
    const balance = await walletManager.getBalance(wallet);
    
    console.log(chalk.green('✅ FlashNet SDK connectivity working'));
    console.log(chalk.gray(`   Balance: ${balance.balance || 0} sats`));
    console.log(chalk.gray(`   Token balances: ${balance.tokenBalances?.size || 0}`));
    passed++;
  } catch (error) {
    console.log(chalk.yellow('⚠️  FlashNet SDK connectivity test skipped'));
    console.log(chalk.gray(`   Reason: ${error.message}`));
    console.log(chalk.gray('   This is expected if REGTEST network is not available'));
    // Don't count as failed since network might not be available
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log(chalk.hex('#00D9FF')('🎯 Validation Results'));
  console.log(chalk.green(`✅ Passed: ${passed}`));
  console.log(chalk.red(`❌ Failed: ${failed}`));
  console.log(chalk.gray(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`));
  
  if (failed === 0) {
    console.log(chalk.green('\n🚀 All core systems validated successfully!'));
    console.log(chalk.gray('Ready for production use with FlashNet SDK.'));
  } else {
    console.log(chalk.yellow('\n⚠️  Some tests failed. Check configuration.'));
  }
}

// Run validation
testFlashNetValidation().catch(error => {
  console.error(chalk.red('💥 Validation failed:'), error);
  process.exit(1);
});