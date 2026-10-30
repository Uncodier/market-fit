import { fireEvent, render, screen, within } from '@testing-library/react'
import { TenderListing } from '@/app/tenders/tender-listing'
import { matchesTenderFacets, tenderFacetOptions } from '@/app/tenders/listing-facets'
import type { PublicTenderRow } from '@/app/tenders/public-data'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))

const mexico = { value: 'mexico', label: 'Mexico' }
const food = { value: 'food', label: 'Food' }
function row(id: string, regions = [mexico], categories = [food]): PublicTenderRow {
  return { publication_id: id, tender_slug: id, site_slug: 'buyer', version: 1, status: 'published', published_at: '2026-01-01',
    facets: { regions, categories }, snapshot: { title: id, description: '', currency: 'USD', participation: 'open',
      opening_policy: 'after_close', opening_at: '2030-01-02', participation_deadline: '2030-01-01', requirements: [] } }
}

test('counts publications, not duplicate lines or locations, and handles unavailable metadata', () => {
  expect(tenderFacetOptions([row('one', [mexico, mexico]), row('two'), { facets: undefined }], 'regions')).toEqual([{ ...mexico, count: 2 }])
  expect(matchesTenderFacets({ facets: undefined }, '', '')).toBe(true)
  expect(matchesTenderFacets({ facets: undefined }, 'mexico', '')).toBe(false)
  expect(matchesTenderFacets(row('one'), 'mexico', 'food')).toBe(true)
  expect(matchesTenderFacets(row('one'), 'mexico', 'equipment')).toBe(false)
})

test('combines category, region and participation and resets all filters from an empty state', () => {
  render(<TenderListing rows={[row('Food tender'), row('Equipment tender', [{ value: 'canada', label: 'Canada' }], [{ value: 'equipment', label: 'Equipment' }])]} closedIds={['Equipment tender']} />)
  const sidebar = within(screen.getByRole('complementary'))
  fireEvent.click(sidebar.getByRole('radio', { name: 'Mexico' }))
  expect(screen.getByRole('heading', { name: 'Food tender' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Equipment tender' })).not.toBeInTheDocument()
  fireEvent.click(sidebar.getByRole('radio', { name: 'Equipment' }))
  expect(screen.getByText('No publications match these filters.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show all publications on this page' }))
  expect(screen.getAllByRole('article')).toHaveLength(2)
  fireEvent.click(sidebar.getByRole('button', { name: 'Participation closed' }))
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(screen.getByRole('heading', { name: 'Equipment tender' })).toBeInTheDocument()
})

test('does not render region or category groups without available metadata', () => {
  render(<TenderListing rows={[row('Unclassified', [], [])]} closedIds={[]} />)
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Unclassified' })).toBeInTheDocument()
})

test('mobile and desktop facet controls share selection with unique radio group IDs', () => {
  render(<TenderListing rows={[row('Food tender')]} closedIds={[]} />)
  const radios = screen.getAllByRole('radio', { name: 'Mexico' })
  fireEvent.click(radios[1])
  for (const radio of radios) expect(radio).toHaveAttribute('aria-checked', 'true')
  const ids = screen.getAllByRole('radiogroup').map(group => group.getAttribute('aria-labelledby'))
  expect(new Set(ids).size).toBe(ids.length)
})