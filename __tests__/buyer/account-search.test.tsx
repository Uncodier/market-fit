import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { AccountSearch, AccountSearchActionsSlot, AccountSearchSlot, AccountSubheader } from '@/app/buyer/components/AccountSearch'
import { BuyerQuotesView } from '@/app/buyer/components/BuyerQuotesView'
import useSWR from 'swr'
import { usePathname } from 'next/navigation'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/buyer/actions', () => ({ listBuyerQuotes: jest.fn() }))
jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/app/components/documents/quotes-table', () => ({
  QuotesTable: ({ rows }: { rows: { id: string; entityName: string }[] }) => <div>{rows.map(row => <p key={row.id}>{row.entityName}</p>)}</div>,
  QuotesTableSkeleton: () => null,
}))

beforeEach(() => {
  jest.mocked(usePathname).mockReturnValue('/buyer/orders')
})

function Screen({ label }: { label: string }) {
  const [query, setQuery] = useState('')
  return <AccountSubheader scope="personal">
    <AccountSearch value={query} onChange={event => setQuery(event.target.value)} placeholder={label} />
    <p>{['Alpha', 'Beta'].filter(item => item.toLowerCase().includes(query.toLowerCase())).join(', ')}</p>
  </AccountSubheader>
}

it('moves the active screen search into the main bar and filters on every change', () => {
  const { container, rerender } = render(<><header><AccountSearchSlot /></header><Screen key="orders" label="Search purchases" /></>)
  const input = within(container.querySelector('header')!).getByRole('textbox', { name: 'Search purchases' })
  fireEvent.change(input, { target: { value: 'beta' } })
  expect(screen.getByText('Beta')).toBeInTheDocument()
  expect(screen.queryByText('Alpha, Beta')).not.toBeInTheDocument()
  expect(container.querySelector('[data-account-subheader]')).not.toHaveClass('sticky')
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(screen.getByText('Alpha, Beta')).toBeInTheDocument()
  rerender(<><header><AccountSearchSlot /></header><Screen key="library" label="Search library" /></>)
  expect(screen.queryByRole('textbox', { name: 'Search purchases' })).not.toBeInTheDocument()
  expect(within(container.querySelector('header')!).getByRole('textbox', { name: 'Search library' })).toHaveValue('')
})

it('matches Shop width and opens a mobile search sharing the desktop query', () => {
  const { container } = render(<><header><AccountSearchSlot /><AccountSearchActionsSlot /></header><Screen label="Search purchases" /></>)
  expect(container.querySelector('[data-account-search]')).toHaveClass('w-2/5', 'hidden', 'md:block', 'absolute')
  fireEvent.click(screen.getByRole('button', { name: 'Search purchases' }))
  const mobile = container.querySelector<HTMLInputElement>('#mobile-search-input')!
  fireEvent.change(mobile, { target: { value: 'beta' } })
  expect(screen.getByText('Beta')).toBeInTheDocument()
  expect(screen.getAllByRole('textbox').every(input => (input as HTMLInputElement).value === 'beta')).toBe(true)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(container.querySelector('#mobile-search-input')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveValue('beta')
})

it.each(['/buyer/quotes', '/home/quotes'])('connects %s to its own live result filter', pathname => {
  jest.mocked(usePathname).mockReturnValue(pathname)
  jest.mocked(useSWR).mockReturnValue({
    data: { data: [{ id: 'one', site: { name: 'Alpha merchant' } }, { id: 'two', site: { name: 'Beta merchant' } }], count: 2 },
    isLoading: false,
  } as never)
  const { container } = render(<><header><AccountSearchSlot /></header><main><BuyerQuotesView /></main></>)
  const searchRegion = container.querySelector('header')!
  fireEvent.change(within(searchRegion).getByRole('textbox'), { target: { value: 'beta' } })
  expect(screen.getByText('Beta merchant')).toBeInTheDocument()
  expect(screen.queryByText('Alpha merchant')).not.toBeInTheDocument()
  expect(container.querySelector('[data-account-subheader]')).not.toHaveClass('sticky')
})

it.each(['/home', '/home/orders', '/home/quotes', '/home/subscriptions', '/home/library', '/home/tenders', '/home/submissions', '/home/profile'])(
  'keeps the search in the main bar on %s rather than next to content filters', pathname => {
    jest.mocked(usePathname).mockReturnValue(pathname)
    const { container } = render(<><header><AccountSearchSlot /><AccountSearchActionsSlot /></header><main><Screen label="Search records" /></main></>)
    expect(within(container.querySelector('main')!).queryByRole('textbox')).not.toBeInTheDocument()
    const input = within(container.querySelector('header')!).getByRole('textbox', { name: 'Search records' })
    expect(container.querySelector('[data-account-search]')).toHaveClass('w-2/5', 'absolute', 'md:block')
    fireEvent.change(input, { target: { value: 'beta' } })
    expect(screen.getByText('Beta')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByText('Alpha, Beta')).toBeInTheDocument()
  },
)

it('preserves workspace search placement on site-scoped screens', () => {
  jest.mocked(usePathname).mockReturnValue('/purchases/quotes')
  const { container } = render(<><header><AccountSearchSlot /></header><main>
    <AccountSearch scope="site" value="" onChange={jest.fn()} placeholder="Search workspace" />
  </main></>)
  expect(within(container.querySelector('header')!).queryByRole('textbox')).not.toBeInTheDocument()
  expect(within(container.querySelector('main')!).getByRole('textbox')).toBeInTheDocument()
})