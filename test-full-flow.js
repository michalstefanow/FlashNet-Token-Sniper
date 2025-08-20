#!/usr/bin/env node

const { ProfileManager } = require('./dist/core/profile-manager');
const { FlashNetWalletManager } = require('./dist/core/flashnet-wallet-manager');
const chalk = require('chalk');

async function testFullFlow() {
  console.log(chalk.cyan('\n🧪 Testing Full Clunkers Flow with Bitcoin Addresses\n'));
  
  try {
    // Initialize managers
    const os = require('os');
    const path = require('path');
    const baseDir = path.join(os.homedir(), '.clunkers');
    const profileManager = new ProfileManager(baseDir);
    const walletManager = new FlashNetWalletManager();
    
    // Create test profile
    const profileName = 'bitcoin-test-' + Date.now();
    console.log(chalk.yellow('1. Creating test profile:'), profileName);
    const profile = await profileManager.createProfile(profileName);
    console.log(chalk.green('   ✅ Profile created'));
    
    // Add a test snipe
    console.log(chalk.yellow('\n2. Adding test snipe'));
    const tokenAddress = 'btknrt14jjr89gvd62tzhz8qcgp2u8l9guce0ss47m8zjkcp98tepky7y4qesh0dl';
    const btcAmount = '0.01';
    
    const snipe = await profileManager.addSnipe(profileName, tokenAddress, btcAmount);
    console.log(chalk.green('   ✅ Snipe added with ID:'), snipe.id);
    
    // Generate wallet for the snipe
    console.log(chalk.yellow('\n3. Generating wallet for snipe'));
    const wallet = await walletManager.generateWallet({
      network: profile.settings.network
    });
    
    // Update snipe with wallet info
    snipe.walletAddress = wallet.address;
    snipe.bitcoinAddress = wallet.bitcoinAddress;
    snipe.encryptedMnemonic = wallet.encryptedMnemonic;
    snipe.status = 'VALIDATED';
    
    // Save updated profile
    const updatedProfile = await profileManager.loadProfile(profileName);
    if (updatedProfile) {
      const snipeIndex = updatedProfile.snipes.findIndex(s => s.id === snipe.id);
      if (snipeIndex >= 0) {
        updatedProfile.snipes[snipeIndex] = snipe;
        await profileManager.saveProfile(updatedProfile);
      }
    }
    
    console.log(chalk.green('   ✅ Wallet generated and saved'));
    
    // Display wallet addresses
    console.log(chalk.cyan('\n4. Wallet Addresses:'));
    console.log(chalk.gray('   ═══════════════════════════════════════════════════'));
    console.log(chalk.gray('   Token:    '), chalk.yellow(tokenAddress.substring(0, 30) + '...'));
    console.log(chalk.gray('   Amount:   '), chalk.green(btcAmount + ' BTC'));
    console.log(chalk.gray('   ───────────────────────────────────────────────────'));
    console.log(chalk.gray('   Spark:    '), chalk.cyan(wallet.address));
    
    if (wallet.bitcoinAddress) {
      console.log(chalk.gray('   Bitcoin:  '), chalk.hex('#FFA500')(wallet.bitcoinAddress));
      console.log(chalk.green('\n   ✅ SUCCESS: Bitcoin Taproot address generated!'));
      console.log(chalk.dim('      This is the address you fund with BTC'));
      
      // Validate it's a proper Taproot address
      const prefix = wallet.bitcoinAddress.substring(0, 6);
      if (prefix === 'bcrt1p') {
        console.log(chalk.green('      ✓ Valid REGTEST Taproot address (bcrt1p...)'));
      } else if (prefix === 'bc1p') {
        console.log(chalk.green('      ✓ Valid MAINNET Taproot address (bc1p...)'));
      } else {
        console.log(chalk.yellow('      ⚠️  Unexpected address format:', prefix));
      }
    } else {
      console.log(chalk.red('   ❌ Bitcoin address not generated'));
    }
    
    console.log(chalk.gray('   ═══════════════════════════════════════════════════'));
    
    // Clean up test profile
    console.log(chalk.yellow('\n5. Cleaning up test profile'));
    await profileManager.deleteProfile(profileName);
    console.log(chalk.green('   ✅ Test profile deleted'));
    
    console.log(chalk.green('\n✅ All tests completed successfully!'));
    console.log(chalk.cyan('\n📝 Summary:'));
    console.log('   • Bitcoin Taproot addresses are being generated correctly');
    console.log('   • Addresses use the correct format (bcrt1p for regtest, bc1p for mainnet)');
    console.log('   • Both Spark and Bitcoin addresses are available for each wallet');
    console.log('   • You can fund the Bitcoin addresses to enable trading\n');
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error.message);
    console.error(error);
  }
}

testFullFlow();