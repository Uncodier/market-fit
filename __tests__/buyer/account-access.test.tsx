import { render, screen } from '@testing-library/react'
import { BuyerHomeView } from '@/app/buyer/components/BuyerHomeView'

const reservation = {
  id: 'reservation',
  start_time: '2030-01-01T10:00:00Z',
  end_time: '2030-01-01T11:00:00Z',
  catalog_item: { name: 'Booked session' },
}
let mockState = {
  data: {
    user: { id: 'account', email: 'account@example.com' },
    counts: { passes: 0 },
    activeReservations: [] as typeof reservation[],
    recentReservations: [] as typeof reservation[],
  },
  isLoading: false,
}

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))
jest.mock('@/app/buyer/actions', () => ({ getBuyerPortalSummary: jest.fn() }))
jest.mock('swr', () => ({ __esModule: true, default: () => mockState }))

beforeEach(() => {
  mockState = {
    data: {
      user: { id: 'account', email: 'account@example.com' },
      counts: { passes: 0 },
      activeReservations: [],
      recentReservations: [],
    },
    isLoading: false,
  }
})

test.each(['/home', '/buyer', '/purchases'])('does not offer self-registration or a generic access pass on %s', basePath => {
  render(<BuyerHomeView basePath={basePath} />)
  expect(screen.queryByRole('link', { name: /buyer.home.cards.visits.title/ })).not.toBeInTheDocument()
  expect(document.querySelector('a[href$="/visits/new"]')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /buyer.home.memberPass/ })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'User' })).toBeInTheDocument()
})

test('does not show passes or reservations without acquired access', () => {
  render(<BuyerHomeView basePath="/home" />)
  expect(screen.queryByRole('link', { name: /buyer.home.cards.passes.title/ })).not.toBeInTheDocument()
  expect(screen.queryByText('buyer.home.reservations.title')).not.toBeInTheDocument()
  expect(screen.queryByText('buyer.home.reservations.recent')).not.toBeInTheDocument()
})

test('does not advertise access while account data is loading', () => {
  mockState.isLoading = true
  render(<BuyerHomeView basePath="/home" />)
  expect(screen.queryByRole('link', { name: /buyer.home.cards.passes.title/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /buyer.home.memberPass/ })).not.toBeInTheDocument()
})

test('keeps acquired passes linked to the unified account library', () => {
  mockState.data.counts.passes = 1
  render(<BuyerHomeView basePath="/home" />)
  expect(screen.getByRole('link', { name: /buyer.home.cards.passes.title/ }))
    .toHaveAttribute('href', '/home/library?subtype=pass')
})

test.each(['activeReservations', 'recentReservations'] as const)('links %s to the existing reservation detail route', field => {
  mockState.data[field] = [reservation]
  render(<BuyerHomeView basePath="/home" />)
  expect(screen.getByRole('link', { name: /Booked session/ }))
    .toHaveAttribute('href', '/buyer/reservations/reservation')
})