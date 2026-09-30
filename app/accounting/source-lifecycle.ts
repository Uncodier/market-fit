import 'server-only'

import { z } from 'zod'
import { requireAccountingAccess } from './access'

export async function deleteAccountingSource(siteId: string, sourceType: 'sale' | 'expense' | 'purchase', sourceId: string) {
  z.string().uuid().parse(sourceId)
  const client = await requireAccountingAccess(siteId, 'delete')
  const { error } = await client.rpc('accounting_delete_source', {
    p_site_id: siteId, p_source_type: sourceType, p_source_id: sourceId,
  })
  if (error?.code === '23503') throw new Error('This document has linked records and cannot be deleted. Its journal was preserved.')
  if (error) throw new Error('The document could not be deleted. No accounting records were changed.')
}

export async function hasSourceJournal(client: any, siteId: string, type: 'purchase' | 'expense', sourceId: string) {
  const { data, error } = await client.from('journal_entries').select('id')
    .eq('site_id', siteId).eq('source_type', type).eq('source_id', sourceId).limit(1)
  if (error) throw new Error('Unable to verify the existing accounting journal')
  return Boolean(data?.length)
}