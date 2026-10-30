'use server'

import { createClient } from '@/lib/supabase/server'
import { loadPublicTenders } from '@/app/tenders/public-data'

export async function listSearchReservations(page: number) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 100) return { error: 'Invalid page' }
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }
  const result = await supabase.from('reservations')
    .select('id,start_time,status,site:site_id(name),catalog_item:catalog_item_id(name)', { count: 'exact' })
    .eq('buyer_user_id', user.id).order('start_time', { ascending: false }).range((page - 1) * 100, page * 100 - 1)
  if (result.error) return { error: 'Unable to load reservations' }
  return { data: result.data ?? [], count: result.count ?? 0 }
}

export async function listSearchTenders(query: string, page: number) {
  if (typeof query !== 'string' || query.length > 200 || !Number.isSafeInteger(page) || page < 1 || page > 100)
    return { error: 'Invalid search' }
  const result = await loadPublicTenders(undefined, undefined, page - 1, query)
  return result.error ? { error: result.error } : { data: result.rows }
}