import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LeadRowMenu } from '@/app/leads/components/lead-row-menu'
import { LeadActionsMenu } from '@/app/leads/components/LeadActionsMenu'
import { KanbanView } from '@/app/components/kanban-view'
import { useKanbanView } from '@/app/components/use-kanban-view'
import type { Lead } from '@/app/leads/types'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { sendTeamMemberIntervention } from '@/app/services/chat-send'
import { InterventionRequestError } from '@/app/services/mark-intervention-message-failed'

jest.mock('@/app/leads/components/LeadPaymentDialog', () => ({ LeadPaymentDialog: () => null }))
jest.mock('@/app/leads/components/LeadAutomationSnoozeDialog', () => ({ LeadAutomationSnoozeDialog: () => null }))
jest.mock('@/app/services/chat-send', () => ({ sendTeamMemberIntervention: jest.fn() }))
jest.mock('@/app/components/use-kanban-view', () => ({ useKanbanView: jest.fn() }))
jest.mock('@/app/context/SiteContext', () => ({
  useSite: () => ({ currentSite: { id: '00000000-0000-4000-8000-000000000001', settings: { channels: {
    email: { enabled: true, status: 'connected' }, whatsapp: { enabled: true, status: 'connected' },
  } } } }),
}))

const recipient = { id: '00000000-0000-4000-8000-000000000006', name: 'Test Lead', email: 'lead@example.test',
  phone: null, social_networks: null, origin: null }

const wrapper = ({ children }: { children: ReactNode }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider>

function renderMenu(kind: 'row' | 'card' | 'detail', leadCount = 1) {
  const handlers = { onResearch: jest.fn(), onFollowUp: jest.fn(), onInvalidate: jest.fn(), onEdit: jest.fn(), onConversation: jest.fn() }
  const onClick = jest.fn()
  jest.mocked(useKanbanView).mockReturnValue({
    leadsByStatus: { new: [recipient], contacted: [], qualified: [], cold: [], converted: [], lost: [], not_qualified: [] },
    totalCounts: {}, leadJourneyStages: {}, loadingActions: {}, successActions: {}, assigningLeads: {},
    getJourneyStageName: () => 'Not contacted', getCompanyName: () => '', hasMoreLeads: () => false,
    handleDragEnd: jest.fn(), handleCardClick: onClick,
  } as unknown as ReturnType<typeof useKanbanView>)
  render(<div onClick={onClick}>
    {kind === 'row' ? <LeadRowMenu lead={recipient as Lead} leadCount={leadCount} loading={null} success={null} {...handlers} /> :
      kind === 'detail' ? <LeadActionsMenu lead={recipient} loading={null} {...handlers} /> :
        <KanbanView leads={[recipient as Lead]} segments={[]} onLeadClick={onClick} onUpdateLeadStatus={jest.fn()} />}
  </div>, { wrapper })
  const options = screen.getByRole('button', { name: kind === 'row' ? 'Open actions' : kind === 'detail' ? 'Open menu' : 'Options for Test Lead' })
  if (kind === 'card') expect(options.closest('[data-slot="lead-card-footer"]')).toHaveTextContent('AI Actions')
  expect(screen.queryByRole('button', { name: 'New Message' })).not.toBeInTheDocument()
  fireEvent.keyDown(options, { key: 'Enter' })
  return { options, onClick }
}

beforeEach(() => jest.clearAllMocks())

it.each(['row', 'card', 'detail'] as const)('preselects the %s lead and uses the Chats send helper', async kind => {
  jest.mocked(sendTeamMemberIntervention).mockResolvedValue({ success: true })
  const { options, onClick } = renderMenu(kind)
  fireEvent.click(screen.getByRole('menuitem', { name: 'New Message' }))
  const dialog = screen.getByRole('dialog', { name: 'New Message' })
  expect(dialog).toHaveTextContent('Test Lead · lead@example.test')
  fireEvent.click(dialog)
  expect(onClick).not.toHaveBeenCalled()
  expect(screen.getByText('Via Email')).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'WhatsApp' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Order update' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello' } })
  const send = screen.getByRole('button', { name: 'Send' })
  expect(send.closest('[data-slot="dialog-footer"]')).not.toBeNull()
  fireEvent.click(send)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(options).toHaveFocus())
  expect(sendTeamMemberIntervention).toHaveBeenCalledWith(undefined, 'Hello', undefined, undefined, expect.objectContaining({
    new_lead_message: { lead_id: recipient.id, channel: 'email', subject: 'Order update' },
  }))
})

it('does not show New Message for a group representing several leads', () => {
  renderMenu('row', 2)
  expect(screen.getByRole('menu')).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'New Message' })).not.toBeInTheDocument()
})

it('preselects the lead and preserves the draft while blocking a duplicate send after an ambiguous result', async () => {
  const conversationId = '00000000-0000-4000-8000-000000000007'
  jest.mocked(sendTeamMemberIntervention).mockRejectedValue(new InterventionRequestError('Delivery could not be confirmed.', { conversation_id: conversationId }))
  renderMenu('row')
  fireEvent.click(screen.getByRole('menuitem', { name: 'New Message' }))
  expect(screen.queryByLabelText('To')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Order update' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Keep this draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Delivery could not be confirmed.')
  expect(screen.getByLabelText('Message')).toHaveValue('Keep this draft')
  expect(screen.getByRole('link', { name: 'Open conversation' })).toHaveAttribute('href', `/chat?conversationId=${conversationId}`)
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
})