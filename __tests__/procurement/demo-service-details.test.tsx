import { fireEvent, render, screen } from '@testing-library/react'
import { DemoReservationDetail, DemoSubscriptionDetail } from '@/app/home/demo-service-details'
import { ReservationManagePanel } from '@/app/components/commerce/pdp/ReservationManagePanel'
import { SubscriptionManagePanel } from '@/app/components/commerce/pdp/SubscriptionManagePanel'
import { cancelBuyerSubscription } from '@/app/buyer/actions'
import { cancelBuyerReservation, rescheduleBuyerReservation } from '@/app/buyer/reservation-actions'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/buyer/actions', () => ({ cancelBuyerSubscription: jest.fn() }))
jest.mock('@/app/buyer/reservation-actions', () => ({ cancelBuyerReservation: jest.fn(), rescheduleBuyerReservation: jest.fn() }))
jest.mock('@/app/components/commerce/pdp/BuyerExperienceShell', () => ({
  BuyerExperienceShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('@/app/components/commerce/pdp/ServicePdpLayout', () => ({
  ServicePdpLayout: ({ item, experience }: { item: { name: string }; experience: { demo: boolean; reservation: object } }) =>
    <><h1>{item.name}</h1><ReservationManagePanel reservation={experience.reservation} demo={experience.demo} /></>,
}))
jest.mock('@/app/components/commerce/pdp/ProductDetailPage', () => ({
  ProductDetailPage: ({ item, experience }: { item: { name: string }; experience: { demo: boolean; subscription: object } }) =>
    <><h1>{item.name}</h1><SubscriptionManagePanel subscription={experience.subscription} demo={experience.demo} /></>,
}))
jest.mock('@/app/components/commerce/ReservationSlotPicker', () => ({ ReservationSlotPicker: () => <div>Slot picker</div> }))
jest.mock('react-qr-code', () => ({ __esModule: true, default: ({ value }: { value: string }) => <svg data-testid="demo-qr" data-value={value} /> }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }), notFound: () => { throw new Error('Not found') } }))

beforeEach(() => jest.clearAllMocks())

it('uses the purchased service layout and blocks real subscription cancellation', () => {
  render(<DemoSubscriptionDetail id="demo-subscription-1" />)
  expect(screen.getByRole('heading', { name: 'Workspace membership' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Manage Subscription' })).toBeInTheDocument()
  const cancel = screen.getByRole('button', { name: 'Cancel Subscription' })
  expect(cancel).toBeDisabled()
  fireEvent.click(cancel)
  expect(cancelBuyerSubscription).not.toHaveBeenCalled()
})

it('uses reservation management with a fictional QR and disabled live actions', () => {
  render(<DemoReservationDetail id="demo-reservation-consultation" />)
  expect(screen.getByRole('heading', { name: 'Technology consultation' })).toBeInTheDocument()
  for (const name of ['Cancel Reservation', 'Reschedule', 'Download Pass']) {
    const button = screen.getByRole('button', { name })
    expect(button).toBeDisabled()
    fireEvent.click(button)
  }
  expect(screen.queryByText('Slot picker')).not.toBeInTheDocument()
  expect(screen.getByTestId('demo-qr')).toHaveAttribute('data-value', 'DEMO-NOT-VALID:demo-reservation-consultation')
  expect(cancelBuyerReservation).not.toHaveBeenCalled()
  expect(rescheduleBuyerReservation).not.toHaveBeenCalled()
})

it('retains live management actions outside demo mode', () => {
  render(<SubscriptionManagePanel subscription={{ id: 'live-subscription', status: 'active' }} />)
  expect(screen.getByRole('button', { name: 'Cancel Subscription' })).toBeEnabled()
})

it('rejects unknown fixtures without backend reads', () => {
  expect(() => DemoSubscriptionDetail({ id: 'unknown' })).toThrow('Not found')
  expect(() => DemoReservationDetail({ id: 'unknown' })).toThrow('Not found')
})