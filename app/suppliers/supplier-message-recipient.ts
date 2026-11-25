import { newLeadMessageChannels, type NewSupplierMessage } from '@/lib/chat/new-lead-message'
import { getChannelRoutingMetadata, type SiteChannelSource } from '@/lib/site-channels'
import type { Supplier } from './schema'

export type SupplierMessageRecipient = Pick<Supplier, 'id' | 'name' | 'version' | 'contacts'>

export function supplierMessageContacts(site: SiteChannelSource | null | undefined, supplier: SupplierMessageRecipient) {
  const routes = new Map<NewSupplierMessage['channel'], SupplierMessageRecipient['contacts'][number]>()
  const saved = [...supplier.contacts].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''))
  for (const contact of [...saved.filter(item => item.is_primary), ...saved.filter(item => !item.is_primary)]) {
    for (const channel of newLeadMessageChannels(site, { ...contact, id: supplier.id })) {
      if (channel !== 'telegram' && !routes.has(channel) &&
          (channel !== 'whatsapp' || getChannelRoutingMetadata(site, channel)?.sender_id)) routes.set(channel, contact)
    }
  }
  return routes
}