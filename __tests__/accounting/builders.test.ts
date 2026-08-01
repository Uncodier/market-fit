import { buildFromSale, buildFromExpense } from '@/app/accounting/builders'

describe('accounting builders', () => {
  it('builds a balanced sale entry with tax and partial payment', () => {
    const draft = buildFromSale(
      {
        id: 'sale-1',
        site_id: 'site-1',
        status: 'completed',
        amount: 116,
        amount_due: 16,
        sale_date: '2026-07-01',
        currency: 'USD',
        location_id: null,
      },
      { tax_total: 16 }
    )

    expect(draft).not.toBeNull()
    const debits = draft!.lines.reduce((s, l) => s + (l.debit || 0), 0)
    const credits = draft!.lines.reduce((s, l) => s + (l.credit || 0), 0)
    expect(debits).toBeCloseTo(credits, 2)
    expect(draft!.lines.find(l => l.accountCode === '1000')?.debit).toBe(100)
    expect(draft!.lines.find(l => l.accountCode === '1100')?.debit).toBe(16)
    expect(draft!.lines.find(l => l.accountCode === '4000')?.credit).toBe(100)
    expect(draft!.lines.find(l => l.accountCode === '2100')?.credit).toBe(16)
  })

  it('returns null for non-completed sales', () => {
    expect(
      buildFromSale(
        {
          id: 'sale-2',
          site_id: 'site-1',
          status: 'pending',
          amount: 50,
          amount_due: 50,
          sale_date: '2026-07-01',
        },
        null
      )
    ).toBeNull()
  })

  it('builds expense as DR expense / CR cash', () => {
    const draft = buildFromExpense(
      {
        id: 'exp-1',
        site_id: 'site-1',
        amount: 40,
        category: 'advertising',
        date: '2026-07-02',
        currency: 'USD',
        description: 'Ads',
      },
      '5200'
    )

    expect(draft).not.toBeNull()
    expect(draft!.lines).toEqual([
      { accountCode: '5200', debit: 40, credit: 0, locationId: null },
      { accountCode: '1000', debit: 0, credit: 40, locationId: null },
    ])
    expect(draft!.entry.idempotencyKey).toBe('expense:exp-1')
  })

  it('changes source hash when category changes', () => {
    const a = buildFromExpense(
      {
        id: 'exp-1',
        site_id: 'site-1',
        amount: 40,
        category: 'advertising',
        date: '2026-07-02',
        currency: 'USD',
      },
      '5200'
    )
    const b = buildFromExpense(
      {
        id: 'exp-1',
        site_id: 'site-1',
        amount: 40,
        category: 'software',
        date: '2026-07-02',
        currency: 'USD',
      },
      '5300'
    )
    expect(a!.entry.sourceHash).not.toBe(b!.entry.sourceHash)
  })
})
