import { ValidationResult } from '../types/cli';

export class ValidationService {
  
  /**
   * Validate profile name
   */
  public static validateProfileName(name: string): ValidationResult {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Profile name cannot be empty' };
    }

    if (name.length > 50) {
      return { valid: false, error: 'Profile name cannot exceed 50 characters' };
    }

    // Check for valid characters (alphanumeric, hyphens, underscores)
    const validNamePattern = /^[a-zA-Z0-9_-]+$/;
    if (!validNamePattern.test(name)) {
      return { 
        valid: false, 
        error: 'Profile name can only contain letters, numbers, hyphens, and underscores',
        suggestions: ['use-letters-numbers-only', 'my_profile_name', 'profile-123']
      };
    }

    // Reserved names
    const reservedNames = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'lpt1', 'lpt2'];
    if (reservedNames.includes(name.toLowerCase())) {
      return { valid: false, error: 'Profile name cannot be a reserved system name' };
    }

    return { valid: true };
  }

  /**
   * Validate Bitcoin address (basic format check)
   */
  public static validateBitcoinAddress(address: string): ValidationResult {
    if (!address || address.trim().length === 0) {
      return { valid: false, error: 'Address cannot be empty' };
    }

    const trimmedAddress = address.trim();

    // Check basic length constraints
    if (trimmedAddress.length < 26 || trimmedAddress.length > 62) {
      return { valid: false, error: 'Address length must be between 26 and 62 characters' };
    }

    // Spark address (bech32m format starting with 'sp1')
    const sparkPattern = /^sp1[a-z0-9]{39,}$/;
    if (sparkPattern.test(trimmedAddress)) {
      return { valid: true };
    }

    // Legacy Bitcoin address patterns
    const legacyPattern = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    if (legacyPattern.test(trimmedAddress)) {
      return { valid: true };
    }

    // Bech32 pattern (bc1 for mainnet, tb1 for testnet)
    const bech32Pattern = /^(bc1|tb1)[a-z0-9]{39,59}$/;
    if (bech32Pattern.test(trimmedAddress)) {
      return { valid: true };
    }

    return { 
      valid: false, 
      error: 'Invalid address format',
      suggestions: ['Must be a valid Spark (sp1...) or Bitcoin address']
    };
  }

  /**
   * Validate token address (64-character hex or Spark format)
   */
  public static validateTokenAddress(address: string): ValidationResult {
    if (!address || address.trim().length === 0) {
      return { valid: false, error: 'Token address cannot be empty' };
    }

    const trimmedAddress = address.trim();

    // 64-character hex format (FlashNet token IDs)
    const hexPattern = /^[0-9a-fA-F]{64}$/;
    if (hexPattern.test(trimmedAddress)) {
      return { valid: true };
    }

    // BTKN address format (bech32 - starts with 'btkn' and contains alphanumeric)
    // The actual format is more flexible than standard bech32
    const btknAddressPattern = /^btkn[a-z0-9]{30,100}$/;
    if (btknAddressPattern.test(trimmedAddress)) {
      return { valid: true };
    }

    // Spark human-readable format (BTKN ticker:name)
    const btknTickerPattern = /^[a-zA-Z0-9]+:[a-zA-Z0-9]+$/;
    if (btknTickerPattern.test(trimmedAddress)) {
      return { valid: true };
    }

    // Pool ID format (similar to hex but may have different length)
    const poolIdPattern = /^[0-9a-fA-F]{40,64}$/;
    if (poolIdPattern.test(trimmedAddress)) {
      return { valid: true };
    }

    // Also accept hex with 0x prefix (64 or 66 chars with prefix)
    const hexWithPrefixPattern = /^0x[0-9a-fA-F]{64}$/i;
    if (hexWithPrefixPattern.test(trimmedAddress)) {
      return { valid: true };
    }

    return { 
      valid: false, 
      error: 'Invalid token address format',
      suggestions: [
        '64-character hex: a1b2c3d4e5f6...',
        'BTKN address: btknrt14jjr89gvd...',
        'Pool ID: 40-64 character hex'
      ]
    };
  }

  /**
   * Validate BTC amount
   */
  public static validateBTCAmount(amount: string): ValidationResult {
    if (!amount || amount.trim().length === 0) {
      return { valid: false, error: 'Amount cannot be empty' };
    }

    const trimmedAmount = amount.trim();

    // Remove 'btc' suffix if present
    const cleanAmount = trimmedAmount.toLowerCase().replace(/btc$/, '');

    // Check if it's a valid number
    const numericAmount = parseFloat(cleanAmount);
    if (isNaN(numericAmount)) {
      return { 
        valid: false, 
        error: 'Amount must be a valid number',
        suggestions: ['0.001', '0.05', '1.5', '0.1btc']
      };
    }

    // Check for reasonable bounds
    if (numericAmount <= 0) {
      return { valid: false, error: 'Amount must be greater than 0' };
    }

    if (numericAmount > 21) {
      return { valid: false, error: 'Amount cannot exceed 21 BTC (total Bitcoin supply)' };
    }

    // Check for too many decimal places (8 is max for Bitcoin)
    const decimalMatch = cleanAmount.match(/\.(\d+)/);
    if (decimalMatch && decimalMatch[1]!.length > 8) {
      return { valid: false, error: 'Amount cannot have more than 8 decimal places' };
    }

    // Warn about very small amounts
    if (numericAmount < 0.00001) {
      return { 
        valid: true, 
        suggestions: ['Warning: Very small amount, consider minimum trading requirements']
      };
    }

    return { valid: true };
  }

  /**
   * Validate Discord webhook URL
   */
  public static validateDiscordWebhook(url: string): ValidationResult {
    if (!url || url.trim().length === 0) {
      return { valid: false, error: 'Webhook URL cannot be empty' };
    }

    const trimmedUrl = url.trim();

    // Basic URL format check
    try {
      const parsedUrl = new URL(trimmedUrl);
      
      if (parsedUrl.protocol !== 'https:') {
        return { valid: false, error: 'Webhook URL must use HTTPS' };
      }

      if (!parsedUrl.hostname.includes('discord.com')) {
        return { valid: false, error: 'Must be a Discord webhook URL' };
      }

      if (!parsedUrl.pathname.includes('/api/webhooks/')) {
        return { valid: false, error: 'Invalid Discord webhook path' };
      }

      return { valid: true };
    } catch {
      return { 
        valid: false, 
        error: 'Invalid URL format',
        suggestions: ['https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN']
      };
    }
  }

  /**
   * Validate environment variables
   */
  public static validateEnvironment(): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Check required environment variables
    const requiredVars = ['FLASHNET_MAINNET_URL', 'FLASHNET_REGTEST_URL'];
    
    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value) {
        results.push({
          valid: false,
          error: `Missing required environment variable: ${varName}`
        });
      } else {
        try {
          new URL(value);
          results.push({ valid: true });
        } catch {
          results.push({
            valid: false,
            error: `Invalid URL format for ${varName}: ${value}`
          });
        }
      }
    }

    // Check optional Discord webhook
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhook) {
      results.push(this.validateDiscordWebhook(discordWebhook));
    }

    return results;
  }

  /**
   * Validate snipe index for commands
   */
  public static validateSnipeIndex(index: string, maxIndex: number): ValidationResult {
    const numIndex = parseInt(index, 10);
    
    if (isNaN(numIndex)) {
      return { valid: false, error: 'Index must be a number' };
    }

    if (numIndex < 1 || numIndex > maxIndex) {
      return { 
        valid: false, 
        error: `Index must be between 1 and ${maxIndex}`,
        suggestions: maxIndex > 0 ? [`Valid range: 1-${maxIndex}`] : ['No snipes available']
      };
    }

    return { valid: true };
  }

  /**
   * Sanitize input for safe file system usage
   */
  public static sanitizeForFilename(input: string): string {
    return input
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  /**
   * Check if string contains potentially dangerous patterns
   */
  public static containsMaliciousPatterns(input: string): boolean {
    const dangerousPatterns = [
      /\.\./,           // Directory traversal
      /[<>:"|?*]/,      // Invalid filename characters
      /\0/,             // Null bytes
      /javascript:/i,   // JavaScript protocol
      /data:/i,         // Data protocol
      /file:/i,         // File protocol
    ];

    return dangerousPatterns.some(pattern => pattern.test(input));
  }
}