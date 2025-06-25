import { config } from './config';

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;
const originalConsoleError = console.error;

// Track if logger has been initialized
let isInitialized = false;

/**
 * Enhanced console.log that only works in debug mode
 */
function debugConsoleLog(...args: any[]): void {
  if (config.isDebug()) {
    originalConsoleLog.apply(console, args);
  }
}

/**
 * Enhanced console.warn that only works in debug mode
 */
function debugConsoleWarn(...args: any[]): void {
  if (config.isDebug()) {
    originalConsoleWarn.apply(console, args);
  }
}

/**
 * Enhanced console.info that only works in debug mode
 */
function debugConsoleInfo(...args: any[]): void {
  if (config.isDebug()) {
    originalConsoleInfo.apply(console, args);
  }
}

/**
 * Enhanced console.debug that only works in debug mode
 */
function debugConsoleDebug(...args: any[]): void {
  if (config.isDebug()) {
    originalConsoleDebug.apply(console, args);
  }
}

/**
 * Enhanced console.error that always works but adds debug info in debug mode
 */
function enhancedConsoleError(...args: any[]): void {
  // Always show errors
  originalConsoleError.apply(console, args);
  
  // Temporarily disabled to prevent error loops
  // In debug mode, add additional information
  // if (config.isDebug()) {
  //   originalConsoleError('[Debug Info] - Error occurred at:', new Date().toISOString());
  //   originalConsoleError('[Debug Info] - Stack trace available in browser dev tools');
  //   originalConsoleError('[Debug Info] - Environment:', config.getConfig().environment);
  // }
}

/**
 * Initialize the logger by overriding console methods
 */
export function initLogger(): void {
  if (isInitialized) {
    return; // Already initialized
  }

  // Override console methods
  console.log = debugConsoleLog;
  console.warn = debugConsoleWarn;
  console.info = debugConsoleInfo;
  console.debug = debugConsoleDebug;
  console.error = enhancedConsoleError;

  isInitialized = true;

  // Log initialization only in debug mode
  if (config.isDebug()) {
    originalConsoleLog('🔧 Logger initialized - Debug mode enabled');
    originalConsoleLog('📊 Configuration:', config.getConfig());
  }
}

/**
 * Restore original console methods (useful for testing)
 */
export function restoreConsole(): void {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
  console.debug = originalConsoleDebug;
  console.error = originalConsoleError;
  
  isInitialized = false;
}

/**
 * Force log a message (bypasses debug mode check)
 */
export function forceLog(...args: any[]): void {
  originalConsoleLog.apply(console, args);
}

/**
 * Force warn a message (bypasses debug mode check)
 */
export function forceWarn(...args: any[]): void {
  originalConsoleWarn.apply(console, args);
}

/**
 * Force error a message (bypasses debug mode check)
 */
export function forceError(...args: any[]): void {
  originalConsoleError.apply(console, args);
}

/**
 * Logger utility class with different log levels
 */
export class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private formatMessage(level: string, ...args: any[]): any[] {
    const timestamp = new Date().toISOString();
    const prefix = this.context 
      ? `[${timestamp}] [${level}] [${this.context}]`
      : `[${timestamp}] [${level}]`;
    
    return [prefix, ...args];
  }

  debug(...args: any[]): void {
    if (config.isDebug()) {
      originalConsoleDebug(...this.formatMessage('DEBUG', ...args));
    }
  }

  info(...args: any[]): void {
    if (config.isDebug()) {
      originalConsoleInfo(...this.formatMessage('INFO', ...args));
    }
  }

  warn(...args: any[]): void {
    if (config.isDebug()) {
      originalConsoleWarn(...this.formatMessage('WARN', ...args));
    }
  }

  error(...args: any[]): void {
    // Errors are always shown
    originalConsoleError(...this.formatMessage('ERROR', ...args));
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: string): Logger {
    const newContext = this.context 
      ? `${this.context}:${additionalContext}`
      : additionalContext;
    return new Logger(newContext);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(context?: string): Logger {
  return new Logger(context);
}

/**
 * Default logger instance
 */
export const logger = new Logger('APP');

// Export original console methods for internal use
export const originalConsole = {
  log: originalConsoleLog,
  warn: originalConsoleWarn,
  info: originalConsoleInfo,
  debug: originalConsoleDebug,
  error: originalConsoleError,
}; 