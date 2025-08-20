import axios from 'axios';
import { DiscordEmbed, DiscordWebhookPayload, DiscordEmbedField } from '../types/api';
import { SnipeResult } from '../types/profile';
import { config } from '../utils/config';

export interface NotificationOptions {
  webhookUrl?: string;
  username?: string;
  avatarUrl?: string;
}

export interface SnipeNotification {
  type: 'TEST' | 'SUCCESS' | 'FAILURE' | 'STARTED' | 'MONITORING';
  snipeId: string;
  tokenAddress: string;
  tokenSymbol?: string;
  amountBtc: string;
  walletAddress: string;
  result?: SnipeResult;
  network: 'MAINNET' | 'REGTEST';
  profileName: string;
  timestamp: Date;
}

export class DiscordNotifier {
  private webhookUrl?: string;
  private isEnabled: boolean;

  // Clunkers color scheme
  private colors = {
    primary: 0x00D9FF,      // Neon blue (lightning)
    success: 0x00FF88,      // Neon green
    warning: 0xFFD700,      // Gold
    error: 0xFF6B6B,        // Red
    secondary: 0x2C2F33,    // Dark gray
    regtest: 0x9932CC       // Purple for regtest
  };

  constructor(options: NotificationOptions = {}) {
    this.webhookUrl = options.webhookUrl || config.get('discordWebhookUrl');
    this.isEnabled = !!this.webhookUrl;

    if (!this.isEnabled && config.get('debug')) {
      console.warn('⚠️  Discord notifications disabled: No webhook URL configured');
    }
  }

  /**
   * Send snipe notification
   */
  public async sendSnipeNotification(notification: SnipeNotification): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const embed = this.createSnipeEmbed(notification);
      const payload = this.createWebhookPayload([embed]);
      
      await this.sendWebhook(payload);
      
      if (config.get('debug')) {
        console.log(`📨 Discord notification sent: ${notification.type} for ${notification.tokenSymbol || 'TOKEN'}`);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to send Discord notification:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Send monitoring status notification
   */
  public async sendMonitoringNotification(
    profileName: string,
    activeSnipes: number,
    status: 'STARTED' | 'STOPPED' | 'MAINNET_ONLINE'
  ): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const embed = this.createMonitoringEmbed(profileName, activeSnipes, status);
      const payload = this.createWebhookPayload([embed]);
      
      await this.sendWebhook(payload);
      return true;
    } catch (error) {
      console.error('Failed to send monitoring notification:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Send execution summary notification
   */
  public async sendExecutionSummary(
    profileName: string,
    results: SnipeResult[],
    totalTime: number
  ): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const embed = this.createExecutionSummaryEmbed(profileName, results, totalTime);
      const payload = this.createWebhookPayload([embed]);
      
      await this.sendWebhook(payload);
      return true;
    } catch (error) {
      console.error('Failed to send execution summary:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Create snipe embed
   */
  private createSnipeEmbed(notification: SnipeNotification): DiscordEmbed {
    const { type, tokenAddress, tokenSymbol, amountBtc, walletAddress, result, network, profileName } = notification;
    
    let color: number;
    let title: string;
    let description: string;
    
    switch (type) {
      case 'TEST':
        color = network === 'REGTEST' ? this.colors.regtest : this.colors.primary;
        title = `🧪 [${network}] Snipe Test`;
        description = 'Test execution completed successfully';
        break;
      case 'SUCCESS':
        color = this.colors.success;
        title = `✅ [${network}] Snipe Successful`;
        description = 'Token snipe executed successfully!';
        break;
      case 'FAILURE':
        color = this.colors.error;
        title = `❌ [${network}] Snipe Failed`;
        description = result?.error || 'Snipe execution failed';
        break;
      case 'STARTED':
        color = this.colors.warning;
        title = `🚀 [${network}] Snipe Started`;
        description = 'Executing snipe transaction...';
        break;
      case 'MONITORING':
        color = this.colors.primary;
        title = `🔍 [${network}] Monitoring Started`;
        description = 'Waiting for mainnet to come online...';
        break;
      default:
        color = this.colors.secondary;
        title = `[${network}] Snipe Update`;
        description = 'Snipe status update';
    }

    const fields: DiscordEmbedField[] = [
      {
        name: '🎯 Token',
        value: `${tokenSymbol || 'TOKEN'}\n\`${this.truncateAddress(tokenAddress)}\``,
        inline: true
      },
      {
        name: '💰 Amount',
        value: `${amountBtc} BTC`,
        inline: true
      },
      {
        name: '👤 Profile',
        value: profileName,
        inline: true
      },
      {
        name: '🔑 Wallet',
        value: `\`${this.truncateAddress(walletAddress)}\``,
        inline: false
      }
    ];

    // Add result-specific fields
    if (result) {
      if (result.success) {
        if (result.tokensReceived) {
          fields.push({
            name: '🎉 Tokens Received',
            value: `${result.tokensReceived} ${tokenSymbol || 'TOKEN'}`,
            inline: true
          });
        }
        
        if (result.actualPrice) {
          fields.push({
            name: '💲 Final Price',
            value: `${result.actualPrice.toFixed(8)} BTC`,
            inline: true
          });
        }
        
        if (result.transactionHash) {
          fields.push({
            name: '🔗 Transaction',
            value: `\`${this.truncateHash(result.transactionHash)}\``,
            inline: true
          });
        }
      }
      
      if (result.executionTime) {
        fields.push({
          name: '⚡ Execution Time',
          value: `${result.executionTime}ms`,
          inline: true
        });
      }
      
      if (result.attempts) {
        fields.push({
          name: '🔄 Attempts',
          value: `${result.attempts}`,
          inline: true
        });
      }
      
      if (result.slippage !== undefined) {
        const slippageColor = result.slippage > 5 ? '🔴' : result.slippage > 2 ? '🟡' : '🟢';
        fields.push({
          name: `${slippageColor} Slippage`,
          value: `${result.slippage.toFixed(2)}%`,
          inline: true
        });
      }
    }

    return {
      title,
      description,
      color,
      fields,
      timestamp: notification.timestamp.toISOString(),
      footer: {
        text: 'CLUNKERS - Lightning Fast Token Sniper',
        icon_url: 'https://cdn.discordapp.com/attachments/placeholder/clunkers-icon.png' // Would need actual icon
      },
      thumbnail: network === 'REGTEST' ? {
        url: 'https://cdn.discordapp.com/attachments/placeholder/regtest-icon.png'
      } : undefined
    };
  }

  /**
   * Create monitoring embed
   */
  private createMonitoringEmbed(
    profileName: string,
    activeSnipes: number,
    status: 'STARTED' | 'STOPPED' | 'MAINNET_ONLINE'
  ): DiscordEmbed {
    let color: number;
    let title: string;
    let description: string;

    switch (status) {
      case 'STARTED':
        color = this.colors.primary;
        title = '🔍 Monitoring Started';
        description = 'FlashNet mainnet monitoring activated';
        break;
      case 'STOPPED':
        color = this.colors.secondary;
        title = '⏹️ Monitoring Stopped';
        description = 'Mainnet monitoring deactivated';
        break;
      case 'MAINNET_ONLINE':
        color = this.colors.success;
        title = '🟢 MAINNET ONLINE!';
        description = '**FlashNet mainnet is back online! Executing snipes...**';
        break;
    }

    const fields: DiscordEmbedField[] = [
      {
        name: '👤 Profile',
        value: profileName,
        inline: true
      },
      {
        name: '🎯 Active Snipes',
        value: activeSnipes.toString(),
        inline: true
      }
    ];

    if (status === 'MAINNET_ONLINE') {
      fields.push({
        name: '⚡ Status',
        value: 'Executing all active snipes in parallel...',
        inline: false
      });
    }

    return {
      title,
      description,
      color,
      fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'CLUNKERS - Dark. Technical. Fast.',
      }
    };
  }

  /**
   * Create execution summary embed
   */
  private createExecutionSummaryEmbed(
    profileName: string,
    results: SnipeResult[],
    totalTime: number
  ): DiscordEmbed {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const successRate = results.length > 0 ? (successful / results.length) * 100 : 0;

    const color = successful > failed ? this.colors.success : failed > successful ? this.colors.error : this.colors.warning;
    
    const fields: DiscordEmbedField[] = [
      {
        name: '👤 Profile',
        value: profileName,
        inline: true
      },
      {
        name: '✅ Successful',
        value: successful.toString(),
        inline: true
      },
      {
        name: '❌ Failed',
        value: failed.toString(),
        inline: true
      },
      {
        name: '📊 Success Rate',
        value: `${successRate.toFixed(1)}%`,
        inline: true
      },
      {
        name: '⚡ Total Time',
        value: `${totalTime}ms`,
        inline: true
      },
      {
        name: '🎯 Total Snipes',
        value: results.length.toString(),
        inline: true
      }
    ];

    // Add individual snipe results (limit to prevent message being too long)
    const displayResults = results.slice(0, 5);
    for (const result of displayResults) {
      const status = result.success ? '✅' : '❌';
      const timing = result.executionTime ? ` (${result.executionTime}ms)` : '';
      
      fields.push({
        name: `${status} Snipe`,
        value: `\`${this.truncateAddress(result.snipeId)}\`${timing}`,
        inline: true
      });
    }

    if (results.length > 5) {
      fields.push({
        name: '...',
        value: `and ${results.length - 5} more`,
        inline: true
      });
    }

    return {
      title: '📋 Execution Summary',
      description: `Completed snipe execution for profile **${profileName}**`,
      color,
      fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'CLUNKERS - Professional Token Sniping'
      }
    };
  }

  /**
   * Create webhook payload
   */
  private createWebhookPayload(embeds: DiscordEmbed[]): DiscordWebhookPayload {
    return {
      username: 'CLUNKERS',
      avatar_url: 'https://cdn.discordapp.com/attachments/placeholder/clunkers-avatar.png', // Would need actual avatar
      embeds
    };
  }

  /**
   * Send webhook to Discord
   */
  private async sendWebhook(payload: DiscordWebhookPayload): Promise<void> {
    if (!this.webhookUrl) {
      throw new Error('Discord webhook URL not configured');
    }

    const response = await axios.post(this.webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.status !== 204) {
      throw new Error(`Discord webhook failed with status ${response.status}`);
    }
  }

  /**
   * Truncate address for display
   */
  private truncateAddress(address: string): string {
    if (address.length <= 20) return address;
    return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
  }

  /**
   * Truncate hash for display
   */
  private truncateHash(hash: string): string {
    if (hash.length <= 16) return hash;
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  }

  /**
   * Test Discord webhook connection
   */
  public async testConnection(): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const embed: DiscordEmbed = {
        title: '🧪 CLUNKERS Test Message',
        description: 'Discord webhook connection test successful!',
        color: this.colors.primary,
        fields: [
          {
            name: '⚡ Status',
            value: 'Connected',
            inline: true
          },
          {
            name: '🕐 Timestamp',
            value: new Date().toISOString(),
            inline: true
          }
        ],
        footer: {
          text: 'CLUNKERS - System Test'
        }
      };

      const payload = this.createWebhookPayload([embed]);
      await this.sendWebhook(payload);
      
      return true;
    } catch (error) {
      console.error('Discord webhook test failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  public isNotificationsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Update webhook URL
   */
  public updateWebhookUrl(url: string): void {
    this.webhookUrl = url;
    this.isEnabled = !!url;
  }
}