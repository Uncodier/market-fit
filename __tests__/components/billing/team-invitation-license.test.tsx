import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import TeamInvitationPage from '@/app/auth/team-invitation/page'
import { processTeamInvitation } from '@/app/services/magic-link-invitation-service'
import { BillingUpgradeRequired, type BillingLimitPayload } from '@/lib/billing-limit-errors'
import { toast } from 'sonner'

const push = jest.fn()
const params = new URLSearchParams({ siteId: '11111111-1111-4111-8111-111111111111', siteName: 'Invited site', role: 'collaborator' })
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => params }))
jest.mock('@/app/services/magic-link-invitation-service', () => ({ processTeamInvitation: jest.fn() }))
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
const process = jest.mocked(processTeamInvitation)
const payload: BillingLimitPayload = { kind: 'members', siteId: params.get('siteId')!, current: 5, limit: 5, requiredPlan: 'foundry', canUpgrade: false }

describe('invitation acceptance license gate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.mockResolvedValue({ success: false, upgradeRequired: payload })
  })

  it('renders a local upgrade dialog on 402 without Invitation Error or toast and only retries explicitly', async () => {
    const { rerender } = render(<TeamInvitationPage />)
    await screen.findByRole('alertdialog')
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/Ask the site owner to upgrade/)
    expect(screen.queryByText('Invitation Error')).not.toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(process).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    rerender(<TeamInvitationPage />)
    expect(process).toHaveBeenCalledTimes(1)
    process.mockResolvedValue({ success: true })
    fireEvent.click(screen.getByRole('button', { name: 'Retry after upgrade' }))
    await screen.findByText('Welcome to the team!')
    expect(process).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Invitation Error')).not.toBeInTheDocument()
  })

  it('also handles typed upgrade errors without treating acceptance as a generic failure', async () => {
    process.mockRejectedValue(new BillingUpgradeRequired(payload))
    render(<TeamInvitationPage />)
    await screen.findByRole('alertdialog')
    expect(screen.queryByText('Invitation Error')).not.toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Upgrade plan' })).not.toBeInTheDocument()
  })

  it('requires a user retry after owner upgrade and guards repeated retry clicks while processing', async () => {
    render(<TeamInvitationPage />)
    await screen.findByRole('alertdialog')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    let complete!: (value: Awaited<ReturnType<typeof processTeamInvitation>>) => void
    process.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry after upgrade' }))
    await waitFor(() => expect(process).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: 'Retry after upgrade' })).not.toBeInTheDocument()
    complete({ success: false, upgradeRequired: payload })
    await screen.findByRole('alertdialog')
    expect(process).toHaveBeenCalledTimes(2)
  })
})