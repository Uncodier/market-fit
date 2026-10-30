import { fireEvent, render, screen, within } from '@testing-library/react'
import { TenderBuyerContext } from '@/app/tenders/detail-context'
import type { PublicTenderRow } from '@/app/tenders/public-data'

let locale = 'en'
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key, locale }),
}))

const tender: PublicTenderRow = {
  site_slug: 'branch-14035', tender_slug: 'tender', publication_id: 'publication',
  version: 1, status: 'published', published_at: '2026-10-01T00:00:00Z',
  snapshot: {
    title: 'Monthly purchase', description: 'Published requirements', currency: 'MXN',
    participation: 'open', opening_policy: 'after_close',
    participation_deadline: '2030-11-05T01:05:00Z', opening_at: '2030-11-06T01:05:00Z',
    requirements: [],
  },
  site_name: 'Branch 14035', site_logo_url: 'https://example.com/site-logo.png',
  facets: { regions: [{ value: 'mexico', label: 'Mexico' }], categories: [] },
}

beforeEach(() => { locale = 'en' })

test('shows the site logo and country beside the buyer, not as a delivery address', () => {
  render(<TenderBuyerContext tender={tender} siteSlug="branch-14035" />)
  const buyer = screen.getByRole('region', { name: 'Buying company' })
  expect(within(buyer).getByRole('img', { name: 'Branch 14035' })).toHaveAttribute('src', tender.site_logo_url)
  expect(within(buyer).getByText('Mexico')).toBeInTheDocument()
  expect(within(buyer).getByRole('link')).toHaveAttribute('href', '/tenders/branch-14035')
  const delivery = screen.getByRole('region', { name: 'Delivery location' })
  expect(delivery).toHaveTextContent('No structured delivery address published')
  expect(delivery).not.toHaveTextContent('Mexico')
})

test('localizes countries and shows each buyer country when there are multiple', () => {
  locale = 'es'
  render(<TenderBuyerContext tender={{ ...tender, facets: { categories: [], regions: [
    ...tender.facets!.regions, { value: 'united states', label: 'United States' },
  ] } }} siteSlug="branch-14035" />)
  const buyer = screen.getByRole('region', { name: 'Empresa compradora' })
  expect(within(buyer).getByText('México')).toBeInTheDocument()
  expect(within(buyer).getByText('Estados Unidos')).toBeInTheDocument()
})

test('keeps the building fallback when the logo is missing or cannot load', () => {
  const { rerender } = render(<TenderBuyerContext tender={tender} siteSlug="branch-14035" />)
  const buyer = screen.getByRole('region', { name: 'Buying company' })
  fireEvent.error(within(buyer).getByRole('img'))
  expect(within(buyer).queryByRole('img')).not.toBeInTheDocument()
  expect(buyer.querySelector('svg')).toBeInTheDocument()
  rerender(<TenderBuyerContext tender={{ ...tender, site_logo_url: null, facets: undefined }} siteSlug="branch-14035" />)
  expect(within(buyer).queryByRole('img')).not.toBeInTheDocument()
  expect(within(buyer).queryByText('Mexico')).not.toBeInTheDocument()
  expect(within(buyer).getByText('Branch 14035')).toBeInTheDocument()
})

test('a different site logo can load after a previous logo failed', () => {
  const { rerender } = render(<TenderBuyerContext tender={tender} siteSlug="branch-14035" />)
  fireEvent.error(screen.getByRole('img'))
  rerender(<TenderBuyerContext tender={{ ...tender, site_logo_url: 'https://example.com/new-logo.png' }} siteSlug="branch-14035" />)
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/new-logo.png')
})