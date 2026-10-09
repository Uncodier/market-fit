import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BillingHelpTooltip } from '@/app/components/billing/billing-help-tooltip'

const renderHelp = () => render(<BillingHelpTooltip label="Help: Credits">Credits fund third-party services.</BillingHelpTooltip>)

it('keeps secondary copy hidden until requested and opens on touch/click without submitting a form', () => {
  const submit = jest.fn(event => event.preventDefault())
  render(<form onSubmit={submit}><BillingHelpTooltip label="Help: Credits">Credits fund third-party services.</BillingHelpTooltip></form>)
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  const trigger = screen.getByRole('button', { name: 'Help: Credits' })
  expect(trigger).toHaveAttribute('type', 'button')
  fireEvent.pointerDown(trigger, { pointerType: 'touch' })
  fireEvent.click(trigger)
  expect(screen.getByRole('tooltip')).toHaveTextContent('Credits fund third-party services.')
  expect(trigger).toHaveAccessibleDescription('Credits fund third-party services.')
  expect(submit).not.toHaveBeenCalled()
})

it('opens with keyboard focus and dismisses with Escape', async () => {
  renderHelp()
  const trigger = screen.getByRole('button', { name: 'Help: Credits' })
  act(() => trigger.focus())
  expect(screen.getByRole('tooltip')).toBeInTheDocument()
  fireEvent.keyDown(trigger, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
})

it('opens on hover after a short delay', async () => {
  renderHelp()
  fireEvent.pointerMove(screen.getByRole('button', { name: 'Help: Credits' }), { pointerType: 'mouse' })
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Credits fund third-party services.')
})