import type { ReactNode } from 'react'
import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChatInput } from '@/app/components/chat/ChatInput'
import { ChannelSelector } from '@/app/components/chat/ChannelSelector'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { chatMessages } from '@/app/context/locale-catalog'
import { useChannelSelector } from '@/app/hooks/useChannelSelector'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/hooks/useChannelSelector', () => ({ useChannelSelector: jest.fn() }))

const messages = chatMessages.es
const phoneReason = 'chat.recipient.whatsappPhone'
const blockReasons = { whatsapp: phoneReason, voice: 'chat.recipient.internationalPhone' }
function wrapper({ children }: { children: ReactNode }) {
  return <LocalizationProvider preferredLocale="es">{children}</LocalizationProvider>
}
function setup(selectedChannel: string, availableChannels: string[], displayChannels = availableChannels) {
  const state = { selectedChannel, availableChannels, displayChannels, setSelectedChannel: jest.fn() }
  jest.mocked(useChannelSelector).mockReturnValue(state)
  return { state, props: { conversationId: 'conversation', isLoading: false, setMessage: jest.fn(),
    handleKeyDown: jest.fn(), handleSendMessage: jest.fn().mockResolvedValue(undefined) } }
}

it('explains blocked sends using the active locale on focus and hover, without losing the draft', async () => {
  const { props } = setup('whatsapp', ['web'], ['web', 'whatsapp'])
  render(<ChatInput {...props} channelBlockReasons={blockReasons} />, { wrapper })
  expect(useChannelSelector).toHaveBeenCalledWith(expect.objectContaining({ channelBlockReasons: blockReasons }))
  const textarea = screen.getByRole('textbox')
  fireEvent.change(textarea, { target: { value: 'Original draft' } })
  const send = screen.getByRole('button', { name: messages['chat.input.send'] })
  const trigger = screen.getByRole('group', { name: messages['chat.input.send'] })
  expect(send).toBeDisabled()
  expect(trigger).toHaveAttribute('tabindex', '0')
  act(() => trigger.focus())
  expect(await screen.findByRole('tooltip')).toHaveTextContent(messages[phoneReason])
  expect(trigger).toHaveAccessibleDescription(messages[phoneReason])
  act(() => trigger.blur())
  fireEvent.pointerMove(trigger, { pointerType: 'mouse' })
  expect(await screen.findByRole('tooltip')).toHaveTextContent(messages[phoneReason])
  fireEvent.click(send)
  const enter = createEvent.keyDown(textarea, { key: 'Enter', cancelable: true })
  fireEvent(textarea, enter)
  expect(enter.defaultPrevented).toBe(true)
  fireEvent.submit(textarea.closest('form')!)
  expect(props.handleSendMessage).not.toHaveBeenCalled()
  expect(props.handleKeyDown).not.toHaveBeenCalled()
  expect(textarea).toHaveValue('Original draft')
})

it('shows the historical inactive selector and keeps an enabled alternative selectable', () => {
  const { props, state } = setup('telegram', ['web'], ['web'])
  render(<ChatInput {...props} />, { wrapper })
  const unavailable = screen.getByRole('tab', { name: 'Telegram' })
  expect(unavailable).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('status')).toHaveTextContent(messages['chat.input.channelUnavailable'])
  fireEvent.mouseDown(unavailable, { button: 0 })
  fireEvent.keyDown(unavailable, { key: 'Enter' })
  expect(state.setSelectedChannel).not.toHaveBeenCalled()
  fireEvent.mouseDown(screen.getByRole('tab', { name: messages['chat.channel.web'] }), { button: 0 })
  expect(state.setSelectedChannel).toHaveBeenCalledWith('web')
})

it('shows a disabled selector even when it is the only channel and explains it on hover and focus', async () => {
  const change = jest.fn()
  render(<ChannelSelector selectedChannel="whatsapp" availableChannels={['whatsapp']} onChannelChange={change}
    channelBlockReasons={blockReasons} />, { wrapper })
  const tab = screen.getByRole('tab', { name: 'WhatsApp' })
  expect(tab).toHaveAttribute('aria-disabled', 'true')
  fireEvent.pointerMove(tab, { pointerType: 'mouse' })
  expect(await screen.findByRole('tooltip')).toHaveTextContent(messages[phoneReason])
  fireEvent.keyDown(document, { key: 'Escape' })
  act(() => tab.focus())
  expect(tab).toHaveFocus()
  expect(await screen.findByRole('tooltip')).toHaveTextContent(messages[phoneReason])
  expect(tab).toHaveAccessibleDescription(messages[phoneReason])
  fireEvent.keyDown(tab, { key: 'Enter' })
  fireEvent.keyDown(tab, { key: ' ' })
  fireEvent.mouseDown(tab, { button: 0 })
  expect(change).not.toHaveBeenCalled()
})

it('does not switch to an invalid nonselected channel on focus, key activation or mouse down', async () => {
  const { state, props } = setup('web', ['web', 'email'], ['web', 'email', 'whatsapp'])
  render(<ChatInput {...props} channelBlockReasons={blockReasons} />, { wrapper })
  const web = screen.getByRole('tab', { name: messages['chat.channel.web'] })
  const blocked = screen.getByRole('tab', { name: 'WhatsApp' })
  act(() => web.focus())
  fireEvent.keyDown(web, { key: 'ArrowLeft' })
  expect(await screen.findByRole('tooltip', { name: messages[phoneReason] })).toBeInTheDocument()
  expect(blocked).toHaveFocus()
  fireEvent.keyDown(blocked, { key: 'Enter' })
  fireEvent.keyDown(blocked, { key: ' ' })
  fireEvent.mouseDown(blocked, { button: 0 })
  expect(state.setSelectedChannel).not.toHaveBeenCalled()
  fireEvent.keyDown(blocked, { key: 'ArrowLeft' })
  await waitFor(() => expect(state.setSelectedChannel).toHaveBeenCalledWith('email'))
})

it('honors a recipient block even when the legacy voice preflight accepts the lead', () => {
  const { props } = setup('voice', ['voice'])
  render(<ChatInput {...props} message="Opening greeting" channelBlockReasons={blockReasons}
    leadData={{ id: 'lead', phone: '+12025550123' }} />, { wrapper })
  expect(screen.getByRole('button', { name: messages['chat.input.startCall'] })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent(messages['chat.recipient.internationalPhone'])
})

it('reacts to recipient changes without discarding the draft or blocking unrelated delivery modes', () => {
  const { props } = setup('whatsapp', ['web', 'whatsapp'])
  const { rerender } = render(<ChatInput {...props} />, { wrapper })
  const textarea = screen.getByRole('textbox')
  fireEvent.change(textarea, { target: { value: 'Keep this' } })
  const send = () => screen.getByRole('button', { name: messages['chat.input.send'] })
  expect(send()).toBeEnabled()
  rerender(<ChatInput {...props} channelBlockReasons={blockReasons} />)
  expect(send()).toBeDisabled()
  rerender(<ChatInput {...props} channelBlockReasons={{ voice: 'chat.recipient.internationalPhone' }} />)
  expect(send()).toBeEnabled()
  rerender(<ChatInput {...props} isAgentOnlyConversation channelBlockReasons={blockReasons} />)
  fireEvent.click(send())
  const target = { id: 'comment', role: 'user' as const, text: 'Hi', timestamp: new Date() }
  rerender(<ChatInput {...props} channelBlockReasons={blockReasons}
    commentReplySelection={{ options: [target], target, select: jest.fn() }} />)
  fireEvent.click(screen.getByRole('button', { name: messages['chat.input.replyPublicly'] }))
  expect(props.handleSendMessage).toHaveBeenCalledTimes(2)
  expect(textarea).toHaveValue('Keep this')
})

it('passes the current committed-channel callback to the hook when only that callback changes', () => {
  const { props } = setup('web', ['web'])
  const first = jest.fn(), next = jest.fn()
  const { rerender } = render(<ChatInput {...props} onChannelCommitted={first} />, { wrapper })
  expect(useChannelSelector).toHaveBeenLastCalledWith(expect.objectContaining({ onChannelCommitted: first }))
  rerender(<ChatInput {...props} onChannelCommitted={next} />)
  expect(useChannelSelector).toHaveBeenLastCalledWith(expect.objectContaining({ onChannelCommitted: next }))
})
