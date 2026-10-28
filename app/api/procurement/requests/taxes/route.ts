import { procurementAccess, procurementError } from '../../http'
import { databaseError, resultJson } from '../http'

export async function GET(request: Request) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const { data, error } = await access.supabase.from('taxes').select('id,name,rate')
      .eq('site_id', access.siteId).eq('is_active', true).order('name').limit(200)
    return databaseError(error) ?? resultJson({ taxes: data })
  } catch { return procurementError('Unable to load workspace taxes', 503) }
}