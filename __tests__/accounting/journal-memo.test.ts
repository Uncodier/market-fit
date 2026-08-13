import { memoFromExpense, memoFromPurchase, memoFromSale, resolveJournalMemo } from '@/app/accounting/journal-memo'

describe('journal memos', () => {
  it('ignores sale titles that are order placeholders or ids', () => {
    expect(
      memoFromSale({
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        title: 'Order - aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        product_name: 'Pro plan',
        leads: { name: 'Acme' },
      })
    ).toBe('Pro plan · Acme')
  })

  it('replaces stored uuid memos with parent data', () => {
    expect(
      resolveJournalMemo(
        'sale',
        { id: 'sale-1', invoice_number: '88', leads: { name: 'Rita' } },
        'Sale sale-1',
        'sale-1'
      )
    ).toBe('#88 · Rita')
  })

  it('falls back to expense category when description is missing', () => {
    expect(memoFromExpense({ id: 'exp-1', category: 'software' })).toBe('Software')
  })

  it('uses vendor when purchase title is empty', () => {
    expect(memoFromPurchase({ id: 'pur-1', vendor: { name: 'AWS' } })).toBe('AWS')
  })

  it('keeps manual memos that are not ids', () => {
    expect(resolveJournalMemo('manual', null, 'Monthly rent')).toBe('Monthly rent')
  })
})
