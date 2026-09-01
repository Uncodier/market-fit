/** Dispatched to clear stored breadcrumb trail (e.g. /robots vs Imprenta share one URL). */
export const NAVIGATION_HISTORY_RESET_EVENT = 'navigation-history:reset'

export function requestNavigationHistoryReset(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NAVIGATION_HISTORY_RESET_EVENT))
}
