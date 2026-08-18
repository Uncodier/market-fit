import { buildFromSale, buildFromExpense, buildFromPurchase } from '@/app/accounting/builders'

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
    expect(draft!.entry.memo).toBe('Sale')
  })

  it('returns valid draft for unpaid pending sales now since they represent real AR', () => {
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
    ).not.toBeNull()
  })

  it('uses recorded payments when amount_due was reset after a promo', () => {
    const draft = buildFromSale(
      {
        id: 'sale-promo',
        site_id: 'site-1',
        status: 'completed',
        amount: 128,
        amount_due: 128,
        sale_date: '2026-08-13',
        payments: [{ amount: 160 }],
      },
      null
    )
    expect(draft!.lines.find(l => l.accountCode === '1000')?.debit).toBe(128)
    expect(draft!.lines.find(l => l.accountCode === '1100')).toBeUndefined()
  })

  it('posts a paid pending sale as cash to revenue', () => {
    const draft = buildFromSale(
      {
        id: 'sale-paid',
        site_id: 'site-1',
        status: 'pending',
        amount: 80,
        amount_due: 0,
        sale_date: '2026-08-13',
      },
      null
    )
    expect(draft).not.toBeNull()
    expect(draft!.lines.find(l => l.accountCode === '1000')?.debit).toBe(80)
    expect(draft!.lines.find(l => l.accountCode === '1100')).toBeUndefined()
    expect(draft!.lines.find(l => l.accountCode === '4000')?.credit).toBe(80)
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
      new Map([['advertising', '5200'], ['other', '5900']])
    )

    expect(draft).not.toBeNull()
    expect(draft!.lines.find(l => l.accountCode === '5200')).toMatchObject({
      debit: 40,
      credit: 0,
    })
    expect(draft!.lines.find(l => l.accountCode === '1000')).toMatchObject({
      debit: 0,
      credit: 40,
    })
    expect(draft!.entry.idempotencyKey).toBe('expense:exp-1')
    expect(draft!.entry.memo).toBe('Ads')
  })

  it('changes source hash when category changes', () => {
    const map = new Map([
      ['advertising', '5200'],
      ['software', '5300'],
      ['other', '5900'],
    ])
    const a = buildFromExpense(
      {
        id: 'exp-1',
        site_id: 'site-1',
        amount: 40,
        category: 'advertising',
        date: '2026-07-02',
        currency: 'USD',
      },
      map
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
      map
    )
    expect(a!.entry.sourceHash).not.toBe(b!.entry.sourceHash)
  })

  it('builds purchase with inventory + AP for unpaid product bill', () => {
    const draft = buildFromPurchase(
      {
        id: 'pur-1',
        site_id: 'site-1',
        status: 'pending',
        amount: 100,
        amount_due: 100,
        purchase_date: '2026-08-07',
        currency: 'USD',
      },
      [
        {
          catalog_item_id: 'item-1',
          name: 'Widget',
          quantity: 2,
          unit_cost: 50,
          subtotal: 100,
          catalog_items: { kind: 'product' },
        },
      ]
    )

    expect(draft).not.toBeNull()
    const debits = draft!.lines.reduce((s, l) => s + (l.debit || 0), 0)
    const credits = draft!.lines.reduce((s, l) => s + (l.credit || 0), 0)
    expect(debits).toBeCloseTo(credits, 2)
    expect(draft!.lines.find(l => l.accountCode === '1200')?.debit).toBe(100)
    expect(draft!.lines.find(l => l.accountCode === '2200')?.credit).toBe(100)
    expect(draft!.entry.sourceType).toBe('purchase')
    expect(draft!.entry.idempotencyKey).toBe('purchase:pur-1')
    expect(draft!.entry.memo).toBe('Bill')
  })

  it('splits purchase cash/AP and inventory/operating', () => {
    const draft = buildFromPurchase(
      {
        id: 'pur-2',
        site_id: 'site-1',
        status: 'pending',
        amount: 150,
        amount_due: 50,
        purchase_date: '2026-08-07',
        currency: 'USD',
      },
      [
        {
          catalog_item_id: 'item-1',
          subtotal: 100,
          catalog_items: { kind: 'product' },
        },
        {
          catalog_item_id: null,
          name: 'Consulting',
          subtotal: 50,
        },
      ]
    )

    expect(draft).not.toBeNull()
    expect(draft!.lines.find(l => l.accountCode === '1200')?.debit).toBe(100)
    expect(draft!.lines.find(l => l.accountCode === '5600')?.debit).toBe(50)
    expect(draft!.lines.find(l => l.accountCode === '1000')?.credit).toBe(100)
    expect(draft!.lines.find(l => l.accountCode === '2200')?.credit).toBe(50)
  })

  it('returns null for draft purchases', () => {
    expect(
      buildFromPurchase(
        {
          id: 'pur-3',
          site_id: 'site-1',
          status: 'draft',
          amount: 10,
          amount_due: 10,
          purchase_date: '2026-08-07',
        },
        []
      )
    ).toBeNull()
  })

  it('builds sale memo from invoice and customer', () => {
    const draft = buildFromSale(
      {
        id: 'sale-memo',
        site_id: 'site-1',
        status: 'completed',
        amount: 100,
        amount_due: 0,
        sale_date: '2026-07-01',
        invoice_number: '1042',
        leads: { name: 'Jane Doe' },
      },
      null
    )
    expect(draft!.entry.memo).toBe('#1042 · Jane Doe')
  })

  it('builds purchase memo from title and vendor', () => {
    const draft = buildFromPurchase(
      {
        id: 'pur-memo',
        site_id: 'site-1',
        status: 'pending',
        amount: 20,
        amount_due: 20,
        purchase_date: '2026-08-07',
        title: 'Office supplies',
        vendor: { name: 'Staples' },
      },
      []
    )
    expect(draft!.entry.memo).toBe('Office supplies · Staples')
  })
})
