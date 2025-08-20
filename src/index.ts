#!/usr/bin/env node

import { CLIInterface } from './cli/interface';
import { config } from './utils/config';
import { ValidationService } from './utils/validation';
import chalk from 'chalk';
import path from 'path';

/**
 * Clunkers - FlashNet Token Sniper
 * Dark. Technical. Lightning Fast.
 */
async function main(): Promise<void> {
  try {
    // Display initialization message
    console.log(chalk.hex('#00D9FF')('🔧 Initializing Clunkers...'));
    
    // Validate environment
    const envValidation = ValidationService.validateEnvironment();
    const hasErrors = envValidation.some(result => !result.valid);
    
    if (hasErrors) {
      console.error(chalk.red('❌ Environment validation failed:'));
      envValidation.forEach(result => {
        if (!result.valid) {
          console.error(chalk.red(`   ${result.error}`));
        }
      });
      
      console.log(chalk.yellow('\n💡 Create a .env file with required configuration:'));
      console.log(chalk.gray('   cp .env.example .env'));
      console.log(chalk.gray('   # Edit .env with your configuration'));
      
      process.exit(1);
    }

    // Show configuration summary if debug mode
    if (config.get('debug')) {
      console.log(chalk.gray('✅ Environment validated'));
      console.log(chalk.gray(`   FlashNet Mainnet: ${config.get('flashnetMainnetUrl')}`));
      console.log(chalk.gray(`   FlashNet Regtest: ${config.get('flashnetRegtestUrl')}`));
      console.log(chalk.gray(`   Default Network: ${config.get('defaultNetwork')}`));
      console.log(chalk.gray(`   Poll Interval: ${config.get('mainnetPollInterval')}ms`));
      
      if (config.get('sparkscanApiKey')) {
        console.log(chalk.gray('   SparkScan: ✅ Configured'));
      }
      
      if (config.get('discordWebhookUrl')) {
        console.log(chalk.gray('   Discord: ✅ Configured'));
      }
    }

    // Initialize CLI interface
    const baseDir = process.cwd();
    const cli = new CLIInterface(baseDir);
    
    console.log(chalk.green('✅ Clunkers initialized successfully\n'));
    
    // Start CLI
    await cli.start();
    
  } catch (error) {
    console.error(chalk.red('💥 Fatal error:'), error instanceof Error ? error.message : 'Unknown error');
    
    if (config.get('debug') && error instanceof Error && error.stack) {
      console.error(chalk.gray('Stack trace:'));
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('💥 Unhandled Promise Rejection:'), reason);
  console.error(chalk.gray('Promise:'), promise);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('💥 Uncaught Exception:'), error.message);
  
  if (config.get('debug') && error.stack) {
    console.error(chalk.gray('Stack trace:'));
    console.error(chalk.gray(error.stack));
  }
  
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error(chalk.red('💥 Application failed to start:'), error);
  process.exit(1);
});