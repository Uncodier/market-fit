import { act, fireEvent, render, screen } from '@testing-library/react'
import { RuleInlineField } from '@/app/purchases/procurement/replenishment/inline-field'
import type { ReplenishmentRule } from '@/app/purchases/procurement/replenishment/schema'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
const rule: ReplenishmentRule = { id: 'rule', version: 3, name: 'Paper', catalog_item_id: '33333333-3333-4333-8333-333333333333',
  location_id: '44444444-4444-4444-8444-444444444444', minimum: 10, target: 40, minimum_order: 1, order_multiple: 1, action: 'draft', enabled: true }

test('guards duplicate acceptance and cannot cancel an in-flight save', async () => {
  let finish!: () => void
  const onSave = jest.fn(() => new Promise<void>(resolve => { finish = resolve }))
  render(<RuleInlineField rule={rule} field="name" label="Rule name" display="Paper" disabled={false} onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit Rule name' }))
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'New paper' } })
  fireEvent.keyDown(screen.getByLabelText('Rule name'), { key: 'Enter' })
  fireEvent.keyDown(screen.getByLabelText('Rule name'), { key: 'Enter' })
  fireEvent.keyDown(screen.getByLabelText('Rule name'), { key: 'Escape' })
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(onSave).toHaveBeenCalledWith('name', 'New paper', 3)
  expect(screen.getByRole('button', { name: 'Cancel Rule name edit' })).toBeDisabled()
  await act(async () => { finish() })
  expect(screen.queryByLabelText('Rule name')).not.toBeInTheDocument()
})

test.each(['minimum_order', 'order_multiple'] as const)('rejects fractional %s and blank numeric input', field => {
  render(<RuleInlineField rule={rule} field={field} label="Quantity" display="1" disabled={false} onSave={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit Quantity' }))
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1.5' } })
  expect(screen.getByRole('button', { name: 'Save Quantity' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '' } })
  expect(screen.getByRole('button', { name: 'Save Quantity' })).toBeDisabled()
})

test.each(['action', 'enabled'] as const)('opens %s select with explicit acceptance, not auto-save', field => {
  const onSave = jest.fn()
  render(<RuleInlineField rule={rule} field={field} label="Setting" display="Value" disabled={false} onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit Setting' }))
  expect(screen.getByRole('combobox', { name: 'Setting' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save Setting' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Setting edit' }))
  expect(onSave).not.toHaveBeenCalled()
})

test('read-only demo fields never open or save', () => {
  const onSave = jest.fn()
  render(<RuleInlineField rule={rule} field="name" label="Rule name" display="Paper" disabled onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit Rule name' }))
  expect(screen.queryByLabelText('Rule name')).not.toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()
})