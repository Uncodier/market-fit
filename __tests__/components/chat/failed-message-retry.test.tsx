import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MessageStatus } from '@/app/components/chat/chat-message-status'
import { ChatMessages } from '@/app/components/chat/ChatMessages'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { chatMessages } from '@/app/context/locale-catalog'
import { getRetryChannelBlockReason } from '@/lib/chat/retry-channel'
import type { ChatMessage } from '@/app/types/chat'

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' } }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'member' } }) }))
jest.mock('@/app/services/user-service', () => ({ getUserData: jest.fn() }))
jest.mock('@/app/components/chat/use-chat-message-actions', () => ({ useChatMessageActions: () => ({}) }))
jest.mock('@/app/components/chat/ChatMessageActionsBar', () => ({ ChatMessageActionsBar: () => null }))
jest.mock('@/app/components/chat/ChatResponseActions', () => ({ ChatResponseActions: () => null }))
jest.mock('@/app/components/chat/chat-message-content', () => ({ ChatMessageContent: () => null }))
jest.mock('@/app/components/chat/PrivateReviewThread', () => ({ PrivateReviewThread: () => null }))

const row: ChatMessage = { id: 'failed-row', role: 'team_member', timestamp: new Date(), text: 'Unchanged',
  metadata: { command_status: 'failed', error_message: 'Arbitrary provider diagnostic' } }
const reason = 'chat.recipient.whatsappPhone'
const blocked = { whatsapp: reason }

it.each(['en', 'es'] as const)('explains a disabled legacy retry in %s and never resends on eligibility change', async locale => {
  const retry = jest.fn()
  function rows(reasons: Readonly<Record<string, string>>) {
    return <LocalizationProvider preferredLocale={locale} preferenceScope="retry-test">
      <ChatMessages agentId="agent" agentName="Agent" conversationId="conversation" chatMessages={[row]}
        conversationChannel="whatsapp" channelBlockReasons={reasons} isLead leadData={{ id: 'lead' }}
        isAgentOnlyConversation={false} isAgentResponding={false} isLoadingMessages={false}
        messagesEndRef={{ current: null }} onRetryMessage={retry} />
    </LocalizationProvider>
  }
  const { rerender } = render(rows(blocked))
  const label = chatMessages[locale]['chat.status.retry']
  const retryButton = () => screen.getByRole('button', { name: label })
  expect(retryButton()).toBeDisabled()
  const trigger = screen.getByRole('group', { name: label })
  expect(trigger).toHaveAttribute('tabindex', '0')
  act(() => trigger.focus())
  expect(await screen.findByRole('tooltip')).toHaveTextContent(chatMessages[locale][reason])
  expect(trigger).toHaveAccessibleDescription(chatMessages[locale][reason])
  act(() => trigger.blur())
  await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  fireEvent.pointerMove(trigger, { pointerType: 'mouse' })
  expect(await screen.findByRole('tooltip')).toHaveTextContent(chatMessages[locale][reason])
  fireEvent.click(retryButton())
  fireEvent.keyDown(trigger, { key: 'Enter' })
  rerender(rows({}))
  expect(retryButton()).toBeEnabled()
  expect(retry).not.toHaveBeenCalled()
  fireEvent.click(retryButton())
  expect(retry).toHaveBeenCalledTimes(1)
  expect(retry).toHaveBeenCalledWith(expect.objectContaining(row))
})

it('uses saved channel evidence, never error prose or a stale conflict as a permanent veto', () => {
  const conflict = { error_code: 'WHATSAPP_RECIPIENT_UNVERIFIED' }
  expect(getRetryChannelBlockReason({ channel: ' WhatsApp ' }, 'web', blocked)).toBe(reason)
  expect(getRetryChannelBlockReason({ channel: 'email' }, 'whatsapp', blocked)).toBe(reason)
  expect(getRetryChannelBlockReason(conflict, 'email', blocked)).toBeUndefined()
  expect(getRetryChannelBlockReason(conflict, null, blocked)).toBe(reason)
  expect(getRetryChannelBlockReason({ ...conflict, channel: 'email' }, null, blocked)).toBeUndefined()
  expect(getRetryChannelBlockReason({ error_message: 'WHATSAPP_RECIPIENT_UNVERIFIED' }, 'email', blocked)).toBeUndefined()
  expect(getRetryChannelBlockReason(conflict, 'whatsapp', {})).toBeUndefined()
  expect(getRetryChannelBlockReason({ ...conflict, response_format: 'text' }, 'whatsapp', { whatsappAudio: reason })).toBeUndefined()
  expect(getRetryChannelBlockReason({ ...conflict, requested_response_format: 'audio' }, 'whatsapp', { whatsappAudio: reason })).toBe(reason)
  expect(getRetryChannelBlockReason({ channel: 'call' }, null, { voice: reason })).toBe(reason)
})

it.each(['attempting', 'pending', 'accepted', 'failed', 'unknown', undefined])(
  'never offers Retry on an owned WhatsApp text receipt (%s)', state => {
    const message = { ...row, metadata: { ...row.metadata, whatsapp_text_delivery: { state } } }
    render(<LocalizationProvider preferredLocale="en"><MessageStatus message={message} onRetry={jest.fn()} /></LocalizationProvider>)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.getByText(chatMessages.en['chat.status.checkDeliveryBeforeRetry'])).toBeInTheDocument()
    expect(screen.queryByText(/audio/i)).not.toBeInTheDocument()
  },
)
