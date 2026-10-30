import { fireEvent, render, screen } from '@testing-library/react'
import { Choice, DateOnlyField, DateTimeField } from '@/app/purchases/procurement/components/form-fields'
import { ProcurementWorkspace, ProcurementState } from '@/app/purchases/procurement/ui/workspace'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ locale: 'en', t: (key: string) => key }) }))
jest.mock('@/app/hooks/use-command-k', () => ({ useCommandK: jest.fn() }))

test('renders the actual sticky workspace toolbar and structured storage error', () => {
  const retry = jest.fn()
  const view = render(<ProcurementWorkspace title="Tenders" toolbar={<button>Create tender</button>}>
    <ProcurementState error="Tender storage unavailable" onRetry={retry} />
  </ProcurementWorkspace>)
  expect(view.container.querySelector('[data-toolbar-font]')).toHaveClass('sticky')
  expect(screen.getByRole('heading', { name: 'Tenders' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Tender storage unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledTimes(1)
})

test('uses a disabled shared select rather than a native dropdown', () => {
  const onChange = jest.fn()
  const view = render(<Choice label="Approval mode" value="human" options={['human', 'automatic_ai']} disabled onChange={onChange} />)
  expect(screen.getByRole('combobox', { name: 'Approval mode' })).toBeDisabled()
  expect(view.container.querySelector('select:not([aria-hidden="true"])')).toBeNull()
  expect(onChange).not.toHaveBeenCalled()
})

test('date controls preserve ISO and calendar date values until user chooses to clear', () => {
  const dateOnly = jest.fn(), dateTime = jest.fn()
  const view = render(<><DateOnlyField label="Issue date" value="2026-10-28" onChange={dateOnly} />
    <DateTimeField label="Deadline" value="2026-10-28T12:00:00Z" onChange={dateTime} /></>)
  expect(view.container.querySelector('input[type="date"],input[type="datetime-local"]')).toBeNull()
  expect(dateOnly).not.toHaveBeenCalled()
  expect(dateTime).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Clear Issue date' }))
  fireEvent.click(screen.getByRole('button', { name: 'Clear Deadline' }))
  expect(dateOnly).toHaveBeenCalledWith('')
  expect(dateTime).toHaveBeenCalledWith('')
})