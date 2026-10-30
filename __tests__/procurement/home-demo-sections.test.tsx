import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { AccountSearchSlot, AccountSearchActionsSlot } from '@/app/buyer/components/AccountSearch'
import { SWRConfig } from 'swr'
import OrdersPage from '@/app/home/orders/page'
import LibraryPage from '@/app/home/library/page'
import QuotesPage from '@/app/home/quotes/page'
import SubscriptionsPage from '@/app/home/subscriptions/page'
import { PortalDemoProvider } from '@/app/home/demo-context'
import * as actions from '@/app/buyer/actions'
import { demoAccountLibrary, demoAccountOrders, demoAccountQuotes, demoAccountSubscriptions } from '@/app/home/demo-commerce'
import { getDemoHomeSummary } from '@/app/home/demo-summary'

const push = jest.fn()
let subtype = 'course'
jest.mock('next/navigation', () => ({ usePathname: () => '/home', useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams({ subtype }) }))
jest.mock('@/app/buyer/actions', () => ({
  listBuyerOrders: jest.fn(), listBuyerLibrary: jest.fn(), listBuyerQuotes: jest.fn(),
  listBuyerSubscriptions: jest.fn(), getUserSites: jest.fn(),
}))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '', locale: 'en' }) }))

beforeEach(() => { jest.clearAllMocks(); subtype = 'course' })
afterEach(() => {
  for (const action of [actions.getUserSites, actions.listBuyerOrders, actions.listBuyerLibrary,
    actions.listBuyerQuotes, actions.listBuyerSubscriptions]) expect(action).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})
function mount(children: ReactNode) {
  render(<SWRConfig value={{ provider: () => new Map() }}><PortalDemoProvider demo><header><AccountSearchSlot /><AccountSearchActionsSlot /></header><main>{children}</main></PortalDemoProvider></SWRConfig>)
}

test('orders can be filtered and opened, while purchasing stays disabled', () => {
  mount(<OrdersPage />)
  expect(screen.getByText('DEMO-1001')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: 'Search purchases...' }), { target: { value: 'DEMO-1001' } })
  expect(screen.queryByText('DEMO-1002')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'View Purchase' }))
  expect(push).toHaveBeenCalledWith('/home/preview/orders/demo-order-1')
  expect(screen.getByRole('button', { name: 'Buy Again' })).toBeDisabled()
})

test.each(['course', 'ticket', 'file', 'pass'])('library honors the home %s link and opens a preview', type => {
  subtype = type
  mount(<LibraryPage />)
  const row = demoAccountLibrary.find(item => item.catalog_item.digital_subtype === type)!
  expect(screen.getByRole('heading', { name: row.catalog_item.name })).toBeInTheDocument()
  const label = { course: 'Go to Course', ticket: 'View Ticket', file: 'Download', pass: 'Book' }[type]
  fireEvent.click(screen.getAllByRole('button', { name: label })[0])
  expect(push).toHaveBeenCalledWith(`/home/preview/library/${row.id}`)
})

test('subscriptions open local details', () => {
  mount(<SubscriptionsPage />)
  fireEvent.click(screen.getByText('Workspace membership'))
  expect(push).toHaveBeenCalledWith('/home/preview/subscriptions/demo-subscription-1')
})

test('quotations render and search without live actions', () => {
  mount(<QuotesPage />)
  expect(screen.getAllByText('Acme Workplace').length).toBe(4)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search quotations...' }), { target: { value: 'demo-account-quote-1' } })
  expect(screen.getAllByText('Acme Workplace')).toHaveLength(1)
})

test('home counters match the navigable lists', () => {
  const { counts } = getDemoHomeSummary()
  expect([demoAccountOrders.length, demoAccountSubscriptions.length, demoAccountQuotes.length, demoAccountLibrary.length])
    .toEqual([counts.orders, counts.subscriptions, counts.quotes, counts.library])
})

test.each([OrdersPage, LibraryPage, QuotesPage, SubscriptionsPage])('account list search renders in the main bar, not the content (%#)', Page => {
  mount(<Page />)
  expect(within(screen.getByRole('main')).queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox').closest('header')).not.toBeNull()
})