import { initLogger } from './logger';
import { config } from './config';

/**
 * Initialize all core systems
 */
export function initApp(): void {
  // Initialize logger system
  initLogger();
  
  // Log app initialization (only in debug mode)
  if (config.isDebug()) {
    console.log('🚀 Market Fit App initialized');
    console.log('🔧 Environment:', config.getConfig().environment);
    console.log('📝 Debug Mode:', config.isDebug() ? 'ENABLED' : 'DISABLED');
  }
}

// Auto-initialize when this module is imported
if (typeof window !== 'undefined') {
  // Client-side initialization
  initApp();
} else {
  // Server-side initialization (Next.js SSR)
  initApp();
}

export { config } from './config';
export { logger, createLogger, initLogger, restoreConsole } from './logger'; 