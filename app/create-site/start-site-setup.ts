import { apiClient } from '@/app/services/api-client-service'

/** Setup is optional background work; never retry an ambiguous workflow start. */
export async function startSiteSetup(siteId: string): Promise<void> {
  try {
    const result = await apiClient.post('/api/site/setup', { site_id: siteId }, { timeout: 15_000 })
    if (!result.success) console.warn('Site setup was not confirmed. Check its status before retrying.')
  } catch {
    console.warn('Site setup was not confirmed. Check its status before retrying.')
  }
}