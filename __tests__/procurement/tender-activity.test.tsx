import { fireEvent, render, screen, within } from '@testing-library/react'
import { TenderActivity } from '@/app/purchases/tenders/tender-activity'
import type { Tender, TenderPublication } from '@/app/purchases/tenders/schema'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))

const tender = { portal_slug: 'office-chairs' } as Tender
const publication = (version: number): TenderPublication => ({
  id: `publication-${version}`, version, published_at: '2026-10-01T00:00:00Z',
  snapshot: { title: `Published terms ${version}`, description: 'Supplier-facing scope', currency: 'USD',
    participation: 'open', opening_policy: 'after_close', participation_deadline: '2030-01-01T00:00:00Z',
    opening_at: '2030-01-02T00:00:00Z', requirements: [{ id: 'line', description: 'Chairs', quantity: 20, unit: 'each' }] },
})

test('publication timeline orders real snapshots newest first without changing API data', () => {
  const publications = [publication(2), publication(7)]
  const { container } = render(<TenderActivity tender={tender} publications={publications} portalEnabled busy={false} siteSlug="buyer" onTogglePortal={jest.fn()} />)
  const history = screen.getByRole('list', { name: 'Activity' })
  const entries = Array.from(history.children) as HTMLElement[]
  expect(entries[0]).toHaveTextContent('Version 7')
  expect(entries[1]).toHaveTextContent('Version 2')
  expect(publications.map(row => row.version)).toEqual([2, 7])
  const disclosure = container.querySelector('details')!
  disclosure.open = true
  expect(within(disclosure).getByRole('heading', { name: 'Published terms 7' })).toBeInTheDocument()
  expect(disclosure).toHaveTextContent('Chairs — 20 each')
  expect(disclosure.querySelector('time')).toHaveAttribute('dateTime', publications[1].published_at)
  expect(screen.getByRole('link', { name: 'Open latest public publication' })).toHaveAttribute('href', '/tenders/buyer/office-chairs')
})

test('unpublished state has no invented history and portal action preserves busy state', () => {
  const toggle = jest.fn()
  const props = { tender, publications: [], portalEnabled: false, siteSlug: 'buyer', onTogglePortal: toggle }
  const { rerender } = render(<TenderActivity {...props} busy />)
  expect(screen.queryByRole('list', { name: 'Activity' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Open latest public publication' })).not.toBeInTheDocument()
  const button = screen.getByRole('button', { name: 'Enable workspace portal' })
  expect(button).toBeDisabled()
  fireEvent.click(button)
  expect(toggle).not.toHaveBeenCalled()
  rerender(<TenderActivity {...props} busy={false} />)
  fireEvent.click(button)
  expect(toggle).toHaveBeenCalledTimes(1)
})

test('interleaves receipt events with publications using real timestamps without proposal details', () => {
  const receipt = { receipt_number: 1, received_at: '2026-10-02T12:30:00Z', publication_id: 'publication-2', publication_version: 2 }
  const later = { ...publication(7), published_at: '2026-10-03T00:00:00Z' }
  render(<TenderActivity tender={tender} publications={[publication(2), later]} receipts={[receipt]} portalEnabled busy={false} siteSlug="buyer" onTogglePortal={jest.fn()} />)
  const entries = Array.from(screen.getByRole('list', { name: 'Activity' }).children) as HTMLElement[]
  expect(entries).toHaveLength(3)
  expect(entries[0]).toHaveTextContent('Version 7')
  expect(entries[1]).toHaveTextContent('Quotation received')
  expect(entries[1]).toHaveTextContent('Receipt #1 · Version 2')
  expect(entries[1].querySelector('time')).toHaveAttribute('dateTime', receipt.received_at)
  expect(entries[1].querySelector('details, button, a')).toBeNull()
  expect(entries[2]).toHaveTextContent('Version 2')
})