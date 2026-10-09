import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { BillingDetailsFields } from '@/app/components/billing/billing-details-fields'
import { Form } from '@/app/components/ui/form'
import type { BillingFormValues } from '@/app/components/billing/billing-form'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => null }))
jest.mock('@/app/components/ui/use-btn-glass-motion', () => ({ useBtnGlassMotion: () => () => undefined }))

const saveTax = jest.fn()
const saveAddress = jest.fn()

function Details({ saving = false }: { saving?: boolean }) {
  const form = useForm<BillingFormValues>({ defaultValues: {
    tax_id: '', billing_address: '', billing_city: '', billing_postal_code: '', billing_country: '',
  } })
  return <Form {...form}>
    <BillingDetailsFields handleSaveTaxId={saveTax} handleSaveBillingAddress={saveAddress}
      isSavingTaxId={saving} isSavingBillingAddress={saving} />
  </Form>
}

beforeEach(() => jest.clearAllMocks())

it('associates every label with its actual input and preserves browser autofill', () => {
  render(<Details />)
  for (const [label, autocomplete] of [
    ['Street Address', 'street-address'], ['City', 'address-level2'],
    ['Postal Code', 'postal-code'], ['Country', 'country-name'],
  ]) {
    const input = screen.getByRole('textbox', { name: label })
    expect(screen.getByLabelText(label)).toBe(input)
    expect(input).toHaveAttribute('autocomplete', autocomplete)
    expect(input).toHaveClass('h-10')
  }
  expect(screen.getByLabelText('Tax ID')).toBe(screen.getByRole('textbox', { name: 'Tax ID' }))
})

it('keeps Save actions in separate bordered card footers and saves only the requested section', () => {
  const { container } = render(<Details />)
  const tax = container.querySelector('#tax-id') as HTMLElement
  const address = container.querySelector('#billing-address') as HTMLElement
  const taxSave = within(tax).getByRole('button', { name: 'Save' })
  const addressSave = within(address).getByRole('button', { name: 'Save' })
  for (const button of [taxSave, addressSave]) {
    expect(button).toHaveAttribute('type', 'button')
    expect(button.parentElement).toHaveClass('border-t')
  }
  fireEvent.change(screen.getByRole('textbox', { name: 'Tax ID' }), { target: { value: 'VAT123' } })
  fireEvent.click(taxSave)
  expect(saveTax).toHaveBeenCalledTimes(1)
  expect(saveAddress).not.toHaveBeenCalled()
  fireEvent.click(addressSave)
  expect(saveAddress).toHaveBeenCalledTimes(1)
})

it('disables section actions while saving', () => {
  render(<Details saving />)
  expect(screen.getAllByRole('button', { name: 'Saving...' })).toHaveLength(2)
  for (const button of screen.getAllByRole('button', { name: 'Saving...' })) expect(button).toBeDisabled()
})