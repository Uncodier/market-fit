import { shouldPreventAutoRefresh, getAutoRefreshPreventionReason } from '../hooks/use-prevent-refresh'

/**
 * Safe reload function that checks if the current page should prevent auto-refresh
 * before performing a page reload. This helps prevent losing work on create/edit pages.
 * 
 * @param force - If true, will force the reload even if prevention is active
 * @param reason - Optional reason for the reload (for logging)
 * @returns boolean - true if reload was executed, false if prevented
 */
export function safeReload(force: boolean = false, reason?: string): boolean {
  // Always allow reload in non-browser environments
  if (typeof window === 'undefined') return false
  
  // Check if auto-refresh should be prevented
  const shouldPrevent = shouldPreventAutoRefresh()
  const preventionReason = getAutoRefreshPreventionReason()
  
  if (shouldPrevent && !force) {
    console.warn('🚫 Page reload prevented to protect user work')
    console.warn(`   Reason: ${preventionReason}`)
    if (reason) console.warn(`   Attempted reload reason: ${reason}`)
    console.warn('   Use safeReload(true) to force reload if necessary')
    
    // You could optionally show a toast or notification here
    // toast.info('Page reload was prevented to protect your work')
    
    return false
  }
  
  // Proceed with reload
  console.log(`🔄 Performing page reload${reason ? `: ${reason}` : ''}`)
  if (force && shouldPrevent) {
    console.log(`   Forced reload despite prevention (reason: ${preventionReason})`)
  }
  
  window.location.reload()
  return true
}

/**
 * Function to safely refresh data without full page reload
 * This is preferred over safeReload when possible
 * 
 * @param refreshFunction - Function that refreshes the data
 * @param fallbackToReload - If true, will use safeReload as fallback
 * @param reason - Optional reason for the refresh
 */
export async function safeDataRefresh(
  refreshFunction: () => Promise<void> | void,
  fallbackToReload: boolean = false,
  reason?: string
): Promise<boolean> {
  try {
    console.log(`🔄 Refreshing data${reason ? `: ${reason}` : ''}`)
    await refreshFunction()
    console.log('✅ Data refresh completed successfully')
    return true
  } catch (error) {
    console.error('❌ Data refresh failed:', error)
    
    if (fallbackToReload) {
      console.log('📄 Falling back to page reload...')
      return safeReload(false, `Data refresh failed: ${reason}`)
    }
    
    return false
  }
}

/**
 * Create a safe reload function for specific components
 * Returns a function that can be used as an event handler
 */
export function createSafeReloadHandler(force: boolean = false, reason?: string) {
  return () => safeReload(force, reason)
} 