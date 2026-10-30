import { render } from '@testing-library/react'
import { toast } from 'sonner'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'

jest.mock('sonner', () => ({ toast: { info: jest.fn() } }))

beforeEach(() => jest.clearAllMocks())

it('leaves demo identification to the global chip without a toast or inline banner', () => {
  const { container, rerender } = render(<ProcurementDemoNotice />)
  expect(container).toBeEmptyDOMElement()
  expect(toast.info).not.toHaveBeenCalled()
  rerender(<ProcurementDemoNotice />)
  expect(toast.info).not.toHaveBeenCalled()
})

it('does not interrupt navigation when nested demo panels mount together', () => {
  const { container } = render(<><ProcurementDemoNotice /><ProcurementDemoNotice /></>)
  expect(container).toBeEmptyDOMElement()
  expect(toast.info).not.toHaveBeenCalled()
})