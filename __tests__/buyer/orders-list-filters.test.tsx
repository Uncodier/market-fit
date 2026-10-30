import { fireEvent, render, screen } from '@testing-library/react'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { BuyerOrdersView } from '@/app/buyer/components/BuyerOrdersView'

jest.mock('@/app/buyer/actions', () => ({ listBuyerOrders: jest.fn(), getUserSites: jest.fn() }))
jest.mock('@/app/lib/image-utils', () => ({ resolveItemImage: () => null }))

it('filters cancelled demo orders and resets to all purchases without live reads', () => {
  render(<LocalizationProvider preferredLocale="en"><BuyerOrdersView demo /></LocalizationProvider>)
  expect(screen.getByText('12 purchases')).toBeVisible()
  const cancelled = screen.getByRole('tab', { name: 'Cancelled' })
  fireEvent.mouseDown(cancelled, { button: 0, ctrlKey: false })
  fireEvent.click(cancelled)
  expect(screen.getByText('1 purchase')).toBeVisible()
  expect(screen.getByRole('button', { name: 'DEMO-1012' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'DEMO-1001' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
  expect(screen.getByText('12 purchases')).toBeVisible()
  expect(screen.getByRole('button', { name: 'DEMO-1001' })).toBeVisible()
})