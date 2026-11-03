import { DB_EVENT_TABLES } from '@/app/components/workflows/types'

describe('Procurement workflow trigger options', () => {
  it('offers the canonical procurement event tables', () => {
    expect(DB_EVENT_TABLES).toEqual(expect.arrayContaining([
      'suppliers', 'supplier_contacts', 'catalog_item_suppliers',
      'procurement_requests', 'procurement_tenders', 'procurement_tender_publications',
      'procurement_tender_participants', 'procurement_event_approvals',
      'procurement_awards', 'purchase_orders', 'procurement_receipts',
      'procurement_replenishment_rules', 'procurement_replenishment_cases',
    ]))
    expect(new Set(DB_EVENT_TABLES).size).toBe(DB_EVENT_TABLES.length)
  })

  it('does not expose credentials, submission drafts or internal queues', () => {
    for (const table of ['procurement_credentials', 'procurement_submission_drafts',
      'procurement_replenishment_queue', 'procurement_request_items', 'procurement_event_decisions']) {
      expect(DB_EVENT_TABLES).not.toContain(table)
    }
  })
})