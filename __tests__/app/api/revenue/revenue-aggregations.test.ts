import {
  getSalesAmount,
  isRecognizedRevenueSale,
  mergeSalesById,
  percentChangeFrom,
  saleCalendarDate,
  salesInLocalRange,
} from '@/app/api/revenue/revenue-aggregations'
import { inclusiveEndWithUtcSlack } from '@/lib/costs/aggregate-costs'

describe('isRecognizedRevenueSale', () => {
  it('counts completed sales as revenue', () => {
    expect(isRecognizedRevenueSale({ status: 'completed', amount_due: 40 })).toBe(true)
  })

  it('counts paid pending sales to match the Orders paid badge', () => {
    expect(isRecognizedRevenueSale({ status: 'pending', amount_due: 0 })).toBe(true)
    expect(isRecognizedRevenueSale({ status: 'pending' })).toBe(true)

  })

  it('excludes unpaid, cancelled, and refunded sales', () => {
    expect(isRecognizedRevenueSale({ status: 'pending', amount_due: 80 })).toBe(false)
    expect(isRecognizedRevenueSale({ status: 'cancelled', amount_due: 0 })).toBe(false)
    expect(isRecognizedRevenueSale({ status: 'refunded', amount_due: 0 })).toBe(false)
  })
})

describe('salesInLocalRange', () => {
  const start = '2026-08-01'
  const end = inclusiveEndWithUtcSlack('2026-08-13')

  it('keeps evening sales whose UTC sale_date slipped to the next day', () => {
    const sales = [
      { id: '1', status: 'completed', amount: 144, sale_date: '2026-08-13' },
      { id: '2', status: 'completed', amount: 80, sale_date: '2026-08-14' },
      { id: '3', status: 'completed', amount: 60, sale_date: '2026-07-31' },
    ]

    expect(salesInLocalRange(sales, start, end).map((sale) => sale.id)).toEqual(['1', '2'])
  })

  it('falls back to created_at when sale_date is missing', () => {
    const sales = [
      { id: '1', status: 'completed', amount: 100, created_at: '2026-08-13T04:52:00.000Z' },
    ]

    expect(salesInLocalRange(sales, start, end)).toHaveLength(1)
  })

  it('drops cancelled rows even when they fall in range', () => {
    const sales = [
      { id: '1', status: 'cancelled', amount: 140, sale_date: '2026-08-13' },
    ]

    expect(salesInLocalRange(sales, start, end)).toEqual([])
  })
})

describe('sale helpers', () => {
  it('prefers the calendar sale_date over created_at', () => {
    expect(
      saleCalendarDate({
        sale_date: '2026-08-13',
        created_at: '2026-08-14T04:52:00.000Z',
      })
    ).toBe('2026-08-13')
  })

  it('merges duplicate sale rows by id', () => {
    expect(
      mergeSalesById(
        [{ id: '1', amount: 10 }],
        [{ id: '1', amount: 10 }, { id: '2', amount: 20 }]
      )
    ).toEqual([
      { id: '1', amount: 10 },
      { id: '2', amount: 20 },
    ])
  })

  it('parses currency-formatted amounts', () => {
    expect(getSalesAmount({ amount: 'MX$144.00' })).toBe(144)
  })

  it('treats a jump from zero as +100%', () => {
    expect(percentChangeFrom(0, 140)).toBe(100)
    expect(percentChangeFrom(140, 0)).toBe(-100)
  })
})
