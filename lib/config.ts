interface AppConfig {
  debug: boolean;
  environment: 'development' | 'production' | 'test';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

class ConfigManager {
  private config: AppConfig;

  constructor() {
    this.config = {
      debug: this.getDebugMode(),
      environment: this.getEnvironment(),
      logLevel: this.determineLogLevel(),
    };
  }

  private getDebugMode(): boolean {
    // Check URL parameters first (for development/testing)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const debugParam = urlParams.get('debug');
      if (debugParam === 'true') return true;
      if (debugParam === 'false') return false;
    }

    // Check environment variables
    const nodeEnv = process.env.NODE_ENV;
    const debugEnv = process.env.NEXT_PUBLIC_DEBUG;
    
    // Explicit debug environment variable
    if (debugEnv === 'true') return true;
    if (debugEnv === 'false') return false;

    // Default to true in development, false in production
    return nodeEnv === 'development';
  }

  private getEnvironment(): 'development' | 'production' | 'test' {
    const env = process.env.NODE_ENV as 'development' | 'production' | 'test';
    return env || 'development';
  }

  private determineLogLevel(): 'error' | 'warn' | 'info' | 'debug' {
    const logLevel = process.env.NEXT_PUBLIC_LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug';
    
    if (logLevel && ['error', 'warn', 'info', 'debug'].includes(logLevel)) {
      return logLevel;
    }

    // Default log levels based on environment
    switch (this.config?.environment || this.getEnvironment()) {
      case 'production':
        return 'error';
      case 'test':
        return 'warn';
      case 'development':
      default:
        return 'debug';
    }
  }

  public isDebug(): boolean {
    return this.config.debug;
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  public isProduction(): boolean {
    return this.config.environment === 'production';
  }

  public getLogLevel(): 'error' | 'warn' | 'info' | 'debug' {
    return this.config.logLevel;
  }
}

// Export singleton instance
export const config = new ConfigManager();
export type { AppConfig }; 