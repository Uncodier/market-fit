import { fireEvent, render, screen } from '@testing-library/react'
import { usePathname, useRouter } from 'next/navigation'
import { TopBarFinanceActions } from '@/app/components/navigation/TopBarFinanceActions'

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'buyer-site' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))

const props = { isAccountingPage: false, isFinancePage: false, isJournalEntriesPage: false }

beforeEach(() => jest.clearAllMocks())

it('keeps New Purchase on the list with the existing marketplace destination', () => {
  jest.mocked(usePathname).mockReturnValue('/purchases/orders')
  const push = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  render(<TopBarFinanceActions {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase' }))
  expect(push).toHaveBeenCalledWith('/marketplace?ownerSiteId=buyer-site&returnTo=/purchases/orders')
})

it.each(['/purchases/orders/order-a', '/purchases/orders/demo-order-workplace'])('hides New Purchase on detail route %s', pathname => {
  jest.mocked(usePathname).mockReturnValue(pathname)
  render(<TopBarFinanceActions {...props} />)
  expect(screen.queryByRole('button', { name: 'New Purchase' })).not.toBeInTheDocument()
})

it('removes New Purchase when navigating from the list to a detail', () => {
  jest.mocked(usePathname).mockReturnValue('/purchases/orders')
  const view = render(<TopBarFinanceActions {...props} />)
  expect(screen.getByRole('button', { name: 'New Purchase' })).toBeInTheDocument()
  jest.mocked(usePathname).mockReturnValue('/purchases/orders/order-a')
  view.rerender(<TopBarFinanceActions {...props} />)
  expect(screen.queryByRole('button', { name: 'New Purchase' })).not.toBeInTheDocument()
})