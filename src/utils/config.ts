import dotenv from 'dotenv';
import path from 'path';
import { ValidationService } from './validation';

export interface AppConfig {
  // FlashNet Configuration
  flashnetMainnetUrl: string;
  flashnetRegtestUrl: string;
  
  // Optional SparkScan Configuration
  sparkscanApiKey?: string;
  sparkscanBaseUrl?: string;
  
  // Discord Notifications
  discordWebhookUrl?: string;
  
  // Security
  encryptionKey?: string;
  
  // Development
  debug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  
  // Network Settings
  defaultNetwork: 'MAINNET' | 'REGTEST';
  mainnetPollInterval: number;
  maxRetryAttempts: number;
  initialRetryDelay: number;
  maxRetryDelay: number;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;

  private constructor() {
    this.loadEnvironment();
    this.config = this.parseConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get the current configuration
   */
  public getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   */
  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * Update configuration at runtime
   */
  public update<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
  }

  /**
   * Check if we're in development mode
   */
  public isDevelopment(): boolean {
    return this.config.debug || process.env.NODE_ENV === 'development';
  }

  /**
   * Check if we're in production mode
   */
  public isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Get the current network URL based on network type
   */
  public getNetworkUrl(network: 'MAINNET' | 'REGTEST'): string {
    return network === 'MAINNET' 
      ? this.config.flashnetMainnetUrl 
      : this.config.flashnetRegtestUrl;
  }

  /**
   * Load environment variables from .env file
   */
  private loadEnvironment(): void {
    // Try to load .env file from current directory
    const envPath = path.resolve(process.cwd(), '.env');
    
    try {
      dotenv.config({ path: envPath });
    } catch (error) {
      // .env file is optional, continue without it
      console.warn('⚠️  No .env file found, using environment variables and defaults');
    }
  }

  /**
   * Parse environment variables into configuration object
   */
  private parseConfiguration(): AppConfig {
    return {
      // FlashNet URLs (required)
      flashnetMainnetUrl: process.env.FLASHNET_MAINNET_URL || 'https://api.amm.flashnet.xyz/v1',
      flashnetRegtestUrl: process.env.FLASHNET_REGTEST_URL || 'https://api.amm.makebitcoingreatagain.dev/v1',
      
      // Optional SparkScan
      sparkscanApiKey: process.env.SPARKSCAN_API_KEY,
      sparkscanBaseUrl: process.env.SPARKSCAN_BASE_URL || 'https://api.sparkscan.io',
      
      // Discord
      discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
      
      // Security
      encryptionKey: process.env.ENCRYPTION_KEY,
      
      // Development
      debug: this.parseBoolean(process.env.DEBUG, false),
      logLevel: this.parseLogLevel(process.env.LOG_LEVEL),
      
      // Network Settings
      defaultNetwork: this.parseNetwork(process.env.DEFAULT_NETWORK),
      mainnetPollInterval: this.parseInt(process.env.MAINNET_POLL_INTERVAL, 2000),
      maxRetryAttempts: this.parseInt(process.env.MAX_RETRY_ATTEMPTS, 20),
      initialRetryDelay: this.parseInt(process.env.INITIAL_RETRY_DELAY, 2000),
      maxRetryDelay: this.parseInt(process.env.MAX_RETRY_DELAY, 5000)
    };
  }

  /**
   * Validate the configuration
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate required URLs
    try {
      new URL(this.config.flashnetMainnetUrl);
    } catch {
      errors.push(`Invalid FLASHNET_MAINNET_URL: ${this.config.flashnetMainnetUrl}`);
    }

    try {
      new URL(this.config.flashnetRegtestUrl);
    } catch {
      errors.push(`Invalid FLASHNET_REGTEST_URL: ${this.config.flashnetRegtestUrl}`);
    }

    // Validate optional Discord webhook
    if (this.config.discordWebhookUrl) {
      const validation = ValidationService.validateDiscordWebhook(this.config.discordWebhookUrl);
      if (!validation.valid) {
        errors.push(`Invalid Discord webhook URL: ${validation.error}`);
      }
    }

    // Validate SparkScan URL if provided
    if (this.config.sparkscanBaseUrl) {
      try {
        new URL(this.config.sparkscanBaseUrl);
      } catch {
        errors.push(`Invalid SPARKSCAN_BASE_URL: ${this.config.sparkscanBaseUrl}`);
      }
    }

    // Validate numeric ranges
    if (this.config.mainnetPollInterval < 1000) {
      errors.push('MAINNET_POLL_INTERVAL must be at least 1000ms');
    }

    if (this.config.mainnetPollInterval > 30000) {
      errors.push('MAINNET_POLL_INTERVAL should not exceed 30000ms');
    }

    if (this.config.maxRetryAttempts < 1 || this.config.maxRetryAttempts > 100) {
      errors.push('MAX_RETRY_ATTEMPTS must be between 1 and 100');
    }

    if (this.config.initialRetryDelay < 100 || this.config.initialRetryDelay > 10000) {
      errors.push('INITIAL_RETRY_DELAY must be between 100ms and 10000ms');
    }

    if (this.config.maxRetryDelay < this.config.initialRetryDelay) {
      errors.push('MAX_RETRY_DELAY must be greater than or equal to INITIAL_RETRY_DELAY');
    }

    // Warn about missing optional configuration
    const warnings: string[] = [];

    if (!this.config.encryptionKey) {
      warnings.push('No ENCRYPTION_KEY provided - one will be generated');
    }

    if (!this.config.sparkscanApiKey) {
      warnings.push('No SPARKSCAN_API_KEY provided - SparkScan features disabled');
    }

    if (!this.config.discordWebhookUrl) {
      warnings.push('No DISCORD_WEBHOOK_URL provided - Discord notifications disabled');
    }

    // Output validation results
    if (errors.length > 0) {
      console.error('❌ Configuration validation failed:');
      errors.forEach(error => console.error(`   ${error}`));
      throw new Error('Invalid configuration. Please check your environment variables.');
    }

    if (warnings.length > 0 && this.config.debug) {
      console.warn('⚠️  Configuration warnings:');
      warnings.forEach(warning => console.warn(`   ${warning}`));
    }

    if (this.config.debug) {
      console.log('✅ Configuration validated successfully');
      this.logConfiguration();
    }
  }

  /**
   * Log configuration (excluding sensitive data)
   */
  private logConfiguration(): void {
    const safeConfig = {
      ...this.config,
      encryptionKey: this.config.encryptionKey ? '[REDACTED]' : undefined,
      sparkscanApiKey: this.config.sparkscanApiKey ? '[REDACTED]' : undefined,
      discordWebhookUrl: this.config.discordWebhookUrl ? '[REDACTED]' : undefined
    };

    console.log('📋 Current configuration:');
    console.log(JSON.stringify(safeConfig, null, 2));
  }

  /**
   * Parse boolean from string
   */
  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Parse integer from string with fallback
   */
  private parseInt(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Parse log level with validation
   */
  private parseLogLevel(value: string | undefined): 'error' | 'warn' | 'info' | 'debug' {
    const validLevels = ['error', 'warn', 'info', 'debug'] as const;
    if (value && validLevels.includes(value as any)) {
      return value as 'error' | 'warn' | 'info' | 'debug';
    }
    return 'info';
  }

  /**
   * Parse network type with validation
   */
  private parseNetwork(value: string | undefined): 'MAINNET' | 'REGTEST' {
    if (value && (value === 'MAINNET' || value === 'REGTEST')) {
      return value;
    }
    return 'REGTEST'; // Default to regtest for safety
  }

  /**
   * Create a .env file template
   */
  public static createEnvTemplate(filePath: string): string {
    const template = `# FlashNet API Configuration
FLASHNET_MAINNET_URL=https://api.amm.flashnet.xyz/v1
FLASHNET_REGTEST_URL=https://api.amm.makebitcoingreatagain.dev/v1

# Optional: SparkScan API (for token validation)
SPARKSCAN_API_KEY=your_sparkscan_api_key_here
SPARKSCAN_BASE_URL=https://api.sparkscan.io

# Discord Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_here

# Security (auto-generated on first run if not provided)
ENCRYPTION_KEY=

# Development
DEBUG=false
LOG_LEVEL=info

# Network Settings
DEFAULT_NETWORK=REGTEST
MAINNET_POLL_INTERVAL=2000
MAX_RETRY_ATTEMPTS=20
INITIAL_RETRY_DELAY=2000
MAX_RETRY_DELAY=5000`;

    return template;
  }
}

// Convenience function for getting configuration
export const getConfig = (): AppConfig => ConfigManager.getInstance().getConfig();
export const config = ConfigManager.getInstance();