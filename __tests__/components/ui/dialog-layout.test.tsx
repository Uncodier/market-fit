import { fireEvent, render, screen } from '@testing-library/react'
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { DateOnlyField, DateTimeField } from '@/app/purchases/procurement/components/form-fields'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ locale: 'en', t: (key: string) => key }) }))
let mockMobile = false
jest.mock('@/app/hooks/use-mobile-view', () => ({ useIsMobile: () => mockMobile }))
beforeEach(() => { mockMobile = false })

function Editor({ busy = false, onClose = jest.fn(), onSubmit = jest.fn() }) {
  return <Dialog open onOpenChange={onClose}><DialogContent busy={busy} closeLabel="Close editor">
    <DialogForm onSubmit={event => { event.preventDefault(); onSubmit() }}>
      <DialogHeader><DialogTitle>Editor</DialogTitle><DialogDescription>Working document</DialogDescription></DialogHeader>
      <DialogBody><fieldset><DateTimeField label="Deadline" value="2026-11-04T17:24:00Z" disabled={busy} onChange={jest.fn()} /></fieldset></DialogBody>
      <DialogFooter><button type="submit" disabled={busy}>Save draft</button></DialogFooter>
    </DialogForm>
  </DialogContent></Dialog>
}

test('keeps one scroll owner with shrinkable forms and fieldsets', () => {
  render(<Editor />)
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveClass('min-w-0', 'max-h-[min(90dvh,720px)]')
  expect(dialog.querySelector('form')).toHaveClass('min-h-0', 'min-w-0', 'overflow-hidden')
  expect(dialog.querySelector('[data-slot="dialog-body"]')).toHaveClass('overflow-y-auto', 'min-w-0', '[&_fieldset]:min-w-0')
  expect(screen.getByRole('button', { name: 'Save draft' }).parentElement).toHaveClass('shrink-0', 'sm:flex-wrap')
})

test('keeps close absolutely positioned despite the global Safari button rule', () => {
  render(<Editor />)
  expect(screen.getByRole('button', { name: 'Close editor' })).toHaveClass('!absolute')
})

test('busy state blocks close button and Escape without submitting', () => {
  const onClose = jest.fn(), onSubmit = jest.fn()
  render(<Editor busy onClose={onClose} onSubmit={onSubmit} />)
  expect(screen.getByRole('button', { name: 'Close editor' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }))
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  expect(onSubmit).not.toHaveBeenCalled()
})

test('normal close and footer submission retain their behavior', () => {
  const onClose = jest.fn(), onSubmit = jest.fn()
  render(<Editor onClose={onClose} onSubmit={onSubmit} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  expect(onSubmit).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }))
  expect(onClose).toHaveBeenCalledWith(false)
})

test('Ctrl+Enter requests submission on the dialog form', () => {
  render(<Editor />)
  const form = screen.getByRole('dialog').querySelector('form')!
  const requestSubmit = jest.spyOn(form, 'requestSubmit').mockImplementation(() => {})
  fireEvent.keyDown(screen.getByLabelText('Deadline'), { key: 'Enter', ctrlKey: true })
  expect(requestSubmit).toHaveBeenCalledTimes(1)
  requestSubmit.mockRestore()
})

test.each([DateOnlyField, DateTimeField])('date controls allocate remaining width and preserve a non-shrinking Clear action', Component => {
  render(<Component label="Date" value={Component === DateOnlyField ? '2026-11-04' : '2026-11-04T17:24:00Z'} onChange={jest.fn()} />)
  const clear = screen.getByRole('button', { name: 'Clear Date' })
  expect(clear).toHaveClass('shrink-0')
  expect(clear.parentElement).toHaveClass('min-w-0')
  expect(clear.previousElementSibling).toHaveClass('min-w-0', 'flex-1')
  expect(screen.getByLabelText('Date')).toHaveClass('min-w-0', 'max-w-full')
})

test('mobile calendar opens as a nested slotted dialog and closing it preserves the editor', () => {
  mockMobile = true
  const onClose = jest.fn()
  render(<Editor onClose={onClose} />)
  fireEvent.click(screen.getByLabelText('Deadline'))
  const calendar = screen.getByRole('dialog', { name: 'datePicker.selectDate' })
  expect(calendar.querySelector('[data-slot="dialog-header"]')).toBeInTheDocument()
  expect(calendar.querySelector('[data-slot="dialog-body"]')).toHaveClass('p-0', 'overflow-y-auto')
  fireEvent.click(calendar.querySelector('[data-slot="dialog-close"]')!)
  expect(screen.queryByRole('dialog', { name: 'datePicker.selectDate' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Editor' })).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})