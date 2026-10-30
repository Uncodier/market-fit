import 'server-only'
import { cookies } from 'next/headers'
import { isDemoSiteId } from '@/lib/demo-utils'

/** This cookie selects public fictional presentation only, never authorization. */
export async function isProcurementPortalDemo() {
  const value = (await cookies()).get('market_fit_demo_site_id')?.value
  if (!value) return false
  try { return isDemoSiteId(decodeURIComponent(value).trim()) } catch { return false }
}