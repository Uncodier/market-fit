import { fireEvent, render, screen, within } from '@testing-library/react'
import { TenderListingCard } from '@/app/tenders/tender-listing-card'
import type { PublicTenderRow } from '@/app/tenders/public-data'

let locale = 'en'
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale }) }))

beforeEach(() => { locale = 'en' })

const row: PublicTenderRow = {
  site_slug: 'buyer-site', site_name: 'Buyer company', tender_slug: 'equipment',
  publication_id: 'publication', version: 6, status: 'published', published_at: '2026-10-01T00:00:00Z',
  snapshot: {
    title: 'Equipment sourcing', description: 'Published equipment specifications', currency: 'USD',
    participation: 'open', opening_policy: 'after_close', participation_deadline: '2030-10-01T12:00:00Z',
    opening_at: '2030-10-02T12:00:00Z', requirements: [{ id: 'line', description: 'Equipment', quantity: 10, unit: 'boxes' }],
  },
}

test('keeps the title, buyer, deadline, requirements and visible action within one card', () => {
  render(<TenderListingCard row={row} closed={false} />)
  const card = screen.getByRole('article')
  expect(within(card).getByRole('heading', { name: row.snapshot.title })).toBeInTheDocument()
  expect(within(card).getByRole('link', { name: 'Buyer company' })).toHaveAttribute('href', '/tenders/buyer-site')
  expect(within(card).getByText('Open')).toBeInTheDocument()
  expect(within(card).getByText('Requirements · 1')).toBeInTheDocument()
  expect(card.querySelector('time')).toHaveAttribute('datetime', row.snapshot.participation_deadline)
  expect(card.querySelector('time')).toHaveTextContent('UTC')
  const action = within(card).getByRole('link', { name: 'View tender: Equipment sourcing' })
  expect(action).toHaveAttribute('href', '/tenders/buyer-site/equipment')
  expect(within(action).getByText('View tender')).not.toHaveClass('hidden')
  expect(action).toHaveClass('min-h-11')
  expect(action).not.toHaveClass('bg-primary', 'text-primary-foreground', 'border')
  expect(within(card).queryByRole('button')).not.toBeInTheDocument()
})

test('closed cards retain readable details without suggesting a future close or participation action', () => {
  render(<TenderListingCard row={{ ...row, site_name: undefined }} closed />)
  expect(screen.getByText('Closed')).toBeInTheDocument()
  expect(screen.getByText('Participation deadline')).toBeInTheDocument()
  expect(screen.queryByText(/Participation closes/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'buyer-site' })).toHaveAttribute('href', '/tenders/buyer-site')
  expect(screen.getByRole('link', { name: 'View tender: Equipment sourcing' })).toBeInTheDocument()
})

test('shows the buyer logo and countries in the directory card', () => {
  render(<TenderListingCard row={{ ...row, site_logo_url: 'https://example.com/logo.png',
    facets: { categories: [], regions: [{ value: 'mexico', label: 'Mexico' }, { value: 'canada', label: 'Canada' }] },
  }} closed={false} />)
  expect(screen.getByRole('img', { name: 'Buyer company' })).toHaveAttribute('src', 'https://example.com/logo.png')
  expect(screen.getByText('Mexico')).toBeInTheDocument()
  expect(screen.getByText('Canada')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Buyer company' })).toHaveAttribute('href', '/tenders/buyer-site')
})

test('localizes the directory country name', () => {
  locale = 'es'
  render(<TenderListingCard row={{ ...row, facets: { categories: [], regions: [{ value: 'mexico', label: 'Mexico' }] } }} closed />)
  expect(screen.getByText('México')).toBeInTheDocument()
})

test('missing or failed logos retain a compact building icon without inventing countries', () => {
  const { rerender } = render(<TenderListingCard row={row} closed={false} />)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.queryByText('Mexico')).not.toBeInTheDocument()
  expect(screen.getByRole('article').querySelector('.h-7.w-7 svg')).toBeInTheDocument()
  rerender(<TenderListingCard row={{ ...row, site_logo_url: 'https://example.com/logo.png' }} closed={false} />)
  fireEvent.error(screen.getByRole('img'))
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('article').querySelector('.h-7.w-7 svg')).toBeInTheDocument()
})