import { fireEvent, render, screen } from '@testing-library/react'
import { RelationSelect } from '@/app/components/ui/relation-select'
import { Dialog, DialogContent, DialogTitle, DialogBody } from '@/app/components/ui/dialog'

const options = [{ id: 'supplier', label: 'Approved supplier' }]
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })

test('shows disabled options but never selects them by click or Enter', () => {
  const onValueChange = jest.fn()
  render(<RelationSelect label="Order" options={[{ id: 'pending', label: 'Table 1', disabled: true }]}
    value={null} onValueChange={onValueChange} allowCreate={false} />)
  fireEvent.click(screen.getByLabelText('Order'))
  fireEvent.click(screen.getByText('Table 1'))
  expect(screen.getByText('Table 1').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true')
  fireEvent.change(screen.getByLabelText('Order'), { target: { value: 'Table 1' } })
  fireEvent.keyDown(screen.getByLabelText('Order'), { key: 'Enter' })
  expect(onValueChange).not.toHaveBeenCalled()
})

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

test('marks a listbox option as selected only for a matching existing value', () => {
  const props = { options, label: 'Supplier', onValueChange: jest.fn(), openOnFocus: true }
  const view = render(<RelationSelect {...props} value={{ mode: 'create', label: options[0].label }} />)
  fireEvent.focus(screen.getByRole('combobox', { name: 'Supplier' }))
  expect(screen.getByRole('option', { name: 'Approved supplier', selected: false })).toBeInTheDocument()

  view.rerender(<RelationSelect {...props} value={{ mode: 'existing', ...options[0] }} />)
  expect(screen.getByRole('option', { name: 'Approved supplier', selected: true })).toBeInTheDocument()
})

test('renders an avatar instead of selected text until the member picker is opened', () => {
  const onValueChange = jest.fn()
  const member = { id: 'one', label: 'Alex Member' }
  render(<RelationSelect label="Assignee" options={[member, { id: 'two', label: 'Jordan Member' }]}
    value={{ mode: 'existing', ...member }} onValueChange={onValueChange} allowCreate={false}
    selectedAdornment={<span role="img" aria-label={member.label}>AM</span>} />)
  const input = screen.getByRole('textbox', { name: 'Assignee' })
  expect(input).toHaveValue('')
  expect(screen.getByRole('img', { name: member.label })).toBeVisible()
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onValueChange).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: 'Jordan' } })
  fireEvent.click(screen.getByText('Jordan Member'))
  expect(onValueChange).toHaveBeenCalledWith({ mode: 'existing', id: 'two', label: 'Jordan Member' })
})