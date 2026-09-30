import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserSiteRole } from '@/lib/auth/api-site-access'

export type AccountingCommand = 'select' | 'insert' | 'update' | 'delete'

export async function requireAccountingAccess(siteId: string, command: AccountingCommand = 'select') {
  if (typeof siteId === 'string' && siteId.startsWith('demo-')) {
    const demo = await createClient()
    if (!demo._isDemo || command !== 'select') throw new Error('Demo accounting is read-only')
    return demo
  }
  z.string().uuid().parse(siteId)
  const supabase = await createClient(true)
  if (supabase._isDemo) throw new Error('Demo credentials cannot access a real accounting site')
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Authentication required')
  const role = await getCurrentUserSiteRole(supabase, siteId)
  const allowed = command === 'select'
    ? ['owner', 'admin', 'collaborator', 'marketing']
    : command === 'delete' ? ['owner', 'admin'] : ['owner', 'admin', 'collaborator']
  if (!role || !allowed.includes(role)) throw new Error('Not authorized for this accounting operation')
  return supabase
}