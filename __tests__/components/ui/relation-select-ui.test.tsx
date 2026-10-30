import { fireEvent, render, screen } from '@testing-library/react'
import { RelationSelect } from '@/app/components/ui/relation-select'
import { Dialog, DialogContent, DialogTitle, DialogBody } from '@/app/components/ui/dialog'

const options = [{ id: 'supplier', label: 'Approved supplier' }]
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })

test('associates its label and selects a portaled option without closing the parent dialog', () => {
  const onClose = jest.fn(), onValueChange = jest.fn()
  render(<Dialog open onOpenChange={onClose}><DialogContent aria-describedby={undefined}>
    <DialogTitle>Working tender</DialogTitle><DialogBody>
      <RelationSelect label="Supplier" options={options} value={null} onValueChange={onValueChange} allowCreate={false} />
    </DialogBody>
  </DialogContent></Dialog>)
  fireEvent.click(screen.getByLabelText('Supplier'))
  fireEvent.click(screen.getByText('Approved supplier'))
  expect(onValueChange).toHaveBeenCalledWith({ mode: 'existing', ...options[0] })
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: 'Working tender' })).toBeInTheDocument()
})

test('closes an open selector when disabled and does not reopen it when reenabled', () => {
  const onValueChange = jest.fn()
  const props = { options, value: null, onValueChange, allowCreate: false, label: 'Supplier' }
  const view = render(<RelationSelect {...props} />)
  fireEvent.click(screen.getByLabelText('Supplier'))
  expect(screen.getByText('Approved supplier')).toBeInTheDocument()
  view.rerender(<RelationSelect {...props} disabled />)
  expect(screen.queryByText('Approved supplier')).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByLabelText('Supplier'), { key: 'Enter' })
  expect(onValueChange).not.toHaveBeenCalled()
  view.rerender(<RelationSelect {...props} />)
  expect(screen.queryByText('Approved supplier')).not.toBeInTheDocument()
})

test('keeps icon actions outside Safari input-plus-div layout overrides', () => {
  render(<RelationSelect label="Supplier" options={options} value={{ mode: 'existing', ...options[0] }} onValueChange={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Clear selection' }).parentElement?.tagName).toBe('SPAN')
  expect(screen.getByLabelText('Supplier').parentElement?.querySelector('input + div')).toBeNull()
})