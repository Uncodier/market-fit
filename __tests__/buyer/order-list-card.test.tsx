import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BuyerOrderListCard } from '@/app/buyer/components/BuyerOrderListCard'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import type { BuyerOrderDetail } from '@/app/buyer/order-detail-display'

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const imageProps = { ...props }
    delete imageProps.unoptimized
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imageProps} alt={props.alt || ''} />
  }
}))

const order: BuyerOrderDetail = {
  id: 'order', order_number: 'TEST-1001', created_at: '2026-10-20T10:00:00Z', status: 'completed',
  total: 120, currency: 'USD', site: { id: 'seller', name: 'Test seller' },
  sale_order_items: Array.from({ length: 5 }, (_, index) => ({
    id: `item-${index}`, name: `Item ${index}`, quantity: 1, catalog_item_id: `product-${index}`,
  })),
}

function setup(data = order, demo = false, locale = 'en') {
  const onView = jest.fn()
  const onBuyAgain = jest.fn()
  render(<LocalizationProvider preferredLocale={locale}><BuyerOrderListCard order={data} demo={demo} onView={onView} onBuyAgain={onBuyAgain} /></LocalizationProvider>)
  return { onView, onBuyAgain }
}

it('shows one action group per order and a bounded product preview', () => {
  const { onView, onBuyAgain } = setup()
  expect(screen.getAllByRole('button', { name: 'View Purchase' })).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'Buy Again' })).toHaveLength(1)
  expect(screen.getByText('Item 2')).toBeVisible()
  expect(screen.queryByText('Item 3')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('2 more items'))
  expect(onView).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Buy Again' }))
  expect(onBuyAgain).toHaveBeenCalledWith(null)
})

it('does not label completed orders as delivered using the creation date', () => {
  setup()
  expect(screen.getByText('Completed')).toBeVisible()
  expect(screen.queryByText(/Arrived on/)).not.toBeInTheDocument()
})

it('keeps demo purchase actions disabled and a single product destination', () => {
  setup({ ...order, sale_order_items: [order.sale_order_items![0]] }, true)
  expect(screen.getByRole('button', { name: 'Buy Again' })).toBeDisabled()
})

it('localizes status, dates and totals without striking through cancelled purchase history', () => {
  setup({ ...order, status: 'cancelled' }, false, 'es')
  expect(screen.getByText('Cancelado')).toBeVisible()
  const amount = screen.getByText(/120,00\s+US\$/)
  expect(amount).not.toHaveClass('line-through')
  expect(screen.queryByText(/October/)).not.toBeInTheDocument()
})

it('hides modifier lines from the main product count and preserves zero totals', () => {
  setup({ ...order, total: 0, sale_order_items: [order.sale_order_items![0], { id: 'extra', name: 'Extra', quantity: 1, metadata: { is_modifier: true } }] })
  expect(screen.queryByText('Extra')).not.toBeInTheDocument()
  expect(screen.getByText('$0.00')).toBeVisible()
})

it('handles missing amounts and invalid dates without inventing zeroes', () => {
  setup({ ...order, total: null, created_at: 'invalid', sale_order_items: [] })
  expect(screen.getByText('—')).toBeVisible()
  expect(screen.getByText('Item details are available in the purchase.')).toBeVisible()
  expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Buy Again' })).not.toBeInTheDocument()
})