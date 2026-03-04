import { initLogger } from './logger';
import { config } from './config';

/**
 * Initialize all core systems
 */
export function initApp(): void {
  // Initialize logger system
  initLogger();
  
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