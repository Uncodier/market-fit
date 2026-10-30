import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { TenderDetailView } from '@/app/tenders/detail-view'
import { rawLocaleMessages } from '@/app/context/locale-catalog'
import type { PublicTenderRow } from '@/app/tenders/public-data'

let locale = 'en'
jest.mock('@/app/tenders/public-header', () => ({
  TenderHeader: ({ primaryActions }: { primaryActions?: ReactNode }) => <header aria-label="Main menu">{primaryActions}</header>,
  TenderFooter: () => <footer />,
}))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null }) }))

const tender: PublicTenderRow = {
  site_slug: 'buyer', site_name: 'First-time buyer', tender_slug: 'tender', publication_id: 'publication',
  version: 6, status: 'published', published_at: '2026-10-01T00:00:00Z',
  snapshot: { title: 'Monthly purchase', description: 'Published scope only', currency: 'MXN', participation: 'open',
    opening_policy: 'after_close', participation_deadline: '2030-11-05T01:05:00Z', opening_at: '2030-11-06T01:05:00Z',
    requirements: [{ id: 'line', quantity: 20, unit: 'kilos', description: 'Pork' }] },
}
beforeEach(() => { locale = 'en' })

test('submission stays in the participation flow rather than the main menu', () => {
  render(<TenderDetailView tender={tender} siteSlug="buyer" tenderSlug="tender" closed={false} />)
  expect(within(screen.getByRole('banner', { name: 'Main menu' })).queryByRole('link', { name: 'Submit proposal' })).not.toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Participation' })).getByRole('button', { name: 'Submit proposal' })).toBeEnabled()
  expect(screen.getAllByRole('button', { name: 'Submit proposal' })).toHaveLength(2)
})

test('introduces the buyer, explicitly identifies missing delivery details and explains participation', () => {
  const { container } = render(<TenderDetailView tender={tender} siteSlug="buyer" tenderSlug="tender" closed={false} />)
  const buyer = screen.getByRole('region', { name: 'Buying company' })
  expect(within(buyer).getByText('First-time buyer')).toBeInTheDocument()
  expect(within(buyer).getByRole('link')).toHaveAttribute('href', '/tenders/buyer')
  expect(screen.getByRole('region', { name: 'Delivery location' })).toHaveTextContent('No structured delivery address published')
  const guide = screen.getByRole('region', { name: 'How this tender works' })
  expect(within(guide).getAllByRole('listitem')).toHaveLength(3)
  expect(guide).toHaveTextContent('not a purchase')
  expect(screen.getByText('MXN')).toBeInTheDocument()
  expect(container.querySelector('time')).toHaveAttribute('dateTime', tender.snapshot.participation_deadline)
  expect(screen.getByText('Published version 6')).toBeInTheDocument()
  expect(container.querySelector('h1')!.compareDocumentPosition(buyer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test.each([
  ['open', 'without prior supplier registration'],
  ['invitation_only', 'You need an invitation'],
  ['approved_suppliers', 'eligible supplier relationship'],
])('uses policy-specific eligibility for %s', (participation, hint) => {
  render(<TenderDetailView tender={{ ...tender, snapshot: { ...tender.snapshot, participation } }} siteSlug="buyer" tenderSlug="tender" closed={false} />)
  expect(screen.getByRole('region', { name: 'Participation' })).toHaveTextContent(hint)
})

test('on-receipt opening does not advertise a scheduled opening date', () => {
  const { container } = render(<TenderDetailView tender={{ ...tender, snapshot: { ...tender.snapshot, opening_policy: 'on_receipt' } }} siteSlug="buyer" tenderSlug="tender" closed={false} />)
  expect(container.querySelectorAll('time')).toHaveLength(1)
  expect(screen.getByText(/can open proposals as they arrive/)).toBeInTheDocument()
})

test('Spanish renders the new guidance without translating buyer-provided content', () => {
  locale = 'es'
  render(<TenderDetailView tender={tender} siteSlug="buyer" tenderSlug="tender" closed />)
  expect(screen.getByRole('region', { name: 'Cómo funciona esta licitación' })).toBeInTheDocument()
  expect(screen.getByText('Published scope only')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Enviar propuesta' })).not.toBeInTheDocument()
})

test('new detail messages have matching translations and interpolation parameters in all supported languages', () => {
  const entries = Object.entries(rawLocaleMessages.en).filter(([key]) => key.startsWith('procurement.portal.detail.'))
  expect(entries.length).toBeGreaterThan(20)
  for (const messages of Object.values(rawLocaleMessages)) {
    for (const [key, english] of entries) {
      expect(messages[key]).toBeTruthy()
      expect(messages[key].match(/\{\{\w+\}\}/g) ?? []).toEqual(english.match(/\{\{\w+\}\}/g) ?? [])
    }
  }
})