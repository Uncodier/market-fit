import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { LocalizationProvider, useLocalization, type SupportedLocale } from '@/app/context/LocalizationContext'
import { chatMessages, rawLocaleMessages } from '@/app/context/locale-catalog'
import { ChatInput } from '@/app/components/chat/ChatInput'
import { ChannelSelector } from '@/app/components/chat/ChannelSelector'
import { MessageStatus, MessageTimestamp, formatDate } from '@/app/components/chat/chat-message-status'
import { useChannelSelector } from '@/app/hooks/useChannelSelector'
import { getTemplateDeliveryStatus } from '@/lib/chat/template-delivery'
import { isDeliveryRetryBlocked } from '@/lib/chat/response-format'
import type { ChatMessage } from '@/app/types/chat'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/hooks/useChannelSelector', () => ({ useChannelSelector: jest.fn() }))

const locales: SupportedLocale[] = ['en', 'es', 'fr', 'de', 'ja']
const templateKeys: Record<string, string> = {
  pending: 'pendingApproval', ready: 'ready', accepted: 'accepted', dispatching: 'sending',
  read: 'read', delivered: 'delivered', rejected: 'failed', unknown: 'unconfirmed',
}

function provider(locale: SupportedLocale, children: ReactNode) {
  return <LocalizationProvider preferenceScope="chat-localization-test" preferredLocale={locale}>{children}</LocalizationProvider>
}

function templateMessage(state: string): ChatMessage {
  return { role: 'team_member', text: 'Customer content', timestamp: new Date('2020-01-02T15:04:00Z'),
    metadata: { delivery_format: 'template', response_format: 'audio', template_delivery: { state }, command_status: 'failed' } }
}

it('registers complete own-language chat catalogs with matching interpolation tokens', () => {
  const keys = Object.keys(chatMessages.en).sort()
  for (const locale of locales) {
    expect(Object.keys(chatMessages[locale]).sort()).toEqual(keys)
    for (const key of keys) {
      expect(rawLocaleMessages[locale][key]).toBe(chatMessages[locale][key])
      expect(chatMessages[locale][key].trim()).not.toBe('')
      expect(chatMessages[locale][key].match(/\{\{\w+\}\}/g) ?? [])
        .toEqual(chatMessages.en[key].match(/\{\{\w+\}\}/g) ?? [])
    }
  }
})

it.each(locales)('translates composer hints, selectors, placeholders and actions in %s without changing format values', locale => {
  const send = jest.fn().mockResolvedValue(undefined)
  const changeChannel = jest.fn()
  jest.mocked(useChannelSelector).mockReturnValue({ selectedChannel: 'whatsapp', setSelectedChannel: changeChannel,
    availableChannels: ['whatsapp', 'email'], isUpdatingChannel: false })
  render(provider(locale, <ChatInput conversationId="conversation" setMessage={jest.fn()} isLoading={false}
    handleSendMessage={send} handleKeyDown={jest.fn()} />))
  const messages = chatMessages[locale]
  const textarea = screen.getByPlaceholderText(messages['chat.input.placeholder'])
  expect(screen.getByRole('status')).toHaveTextContent(messages['chat.input.interventionHint'])
  expect(screen.getByRole('group', { name: messages['chat.responseFormat.label'] })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: messages['chat.responseFormat.audio'] }))
  expect(screen.getByText(messages['chat.input.whatsappAudioHint'])).toBeInTheDocument()
  fireEvent.change(textarea, { target: { value: 'Original customer draft.mp3' } })
  fireEvent.click(screen.getByRole('button', { name: messages['chat.input.send'] }))
  expect(send).toHaveBeenCalledWith(expect.anything(), 'audio')
  expect(textarea).toHaveValue('Original customer draft.mp3')
  expect(changeChannel).not.toHaveBeenCalled()
})

it.each(locales)('translates channel accessible names in %s while preserving channel IDs', locale => {
  const change = jest.fn()
  render(provider(locale, <ChannelSelector selectedChannel="email" availableChannels={['email', 'voice']}
    onChannelChange={change} />))
  fireEvent.mouseDown(screen.getByRole('tab', { name: chatMessages[locale]['chat.channel.voice'] }), { button: 0 })
  expect(change).toHaveBeenCalledWith('voice')
})

it.each(locales)('translates safe delivery hints and channel retry in %s', locale => {
  const retry = jest.fn()
  const send = jest.fn()
  const callbacks = { conversationId: 'conversation', setMessage: jest.fn(), isLoading: false,
    handleSendMessage: send, handleKeyDown: jest.fn() }
  jest.mocked(useChannelSelector).mockReturnValue({ selectedChannel: 'email', setSelectedChannel: jest.fn(),
    availableChannels: ['email'], isUpdatingChannel: false })
  const { rerender } = render(provider(locale, <ChatInput {...callbacks} isAgentOnlyConversation />))
  const messages = chatMessages[locale]
  expect(screen.getByRole('status')).toHaveTextContent(messages['chat.input.internalHint'])
  rerender(provider(locale, <ChatInput {...callbacks} commentReplySelection={{ options: [], target: undefined, select: jest.fn() }} />))
  expect(screen.getByRole('status')).toHaveTextContent(messages['chat.input.noCommentHint'])
  rerender(provider(locale, <ChatInput {...callbacks} isConversationReady={false} />))
  expect(screen.getByRole('status')).toHaveTextContent(messages['chat.input.loadingSettings'])
  jest.mocked(useChannelSelector).mockReturnValue({ selectedChannel: 'email', setSelectedChannel: jest.fn(),
    availableChannels: ['email'], isUpdatingChannel: true, channelLoadError: 'Canonical hook error', retryChannelLoad: retry })
  rerender(provider(locale, <ChatInput {...callbacks} />))
  expect(screen.getByRole('alert')).toHaveTextContent(messages['chat.input.channelLoadError'])
  fireEvent.click(screen.getByRole('button', { name: messages['chat.input.retryChannel'] }))
  expect(retry).toHaveBeenCalledTimes(1)
  expect(send).not.toHaveBeenCalled()
})

it.each(locales)('translates template receipt presentation in %s without changing retry/command logic', locale => {
  const retry = jest.fn()
  const { rerender } = render(provider(locale, <MessageStatus message={templateMessage('pending')} onRetry={retry} />))
  for (const [state, key] of Object.entries(templateKeys)) {
    const message = templateMessage(state)
    const before = JSON.stringify(message.metadata)
    rerender(provider(locale, <MessageStatus message={message} onRetry={retry} />))
    expect(screen.getByRole('status')).toHaveTextContent(chatMessages[locale][`chat.template.${key}`])
    expect(getTemplateDeliveryStatus(message.metadata)?.label).toBe(chatMessages.en[`chat.template.${key}`])
    expect(isDeliveryRetryBlocked(message.metadata)).toBe(true)
    expect(JSON.stringify(message.metadata)).toBe(before)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  }
  expect(retry).not.toHaveBeenCalled()
})

it.each(locales)('formats timestamps and date separators using %s', locale => {
  const message = templateMessage('read')
  const date = new Date(message.timestamp)
  const { container } = render(provider(locale, <MessageTimestamp message={message} forceShowDate />))
  expect(container.textContent).toContain(date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }))
  expect(container.textContent).toContain(date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }))
  expect(screen.getByLabelText(chatMessages[locale]['chat.template.read'])).toBeInTheDocument()
  expect(formatDate(date, locale)).toBe(date.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' }))
})

function LocaleSwitch() {
  const { setLocale } = useLocalization()
  return <button onClick={() => setLocale('es')}>Switch locale</button>
}

it('updates a failed message immediately on locale switching without retrying delivery', () => {
  const retry = jest.fn()
  const message: ChatMessage = { role: 'team_member', text: 'Keep this text', timestamp: new Date(), metadata: { command_status: 'failed' } }
  render(provider('en', <><LocaleSwitch /><MessageStatus message={message} onRetry={retry} /></>))
  expect(screen.getByText('Failed to send')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Switch locale' }))
  expect(screen.getByText('Error al enviar')).toBeInTheDocument()
  expect(screen.queryByText('Failed to send')).not.toBeInTheDocument()
  expect(retry).not.toHaveBeenCalled()
})