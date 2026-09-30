import { buildSaleJournalDrafts, buildPurchaseJournalDrafts, buildFromExpense, type JournalDraft } from '@/app/accounting/builders'

const sale = { id: 'sale', site_id: 'site', status: 'pending', amount: 100, amount_due: 100,
  currency: 'USD', sale_date: '2026-08-01' }
const purchase = { id: 'bill', site_id: 'site', status: 'pending', amount: 100, amount_due: 100,
  currency: 'USD', purchase_date: '2026-08-01' }
const balances = (drafts: JournalDraft[]) => {
  const totals: Record<string, number> = {}
  for (const draft of drafts) for (const line of draft.lines) {
    totals[line.accountCode!] = (totals[line.accountCode!] || 0) + Math.round((line.debit || 0) * 100) - Math.round((line.credit || 0) * 100)
  }
  return totals
}
const balanced = (drafts: JournalDraft[]) => drafts.forEach(draft => {
  expect(draft.lines.length).toBeGreaterThanOrEqual(2)
  expect(Object.values(balances([draft])).reduce((sum, n) => sum + n, 0)).toBe(0)
})

describe('dated source accounting', () => {
  it('posts verified refunds for a cancelled sale without removing its original receipt', () => {
    const drafts = buildSaleJournalDrafts({ ...sale, status: 'cancelled', amount_due: 0,
      payments: [{ id: 'p', amount: 100, date: '2026-08-01' }],
      refunds: [{ id: 're_cancelled', amount: 100, currency: 'USD', refunded_at: '2026-09-01' }] }, null)
    expect(drafts).toHaveLength(3)
    expect(drafts[2].entry.entryDate).toBe('2026-09-01')
    expect(balances(drafts)).toMatchObject({ '1000': 0, '4000': 0 })
    balanced(drafts)
  })
  it('keeps the original receivable unchanged when a later receipt arrives', () => {
    const initial = buildSaleJournalDrafts(sale, null)
    const paid = buildSaleJournalDrafts({ ...sale, status: 'completed', amount_due: 0,
      payments: [{ id: 'receipt', date: '2026-09-15', amount: 100 }] }, null)
    expect(paid[0]).toEqual(initial[0])
    expect(paid[1].entry.entryDate).toBe('2026-09-15')
    expect(balances([paid[0]])).toMatchObject({ '1100': 10000, '4000': -10000 })
    expect(balances(paid)).toMatchObject({ '1100': 0, '1000': 10000 })
    balanced(paid)
  })
  it('posts vendor payment at its date rather than the bill date', () => {
    const drafts = buildPurchaseJournalDrafts({ ...purchase, amount_due: 60,
      payments: [{ id: 'receipt', amount: 40, date: '2026-09-15' }] })
    expect(drafts.map(draft => draft.entry.entryDate)).toEqual(['2026-08-01', '2026-09-15'])
    expect(balances(drafts)).toMatchObject({ '2200': -6000, '1000': -4000 })
    balanced(drafts)
  })
  it('does not lose overpayments on discounted sales or purchases', () => {
    const sold = buildSaleJournalDrafts({ ...sale, amount: 80, amount_due: 0,
      payments: [{ id: 'paid', amount: 100, date: '2026-08-01' }] }, null)
    expect(balances(sold)).toMatchObject({ '1000': 10000, '2300': -2000, '4000': -8000 })
    const bought = buildPurchaseJournalDrafts({ ...purchase, amount: 80, amount_due: 0,
      payments: [{ id: 'paid', amount: 100, date: '2026-08-01' }] })
    expect(balances(bought)).toMatchObject({ '1000': -10000, '1300': 2000, '2200': 0 })
    balanced(sold); balanced(bought)
  })
  it('avoids double-counting linked promotion discounts but retains real advertising expenses', () => {
    const tx = { id: 'tx', site_id: 'site', amount: 20, date: '2026-08-01', category: 'promotions', currency: 'USD' }
    expect(buildFromExpense({ ...tx, sale_order_id: 'order' }, new Map())).toBeNull()
    expect(buildFromExpense(tx, new Map([['promotions', '5210']]))?.lines[1].credit).toBe(20)
    const sold = buildSaleJournalDrafts({ ...sale, amount: 80, amount_due: 0 }, null)
    expect(balances(sold)).toMatchObject({ '1000': 8000, '4000': -8000 })
  })
  it('changes hashes when currency or the resolved expense account changes', () => {
    expect(buildSaleJournalDrafts(sale, null)[0].entry.sourceHash)
      .not.toEqual(buildSaleJournalDrafts({ ...sale, currency: 'EUR' }, null)[0].entry.sourceHash)
    expect(buildPurchaseJournalDrafts(purchase)[0].entry.sourceHash)
      .not.toEqual(buildPurchaseJournalDrafts({ ...purchase, currency: 'EUR' })[0].entry.sourceHash)
    const tx = { id: 'tx', site_id: 'site', amount: 20, date: '2026-08-01', category: 'software', currency: 'USD' }
    expect(buildFromExpense(tx, new Map([['software', '5300']]))?.entry.sourceHash)
      .not.toEqual(buildFromExpense(tx, new Map([['software', '6300']]))?.entry.sourceHash)
  })
  it('records partial refunds without deleting recognition or receipts', () => {
    const paid = { ...sale, status: 'completed', amount_due: 0, payments: [{ id: 'p', amount: 100, date: '2026-08-01' }] }
    const refund = { id: 're_one', amount: 40, currency: 'USD', refunded_at: '2026-09-20T12:00:00Z' }
    const drafts = buildSaleJournalDrafts({ ...paid, refunds: [refund] }, null)
    expect(drafts).toHaveLength(3)
    expect(drafts[2].entry.idempotencyKey).toBe('sale:sale:refund:re_one')
    expect(drafts[2].entry.entryDate).toBe('2026-09-20')
    expect(balances(drafts)).toMatchObject({ '4000': -6000, '1000': 6000 })
    expect(buildSaleJournalDrafts({ ...paid, refunds: [refund, refund] }, null)).toHaveLength(3)
    balanced(drafts)
  })
  it('refunds customer advances before reversing revenue that was never recognized', () => {
    const drafts = buildSaleJournalDrafts({ ...sale, amount: 80, amount_due: 0,
      payments: [{ amount: 100, date: '2026-08-01' }],
      refunds: [{ id: 're_advance', amount: 20, currency: 'USD', refunded_at: '2026-09-01' }] }, null)
    expect(balances(drafts)).toMatchObject({ '2300': 0, '1000': 8000, '4000': -8000 })
    balanced(drafts)
  })
  it('uses cumulative cents for tax refunds and returns the exact full tax', () => {
    const drafts = buildSaleJournalDrafts({ ...sale, amount: 0.03, amount_due: 0, status: 'refunded',
      payments: [{ amount: 0.03, date: '2026-08-01' }],
      refunds: [1, 2, 3].map(id => ({ id: `re_${id}`, amount: 0.01, currency: 'USD', refunded_at: `2026-09-0${id}` })) }, { tax_total: 0.01 })
    expect(balances(drafts)).toMatchObject({ '1000': 0, '4000': 0, '2100': 0 })
    balanced(drafts)
  })
  it('rejects ambiguous historic payments, unsafe amounts, cancellations and excessive refunds', () => {
    expect(() => buildSaleJournalDrafts({ ...sale, amount_due: 0, payments: [{ amount: 100 }] }, null)).toThrow('date')
    expect(() => buildSaleJournalDrafts({ ...sale, amount_due: 0, payments: [{ amount: 50, date: '2026-09-01' }] }, null)).toThrow('explain')
    expect(() => buildSaleJournalDrafts({ ...sale, amount: -1 }, null)).toThrow()
    expect(() => buildSaleJournalDrafts({ ...sale, status: 'cancelled' }, null)).toThrow('correcting')
    expect(() => buildSaleJournalDrafts({ ...sale, status: 'refunded' }, null)).toThrow('evidence')
    expect(() => buildSaleJournalDrafts({ ...sale, refunds: [{ id: 're_bad', amount: 1, currency: 'USD', refunded_at: '2026-09-01' }] }, null)).toThrow('exceed cash')
  })
})