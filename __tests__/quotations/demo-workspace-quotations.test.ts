import { availableDemos, getDemoData } from '@/lib/demo-data'
import { getDemoWorkspaceQuotation, listDemoWorkspaceQuotations } from '@/app/quotations/demo-workspace-quotations'

describe('workspace demo quotations', () => {
  it.each(availableDemos.map(demo => demo.id))('has linked quotations and detail for %s', async siteId => {
    const fixture = await getDemoData(siteId)
    const result = await listDemoWorkspaceQuotations({ siteId })
    expect(result.count).toBeGreaterThan(0)
    for (const row of result.data) {
      expect(row.lead).toBeTruthy()
      const detail = await getDemoWorkspaceQuotation(siteId, row.id)
      expect(detail).not.toBeNull()
      if (!detail) throw new Error(`Missing demo quotation ${row.id}`)
      expect(detail.site_id).toBe(siteId)
      expect(detail.items.length).toBeGreaterThan(0)
      expect(detail.items.reduce((sum: number, item: { subtotal: number; catalog_item_id: string }) => sum + item.subtotal, 0)).toBe(detail.subtotal)
      expect(fixture?.catalog_items.some((item: { id: string }) => item.id === detail.items[0].catalog_item_id)).toBe(true)
    }
  })

  it('supports status, search, sort and pagination', async () => {
    const siteId = 'demo-habituall'
    const all = await listDemoWorkspaceQuotations({ siteId, sort: 'oldest' })
    expect(all.data[0].created_at <= all.data[1].created_at).toBe(true)
    const filtered = await listDemoWorkspaceQuotations({ siteId, status: 'sent' })
    expect(filtered.count).toBe(1)
    expect(filtered.data[0].status).toBe('sent')
    const searched = await listDemoWorkspaceQuotations({ siteId, q: all.data[0].id })
    expect(searched.count).toBe(1)
    const paged = await listDemoWorkspaceQuotations({ siteId, sort: 'oldest', page: 2, pageSize: 1 })
    expect(paged.count).toBe(all.count)
    expect(paged.data[0].id).toBe(all.data[1].id)
  })

  it('never resolves real workspaces, unknown demos or another demo quotation', async () => {
    expect(await listDemoWorkspaceQuotations({ siteId: 'company-a' })).toEqual({ data: [], count: 0 })
    expect(await getDemoWorkspaceQuotation('demo-unknown', 'quote-saas-1')).toBeNull()
    expect(await getDemoWorkspaceQuotation('demo-habituall', 'quote-saas-1')).toBeNull()
  })
})