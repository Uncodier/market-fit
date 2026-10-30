import { fireEvent, render, screen, within } from '@testing-library/react'
import { DemoOrderDocument } from '@/app/purchases/procurement/commerce/demo-documents'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key.startsWith('status.') ? key : '' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/purchases/procurement/ui/demo-notice', () => ({ ProcurementDemoNotice: () => null }))
jest.mock('@/app/quotations/components/QuotationInvoice', () => ({ QuotationInvoice: () => null }))
jest.mock('@/app/purchases/procurement/evidence/shared-evidence', () => ({ SharedEvidence: () => null }))
jest.mock('@/app/purchases/procurement/commerce/CommerceApproval', () => ({ CommerceApproval: () => null }))

it('uses the workspace sticky tabs and toolbar for the fictional order without mutations', () => {
  render(<DemoOrderDocument id="demo-order-workplace" siteId="demo-ecommerce" />)
  const toolbar = screen.getByRole('tab', { name: 'Details' }).closest('[data-toolbar-font]')!
  expect(toolbar).toHaveClass('sticky', 'print:hidden')
  expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
  expect(within(toolbar as HTMLElement).getByText('approved')).toBeInTheDocument()
  expect(screen.queryByText('status.approved')).not.toBeInTheDocument()
  expect(screen.getByRole('article').parentElement).toHaveClass('max-w-[800px]')
  expect(screen.getByText('Cedar Services')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View awarded quotation' })).toHaveAttribute('href', '/purchases/quotes/demo-quote-cedar')
  expect(screen.queryByRole('link', { name: 'Buy Again' })).not.toBeInTheDocument()
  const print = jest.spyOn(window, 'print').mockImplementation(() => {})
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  expect(print).toHaveBeenCalledTimes(1)
  print.mockRestore()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Shipments' }), { button: 0, ctrlKey: false })
  expect(screen.getByText('No delivery information for this order.')).toBeInTheDocument()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
})

it('keeps navigation but hides document actions when the demo order is missing', () => {
  render(<DemoOrderDocument id="missing" siteId="demo-ecommerce" />)
  expect(screen.getByRole('alert')).toHaveTextContent('Demo order not found')
  expect(screen.getByRole('link', { name: 'Back to orders' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Shipments' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument()
})