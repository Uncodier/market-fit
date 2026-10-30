import { fireEvent, render, screen, within } from '@testing-library/react'
import { TenderDirectoryView } from '@/app/tenders/directory-view'
import { TenderListing } from '@/app/tenders/tender-listing'
import TenderLoading from '@/app/tenders/loading'
import TenderDetailLoading from '@/app/tenders/[siteSlug]/[tenderSlug]/loading'
import { TenderDetailView } from '@/app/tenders/detail-view'
import { tenderDetailClasses } from '@/app/tenders/detail-presentation'
import type { PublicTenderRow } from '@/app/tenders/public-data'
import { rawLocaleMessages } from '@/app/context/locale-catalog'

jest.mock('@/app/tenders/public-header', () => ({ TenderHeader: () => <header />, TenderFooter: () => <footer /> }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))

function publication(id: string, title: string, deadline: string): PublicTenderRow {
  return { site_slug: 'buyer-site', tender_slug: id, publication_id: id, version: 2, status: 'published', published_at: '2026-10-01T00:00:00Z',
    snapshot: { title, description: 'Published scope', currency: 'USD', participation: 'open', opening_policy: 'after_close',
      participation_deadline: deadline, opening_at: '2030-10-02T12:00:00Z', requirements: [{ id: 'line', description: 'Original requirement', quantity: 10, unit: 'boxes' }] } }
}
const rows = [publication('open-tender', 'Open opportunity', '2030-10-01T12:00:00Z'), publication('closed-tender', 'Closed opportunity', '2020-10-01T12:00:00Z')]

test('marketplace sidebar and mobile chips filter the same tender rows', () => {
  const { container } = render(<TenderListing rows={rows} closedIds={['closed-tender']} />)
  const sidebar = screen.getByRole('complementary')
  expect(sidebar).toHaveClass('md:w-64', 'md:sticky', 'md:overflow-y-auto')
  expect(container.querySelector('.grid')).toHaveClass('lg:grid-cols-[minmax(0,1fr)_14rem]')
  expect(container.querySelector('article')).toHaveClass('border', 'bg-card', 'rounded-2xl')
  expect(container.querySelector('[class~="aspect-[4/3]"]')).not.toBeInTheDocument()
  const openLabel = rawLocaleMessages.en['procurement.portal.listing.open']
  fireEvent.click(within(sidebar).getByRole('button', { name: openLabel }))
  expect(screen.getByRole('link', { name: 'Open opportunity' })).toHaveAttribute('href', '/tenders/buyer-site/open-tender')
  expect(screen.queryByRole('link', { name: 'Closed opportunity' })).not.toBeInTheDocument()
  const mobile = screen.getByRole('group', { name: rawLocaleMessages.en['procurement.portal.listing.mobileFilters'] })
  expect(within(mobile).getByRole('button', { name: openLabel })).toHaveAttribute('aria-pressed', 'true')
})

test.each([null, 'Tender publications are temporarily unavailable.'])('empty and failed directories retain the marketplace sidebar (%s)', error => {
  render(<TenderDirectoryView page={0} search="missing" rows={[]} closedIds={[]} error={error} />)
  expect(screen.getByRole('complementary')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  if (error) {
    expect(screen.getByRole('alert')).toHaveTextContent('Tender publications are temporarily unavailable.')
    expect(screen.queryByRole('navigation', { name: 'Tender pages' })).not.toBeInTheDocument()
  } else expect(screen.getByRole('link', { name: 'Clear search' })).toHaveAttribute('href', '/tenders')
})

test('directory pagination retains site and search without moving outside the listing column', () => {
  render(<TenderDirectoryView siteSlug="buyer-site" page={1} search="boxes & paper" rows={rows} closedIds={[]} error={null} />)
  expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/tenders/buyer-site?page=0&search=boxes%20%26%20paper')
})

test('directory loader matches the document cards without placeholder product media', () => {
  const { container } = render(<TenderLoading />)
  expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  const grid = container.querySelector('.space-y-3')!
  expect(grid.children).toHaveLength(6)
  expect(grid.querySelectorAll('[class~="aspect-[4/3]"]')).toHaveLength(0)
  for (const card of grid.children) expect(card).toHaveClass('border', 'bg-card', 'rounded-2xl')
  expect(screen.getByRole('complementary')).toHaveClass('w-64')
})

test('detail and its loader share reading columns, requirements surfaces and mobile action bar', () => {
  const view = render(<TenderDetailView siteSlug="buyer-site" tenderSlug="open-tender" tender={rows[0]} closed={false} />)
  expect(screen.getByRole('main')).toHaveClass(...tenderDetailClasses.main.split(' '))
  expect(view.container.querySelector('.grid')).toHaveClass(...tenderDetailClasses.grid.split(' '))
   expect(screen.getByRole('heading', { level: 1, name: rows[0].snapshot.title })).toHaveClass('lg:text-5xl')
  expect(screen.getByText('Original requirement')).toBeInTheDocument()
  const submitLabel = rawLocaleMessages.en['procurement.portal.public.submit']
  for (const button of screen.getAllByRole('button', { name: submitLabel })) expect(button).toBeEnabled()
  view.rerender(<TenderDetailLoading />)
  expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('main')).toHaveClass(...tenderDetailClasses.main.split(' '))
  expect(view.container.querySelector('.grid')).toHaveClass(...tenderDetailClasses.grid.split(' '))
})

test('closed tender has disabled participation actions and no submission link', () => {
  render(<TenderDetailView siteSlug="buyer-site" tenderSlug="closed-tender" tender={rows[1]} closed />)
  expect(screen.queryByRole('link', { name: rawLocaleMessages.en['procurement.portal.public.submit'] })).not.toBeInTheDocument()
  for (const button of screen.getAllByRole('button', { name: rawLocaleMessages.en['procurement.portal.public.closed'] })) expect(button).toBeDisabled()
})