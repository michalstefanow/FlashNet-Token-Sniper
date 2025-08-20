#!/usr/bin/env node

const { TokenResolver } = require('./dist/utils/token-resolver');
const { ValidationService } = require('./dist/utils/validation');
const chalk = require('chalk');

async function testBTKNResolution() {
  console.log(chalk.hex('#00D9FF')('🧪 Testing BTKN Token Resolution\n'));

  const tokenResolver = new TokenResolver();
  
  // Test addresses
  const testAddresses = [
    'btknrt14jjr89gvd62tzhz8qcgp2u8l9guce0ss47m8zjkcp98tepky7y4qesh0dl',
    'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567',
    '0xa1b2c3d4e5f6789012345678901234567890123456789012345678901234567'
  ];

  for (const address of testAddresses) {
    console.log(chalk.hex('#00D9FF')('═'.repeat(50)));
    console.log(chalk.yellow('Testing:'), address.substring(0, 30) + '...');
    
    // Validate
    const validation = ValidationService.validateTokenAddress(address);
    console.log(chalk.gray('Valid:'), validation.valid ? chalk.green('✅') : chalk.red('❌'));
    
    if (validation.valid) {
      // Resolve
      try {
        const tokenInfo = await tokenResolver.resolveToken(address);
        console.log(chalk.gray('Hex ID:'), chalk.cyan(tokenInfo.hexIdentifier.substring(0, 20) + '...'));
        console.log(chalk.gray('Pool:'), tokenInfo.poolId ? chalk.green(tokenInfo.poolId.substring(0, 20) + '...') : chalk.yellow('Not found'));
        
        if (tokenInfo.btknAddress) {
          console.log(chalk.gray('BTKN:'), chalk.cyan(tokenInfo.btknAddress.substring(0, 20) + '...'));
        }
      } catch (error) {
        console.log(chalk.red('Resolution error:'), error.message);
      }
    } else {
      console.log(chalk.red('Invalid format:'), validation.error);
    }
    console.log();
  }

  // Search for pools
  console.log(chalk.hex('#00D9FF')('═'.repeat(50)));
  console.log(chalk.yellow('\n🔍 Searching for active pools...\n'));
  
  try {
    const pools = await tokenResolver.searchPools('');
    console.log(chalk.green(`Found ${pools.length} active pools`));
    
    if (pools.length > 0 && pools.length <= 3) {
      pools.forEach((pool, index) => {
        console.log(chalk.gray(`\nPool #${index + 1}:`));
        console.log(chalk.gray('  ID:'), chalk.cyan(pool.lpPublicKey.substring(0, 20) + '...'));
        console.log(chalk.gray('  Asset A:'), pool.assetAAddress.substring(0, 20) + '...');
        console.log(chalk.gray('  Asset B:'), pool.assetBAddress.substring(0, 20) + '...');
        console.log(chalk.gray('  Type:'), pool.curveType);
      });
    }
  } catch (error) {
    console.log(chalk.red('Pool search error:'), error.message);
  }
}

// Run test
testBTKNResolution().catch(error => {
  console.error(chalk.red('💥 Test failed:'), error);
  process.exit(1);
});