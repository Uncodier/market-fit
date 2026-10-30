import { isDemoModeActive, isDemoSiteId } from '@/lib/demo-utils'

/** Presentation-only boundary, including a stale workspace during demo activation. */
export function isProcurementDemo(siteId: string | null | undefined) {
  return isDemoSiteId(siteId) || isDemoModeActive()
}