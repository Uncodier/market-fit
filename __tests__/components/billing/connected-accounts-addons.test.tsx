import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ConnectedAccountsAddons } from '@/app/components/billing/connected-accounts-addons'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))

const props = {
  totalSocialAccounts: 1, totalAgentChannels: 0, socialLimit: 1, agentLimit: 0,
  addonsCount: 0, requiredAddons: 0, missingAddons: 0,
  socialUsagePercentage: 100, agentUsagePercentage: 0, isSaving: false,
  onManageAddons: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

it('offers add-ons with free plan limits without requiring an upgrade', () => {
  render(<ConnectedAccountsAddons {...props} />)
  expect(screen.queryByText(/unavailable on free plan|upgrade to a paid subscription/i)).not.toBeInTheDocument()
  expect(screen.getByText('$10.00/month')).toBeVisible()
  expect(screen.queryByText(/Each add-on costs/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add one add-on' }))
  expect(screen.getByText('Selected add-ons: 1')).toBeInTheDocument()
  expect(props.onManageAddons).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }))
  expect(props.onManageAddons).toHaveBeenCalledWith(1)
})

it('can undo a selection on free without starting a charge', () => {
  render(<ConnectedAccountsAddons {...props} />)
  expect(screen.getByRole('button', { name: 'Remove one add-on' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Add one add-on' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove one add-on' }))
  expect(screen.getByRole('button', { name: 'Confirm change' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(props.onManageAddons).not.toHaveBeenCalled()
})

it('displays annual addon pricing on free and requires confirmation', () => {
  render(<ConnectedAccountsAddons {...props} billingInterval="year" />)
  expect(screen.getByText('$108.00/year')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Add one add-on' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(props.onManageAddons).not.toHaveBeenCalled()
})

it('never selects fewer add-ons than connections require or exceeds the maximum', () => {
  const { rerender } = render(<ConnectedAccountsAddons {...props} addonsCount={2} requiredAddons={1} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remove one add-on' }))
  expect(screen.getByRole('button', { name: 'Remove one add-on' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }))
  expect(props.onManageAddons).toHaveBeenCalledWith(1)
  rerender(<ConnectedAccountsAddons {...props} addonsCount={99} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add one add-on' }))
  expect(screen.getByRole('button', { name: 'Add one add-on' })).toBeDisabled()
})

it('disables changes during payment preparation regardless of plan', () => {
  render(<ConnectedAccountsAddons {...props} isSaving />)
  expect(screen.getByRole('button', { name: 'Add one add-on' })).toBeDisabled()
})

it('keeps the selected recurring total and payment consequences visible with actions in the footer', () => {
  render(<ConnectedAccountsAddons {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add one add-on' }))
  expect(screen.getByRole('status')).toHaveTextContent('$10.00/month total')
  const confirm = screen.getByRole('button', { name: 'Confirm change' })
  expect(confirm).toHaveAccessibleDescription(/billed now.*payment is confirmed/)
  expect(screen.getByTestId('addons-footer')).toContainElement(confirm)
  expect(screen.getByTestId('addons-footer')).toContainElement(screen.getByRole('button', { name: 'Cancel' }))
})

it('shows the renewal notice on reductions and keeps missing-capacity warnings outside help', () => {
  render(<ConnectedAccountsAddons {...props} addonsCount={2} requiredAddons={1} missingAddons={1} />)
  expect(screen.getByRole('alert')).toHaveTextContent('You still need 1 more')
  fireEvent.click(screen.getByRole('button', { name: 'Remove one add-on' }))
  expect(screen.getByRole('button', { name: 'Confirm change' })).toHaveAccessibleDescription(/next renewal/)
})

it('provides named usage bars and clamps their visual and accessible percentages', () => {
  render(<ConnectedAccountsAddons {...props} socialUsagePercentage={150} agentUsagePercentage={-10} />)
  const social = screen.getByRole('progressbar', { name: 'Social Accounts' })
  const agent = screen.getByRole('progressbar', { name: 'Agent Channels (Zavu)' })
  expect(social).toHaveAttribute('aria-valuenow', '100')
  expect(social.firstElementChild).toHaveStyle({ width: '100%' })
  expect(agent).toHaveAttribute('aria-valuenow', '0')
  expect(agent.firstElementChild).toHaveStyle({ width: '0%' })
})