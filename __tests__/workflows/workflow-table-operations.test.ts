import { DB_EVENT_TABLES } from '@/app/components/workflows/types'
import {
  getWorkflowTableOperations,
  normalizeWorkflowTableOperations,
  WORKFLOW_TABLE_OPTIONS,
} from '@/app/components/workflows/workflow-table-options'

describe('Workflow table operation catalog', () => {
  it('covers every table with the migration-supported operations', () => {
    const insertOnly = ['catalog_item_suppliers', 'procurement_tender_publications',
      'procurement_awards', 'purchase_orders', 'procurement_receipts']
    for (const table of DB_EVENT_TABLES) {
      const expected = insertOnly.includes(table) ? ['insert']
        : table === 'suppliers' ? ['insert', 'update'] : ['insert', 'update', 'delete']
      expect(getWorkflowTableOperations(table)).toEqual(expected)
      expect(WORKFLOW_TABLE_OPTIONS.find(option => option.value === table)?.operations).toEqual(expected)
    }
  })

  it('does not confuse immutable fields, provenance, or procurement-only quotations with immutable tables', () => {
    // Later lifecycle and replenishment repairs still update these tables.
    for (const table of ['quotations', 'procurement_requests', 'procurement_tenders',
      'procurement_event_approvals', 'procurement_replenishment_rules', 'procurement_replenishment_cases']) {
      expect(getWorkflowTableOperations(table)).toContain('update')
    }
  })

  it('retains only supported selections and defaults without mutating input', () => {
    const operations = ['update', 'delete'] as const
    expect(normalizeWorkflowTableOperations('purchase_orders', operations)).toEqual(['insert'])
    expect(normalizeWorkflowTableOperations('suppliers', operations)).toEqual(['update'])
    expect(normalizeWorkflowTableOperations('deals', ['insert'])).toEqual(['insert'])
    expect(normalizeWorkflowTableOperations('deals', [])).toEqual(['insert'])
    expect(operations).toEqual(['update', 'delete'])
    expect(normalizeWorkflowTableOperations('deals', ['update', 'update'])).toEqual(['update'])
  })

  it('does not guess operations for unsupported legacy tables', () => {
    expect(getWorkflowTableOperations('retired_table')).toEqual([])
    expect(normalizeWorkflowTableOperations('retired_table', ['update'])).toEqual([])
  })
})