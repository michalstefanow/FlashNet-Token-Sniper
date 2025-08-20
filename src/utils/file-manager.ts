import fs from 'fs/promises';
import { Stats } from 'fs';
import path from 'path';
import { ValidationService } from './validation';

export class FileManager {
  private static readonly PROFILES_DIR = 'profiles';
  private static readonly CONFIG_FILE = 'config.json';
  private static readonly WALLETS_FILE = 'wallets.json';

  /**
   * Initialize the profiles directory structure
   */
  public static async initializeProfilesDirectory(baseDir: string): Promise<string> {
    const profilesPath = path.join(baseDir, this.PROFILES_DIR);
    
    try {
      await fs.mkdir(profilesPath, { recursive: true });
      return profilesPath;
    } catch (error) {
      throw new Error(`Failed to initialize profiles directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new profile directory
   */
  public static async createProfileDirectory(profilesDir: string, profileName: string): Promise<string> {
    // Validate profile name
    const validation = ValidationService.validateProfileName(profileName);
    if (!validation.valid) {
      throw new Error(`Invalid profile name: ${validation.error}`);
    }

    const profilePath = path.join(profilesDir, profileName);

    try {
      // Check if profile already exists
      const exists = await this.pathExists(profilePath);
      if (exists) {
        throw new Error(`Profile '${profileName}' already exists`);
      }

      // Create profile directory
      await fs.mkdir(profilePath, { recursive: true });
      return profilePath;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw error;
      }
      throw new Error(`Failed to create profile directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a profile directory and all its contents
   */
  public static async deleteProfileDirectory(profilePath: string): Promise<void> {
    try {
      const exists = await this.pathExists(profilePath);
      if (!exists) {
        return; // Already deleted
      }

      await fs.rm(profilePath, { recursive: true, force: true });
    } catch (error) {
      throw new Error(`Failed to delete profile directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all profile directories
   */
  public static async listProfiles(profilesDir: string): Promise<string[]> {
    try {
      const exists = await this.pathExists(profilesDir);
      if (!exists) {
        return [];
      }

      const items = await fs.readdir(profilesDir, { withFileTypes: true });
      return items
        .filter(item => item.isDirectory())
        .map(item => item.name)
        .sort();
    } catch (error) {
      throw new Error(`Failed to list profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Read JSON file safely
   */
  public static async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const exists = await this.pathExists(filePath);
      if (!exists) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to read JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write JSON file safely with atomic operation
   */
  public static async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write to temporary file first, then rename (atomic operation)
      const tempFile = `${filePath}.tmp`;
      const jsonContent = JSON.stringify(data, null, 2);
      
      await fs.writeFile(tempFile, jsonContent, 'utf8');
      await fs.rename(tempFile, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(`${filePath}.tmp`);
      } catch {
        // Ignore cleanup errors
      }
      
      throw new Error(`Failed to write JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get profile configuration file path
   */
  public static getConfigFilePath(profilePath: string): string {
    return path.join(profilePath, this.CONFIG_FILE);
  }

  /**
   * Get profile wallets file path
   */
  public static getWalletsFilePath(profilePath: string): string {
    return path.join(profilePath, this.WALLETS_FILE);
  }

  /**
   * Check if a path exists
   */
  public static async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats safely
   */
  public static async getFileStats(filePath: string): Promise<Stats | null> {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Backup a file before modifying
   */
  public static async backupFile(filePath: string): Promise<string | null> {
    try {
      const exists = await this.pathExists(filePath);
      if (!exists) {
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filePath}.backup-${timestamp}`;
      
      await fs.copyFile(filePath, backupPath);
      return backupPath;
    } catch (error) {
      console.warn(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Clean up old backup files (keep only last 5)
   */
  public static async cleanupBackups(filePath: string): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      const filename = path.basename(filePath);
      const files = await fs.readdir(dir);
      
      const backupFiles = files
        .filter(file => file.startsWith(`${filename}.backup-`))
        .map(file => ({
          name: file,
          path: path.join(dir, file),
          stat: null as Stats | null
        }));

      // Get stats for all backup files
      for (const backup of backupFiles) {
        backup.stat = await this.getFileStats(backup.path);
      }

      // Sort by creation time (newest first)
      backupFiles.sort((a, b) => {
        if (!a.stat || !b.stat) return 0;
        return b.stat.mtime.getTime() - a.stat.mtime.getTime();
      });

      // Remove old backups (keep only 5 most recent)
      const toDelete = backupFiles.slice(5);
      for (const backup of toDelete) {
        try {
          await fs.unlink(backup.path);
        } catch {
          // Ignore individual deletion errors
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Validate file path for security
   */
  public static validatePath(filePath: string, baseDir: string): boolean {
    try {
      const resolvedPath = path.resolve(filePath);
      const resolvedBaseDir = path.resolve(baseDir);
      
      // Ensure the path is within the base directory
      return resolvedPath.startsWith(resolvedBaseDir);
    } catch {
      return false;
    }
  }

  /**
   * Get disk usage for profiles directory
   */
  public static async getDirectorySize(dirPath: string): Promise<number> {
    try {
      let totalSize = 0;
      
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          totalSize += await this.getDirectorySize(itemPath);
        } else {
          const stats = await fs.stat(itemPath);
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Format bytes to human readable format
   */
  public static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}