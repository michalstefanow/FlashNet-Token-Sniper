import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ProfileLock } from '../types/profile';

export class LockManager {
  private static readonly LOCK_FILE_NAME = '.lock';
  private static readonly STALE_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  /**
   * Acquire a lock for a profile
   */
  public static async acquireLock(profilePath: string, profileName: string): Promise<boolean> {
    const lockFilePath = path.join(profilePath, this.LOCK_FILE_NAME);

    try {
      // Check if lock file exists
      const existingLock = await this.readLockFile(lockFilePath);
      
      if (existingLock) {
        // Check if the process is still running
        const isStale = await this.isLockStale(existingLock);
        
        if (!isStale) {
          // Lock is still valid
          return false;
        }
        
        // Remove stale lock
        await this.removeLock(profilePath);
      }

      // Create new lock
      const lock: ProfileLock = {
        profileName,
        pid: process.pid,
        timestamp: new Date(),
        hostname: os.hostname()
      };

      await fs.writeFile(lockFilePath, JSON.stringify(lock, null, 2), 'utf8');
      return true;

    } catch (error) {
      console.error(`Failed to acquire lock for profile ${profileName}:`, error);
      return false;
    }
  }

  /**
   * Release a lock for a profile
   */
  public static async releaseLock(profilePath: string): Promise<boolean> {
    try {
      const lockFilePath = path.join(profilePath, this.LOCK_FILE_NAME);
      await fs.unlink(lockFilePath);
      return true;
    } catch (error) {
      // Lock file might not exist, which is fine
      if ((error as any).code === 'ENOENT') {
        return true;
      }
      console.error('Failed to release lock:', error);
      return false;
    }
  }

  /**
   * Check if a profile is currently locked
   */
  public static async isLocked(profilePath: string): Promise<boolean> {
    try {
      const lockFilePath = path.join(profilePath, this.LOCK_FILE_NAME);
      const lock = await this.readLockFile(lockFilePath);
      
      if (!lock) {
        return false;
      }

      return !(await this.isLockStale(lock));
    } catch {
      return false;
    }
  }

  /**
   * Get lock information for a profile
   */
  public static async getLockInfo(profilePath: string): Promise<ProfileLock | null> {
    try {
      const lockFilePath = path.join(profilePath, this.LOCK_FILE_NAME);
      return await this.readLockFile(lockFilePath);
    } catch {
      return null;
    }
  }

  /**
   * Force remove a lock (use with caution)
   */
  public static async forceClearLock(profilePath: string): Promise<boolean> {
    return await this.releaseLock(profilePath);
  }

  /**
   * Clean up stale locks in all profiles
   */
  public static async cleanupStaleLocks(profilesDir: string): Promise<number> {
    let cleaned = 0;

    try {
      const profiles = await fs.readdir(profilesDir, { withFileTypes: true });
      
      for (const profile of profiles) {
        if (profile.isDirectory()) {
          const profilePath = path.join(profilesDir, profile.name);
          const lockFilePath = path.join(profilePath, this.LOCK_FILE_NAME);
          
          try {
            const lock = await this.readLockFile(lockFilePath);
            if (lock && await this.isLockStale(lock)) {
              await fs.unlink(lockFilePath);
              cleaned++;
              console.log(`🧹 Cleaned stale lock for profile: ${profile.name}`);
            }
          } catch {
            // Ignore errors for individual lock files
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup stale locks:', error);
    }

    return cleaned;
  }

  /**
   * Setup graceful shutdown handler to release locks
   */
  public static setupGracefulShutdown(profilePath: string): void {
    const cleanup = async () => {
      await this.releaseLock(profilePath);
      process.exit(0);
    };

    // Handle various termination signals
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGHUP', cleanup);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await this.releaseLock(profilePath);
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      await this.releaseLock(profilePath);
      process.exit(1);
    });
  }

  /**
   * Read lock file and parse JSON
   */
  private static async readLockFile(lockFilePath: string): Promise<ProfileLock | null> {
    try {
      const content = await fs.readFile(lockFilePath, 'utf8');
      const lock = JSON.parse(content);
      
      // Convert timestamp string back to Date
      lock.timestamp = new Date(lock.timestamp);
      
      return lock;
    } catch {
      return null;
    }
  }

  /**
   * Check if a lock is stale (process no longer running or too old)
   */
  private static async isLockStale(lock: ProfileLock): Promise<boolean> {
    // Check if lock is too old
    const now = new Date();
    const lockAge = now.getTime() - lock.timestamp.getTime();
    
    if (lockAge > this.STALE_LOCK_TIMEOUT) {
      return true;
    }

    // Check if process is still running
    try {
      // On Unix-like systems, sending signal 0 checks if process exists
      process.kill(lock.pid, 0);
      return false; // Process exists
    } catch (error) {
      // Process doesn't exist or we don't have permission to check
      return true;
    }
  }

  /**
   * Remove lock file (internal method)
   */
  private static async removeLock(profilePath: string): Promise<void> {
    const lockFilePath = path.join(profilePath, this.LOCK_FILE_NAME);
    try {
      await fs.unlink(lockFilePath);
    } catch {
      // Ignore errors when removing lock
    }
  }
}