import React, { Suspense } from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
import BillDetailPage from '@/app/bills/[id]/page'
import { getPurchaseById, deletePurchase, publishPurchase, unpublishPurchase, updatePurchase } from '@/app/purchases/actions'
import { ensureBillPublicAccessToken, sendVendorBill } from '@/app/bills/send-actions'
import type { Purchase } from '@/app/types'

jest.mock('@/app/components/auth/auth-context', () => ({ useAuthContext: () => ({ user: null }) }))

const demoId = 'demo-ecom-es-456'
const billId = `demo-payable-${demoId}-1`
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: demoId, name: 'Demo' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/purchases/actions', () => ({
  getPurchaseById: jest.fn(), deletePurchase: jest.fn(), publishPurchase: jest.fn(),
  unpublishPurchase: jest.fn(), updatePurchase: jest.fn(),
}))
jest.mock('@/app/bills/send-actions', () => ({ ensureBillPublicAccessToken: jest.fn(), sendVendorBill: jest.fn() }))
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock('@/app/bills/components/PurchaseInvoice', () => ({ PurchaseInvoice: ({ purchase }: { purchase: Purchase }) => <article>{purchase.title}</article> }))
jest.mock('@/app/bills/components/RegisterPurchasePaymentDialog', () => ({ RegisterPurchasePaymentDialog: () => <div>Payment dialog</div> }))
jest.mock('@/app/bills/components/CreatePurchaseDialog', () => ({ CreatePurchaseDialog: () => <div>Edit dialog</div> }))
jest.mock('@/app/bills/components/ReceivePurchaseStockDialog', () => ({ ReceivePurchaseStockDialog: () => <div>Receive dialog</div> }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getPurchaseById).mockResolvedValue({
    purchase: { id: billId, siteId: demoId, title: 'Monthly operating supplies', status: 'pending',
      amount: 1800, amountDue: 1200, accountingState: 'pending', stockReceived: false } as Purchase,
    error: null,
  })
})

async function show() {
  const params = Promise.resolve({ id: billId })
  await act(async () => {
    render(<Suspense fallback={<div>Loading</div>}><BillDetailPage params={params} /></Suspense>)
  })
}

it('renders the demo bill and disables real operations without mounting mutation dialogs', async () => {
  await show()
  expect(await screen.findByText('Monthly operating supplies')).toBeInTheDocument()
  expect(getPurchaseById).toHaveBeenCalledWith(demoId, billId)
  for (const name of ['Register payment', 'Edit', 'Print', 'Send', 'Vendor Link', 'Receive stock', 'Publish', 'Delete']) {
    const button = screen.getByRole('button', { name })
    expect(button).toBeDisabled()
    fireEvent.click(button)
  }
  expect(screen.queryByText('Payment dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('Edit dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('Receive dialog')).not.toBeInTheDocument()
  for (const action of [deletePurchase, publishPurchase, unpublishPurchase, updatePurchase, ensureBillPublicAccessToken, sendVendorBill]) {
    expect(action).not.toHaveBeenCalled()
  }
})

it('shows a settled missing-bill state rather than leaving permanent skeletons', async () => {
  jest.mocked(getPurchaseById).mockResolvedValue({ purchase: null, error: 'Bill not found' })
  await show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Bill not found')
})