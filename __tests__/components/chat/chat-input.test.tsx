import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChatInput } from '@/app/components/chat/ChatInput'
import { useChannelSelector } from '@/app/hooks/useChannelSelector'
import { useCommentReplySelection } from '@/app/hooks/useCommentReplySelection'
import type { ChatMessage } from '@/app/types/chat'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/hooks/useChannelSelector', () => ({ useChannelSelector: jest.fn() }))
jest.mock('@/app/components/chat/ChannelSelector', () => ({ ChannelSelector: () => null }))

function channelState(isUpdatingChannel = false): ReturnType<typeof useChannelSelector> {
  return {
    selectedChannel: 'call', setSelectedChannel: jest.fn(), availableChannels: ['call'],
    isUpdatingChannel,
  }
}

function props() {
  return {
    setMessage: jest.fn(), isLoading: false,
    handleSendMessage: jest.fn().mockResolvedValue(undefined), handleKeyDown: jest.fn(),
    conversationId: 'conversation-1',
  }
}

const consentedLead = {
  id: 'lead-1', phone: '+12025550123', do_not_call: false,
  voice_call_consent_status: 'granted', voice_call_consent_at: '2026-01-01T00:00:00Z',
}

const commentMetadata = {
  source: 'comment', outstand_post_id: 'post-a', platform_comment_id: 'provider-comment',
  network: 'instagram', publisher_account_id: 'account-a', post_title: 'Summer collection',
  publisher_username: 'our-store',
}
const firstComment: ChatMessage = {
  id: '10000000-0000-4000-8000-000000000001', role: 'user', text: 'Which size?',
  timestamp: new Date('2026-10-01T10:00:00Z'), metadata: commentMetadata,
}
const latestComment: ChatMessage = {
  ...firstComment, id: '10000000-0000-4000-8000-000000000002', text: 'Is it available?',
  timestamp: new Date('2026-10-01T11:00:00Z'),
}

function CommentComposer({ callbacks }: { callbacks: ReturnType<typeof props> }) {
  const selection = useCommentReplySelection(callbacks.conversationId, 'site', commentMetadata, [latestComment, firstComment])
  return <ChatInput {...callbacks} commentReplySelection={selection} />
}

describe('ChatInput send guards', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() })
  })
  afterAll(() => { Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView') })
  beforeEach(() => { jest.mocked(useChannelSelector).mockReturnValue(channelState()) })

  it('blocks Enter and native form submission during channel update without inserting a newline', () => {
    jest.mocked(useChannelSelector).mockReturnValue(channelState(true))
    const callbacks = props()
    render(<ChatInput {...callbacks} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Keep this draft' } })
    const enter = createEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', cancelable: true })
    fireEvent(textarea, enter)
    fireEvent.submit(textarea.closest('form')!)

    expect(enter.defaultPrevented).toBe(true)
    expect(callbacks.handleKeyDown).not.toHaveBeenCalled()
    expect(callbacks.handleSendMessage).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(textarea).toHaveValue('Keep this draft')
  })

  it('still permits Shift+Enter while a channel update is in progress', () => {
    jest.mocked(useChannelSelector).mockReturnValue(channelState(true))
    const callbacks = props()
    render(<ChatInput {...callbacks} />)
    const textarea = screen.getByRole('textbox')
    const newline = createEvent.keyDown(textarea, { key: 'Enter', shiftKey: true, cancelable: true })
    fireEvent(textarea, newline)
    expect(newline.defaultPrevented).toBe(false)
    expect(callbacks.handleKeyDown).toHaveBeenCalledTimes(1)
    expect(callbacks.handleSendMessage).not.toHaveBeenCalled()
  })

  it('uses the current key and send callbacks when only callbacks change', () => {
    const previous = props()
    const { rerender } = render(<ChatInput {...previous} />)
    const next = { ...previous, handleKeyDown: jest.fn(), handleSendMessage: jest.fn().mockResolvedValue(undefined) }
    rerender(<ChatInput {...next} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Draft' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(previous.handleKeyDown).not.toHaveBeenCalled()
    expect(previous.handleSendMessage).not.toHaveBeenCalled()
    expect(next.handleKeyDown).toHaveBeenCalledTimes(1)
    expect(next.handleSendMessage).toHaveBeenCalledTimes(1)
  })

  it('uses the current fallback message setter when only it changes', () => {
    const previous = props()
    const { rerender } = render(<ChatInput {...previous} />)
    const setMessage = jest.fn()
    rerender(<ChatInput {...previous} setMessage={setMessage} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft' } })
    expect(previous.setMessage).not.toHaveBeenCalled()
    expect(setMessage).toHaveBeenCalledWith('Draft')
  })

  it('explains why a contactless voice conversation cannot start a call instead of acting as assistant chat', () => {
    jest.mocked(useChannelSelector).mockReturnValue({ ...channelState(), selectedChannel: 'voice' })
    const callbacks = props()
    render(<ChatInput {...callbacks} leadData={null} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Follow up' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.submit(textarea.closest('form')!)
    expect(screen.getByRole('status')).toHaveTextContent('No call started. Link this conversation')
    expect(screen.getByRole('button', { name: 'Start call' })).toBeDisabled()
    expect(callbacks.handleSendMessage).not.toHaveBeenCalled()
    expect(callbacks.handleKeyDown).not.toHaveBeenCalled()
  })

  it('labels linked voice sends as outbound calls and blocks while routing is loading', () => {
    jest.mocked(useChannelSelector).mockReturnValue({ ...channelState(), selectedChannel: 'voice' })
    const callbacks = props()
    const { rerender } = render(<ChatInput {...callbacks} leadData={{ id: 'lead-1' }} isConversationReady={false} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Greeting' } })
    expect(screen.getByRole('button', { name: 'Start call' })).toBeDisabled()
    rerender(<ChatInput {...callbacks} leadData={consentedLead} isConversationReady />)
    expect(screen.getByRole('status')).toHaveTextContent('Start an outbound call')
    expect(screen.getByRole('button', { name: 'Start call' })).toBeEnabled()
  })

  it.each([
    [{ voice_call_consent_status: 'revoked', voice_call_consent_at: null }, 'explicitly opted out'],
    [{ voice_call_consent_status: 'denied' }, 'explicitly opted out'],
    [{ do_not_call: true }, 'do-not-call'],
    [{ phone: undefined }, 'international phone number'],
  ])('blocks voice button, Enter and native submit with an actionable reason: %j', (overrides, reason) => {
    jest.mocked(useChannelSelector).mockReturnValue({ ...channelState(), selectedChannel: 'voice' })
    const callbacks = props()
    render(<ChatInput {...callbacks} leadData={{ ...consentedLead, ...overrides }} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Keep this greeting' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.submit(textarea.closest('form')!)
    expect(screen.getByRole('status')).toHaveTextContent(reason)
    expect(screen.getByRole('button', { name: 'Start call' })).toBeDisabled()
    expect(callbacks.handleSendMessage).not.toHaveBeenCalled()
    expect(callbacks.handleKeyDown).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('Keep this greeting')
  })

  it.each([
    { voice_call_consent_status: 'unknown', voice_call_consent_at: null },
    { voice_call_consent_status: undefined, voice_call_consent_at: undefined },
    { voice_call_consent_status: 'granted', voice_call_consent_at: 'invalid' },
  ])('allows voice button, Enter and native submit without recorded consent: %j', overrides => {
    jest.mocked(useChannelSelector).mockReturnValue({ ...channelState(), selectedChannel: 'voice' })
    const callbacks = props()
    render(<ChatInput {...callbacks} leadData={{ ...consentedLead, ...overrides }} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Follow-up greeting' } })
    expect(screen.getByRole('status')).toHaveTextContent('Start an outbound call')
    expect(screen.getByRole('status')).not.toHaveTextContent('explicit consent')
    expect(screen.getByRole('button', { name: 'Start call' })).toBeEnabled()
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(callbacks.handleKeyDown).toHaveBeenCalledTimes(1)
    fireEvent.submit(textarea.closest('form')!)
    expect(callbacks.handleSendMessage).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Start call' }))
    expect(callbacks.handleSendMessage).toHaveBeenCalledTimes(2)
  })

  it('blocks new voice submissions when an explicit opt-out is loaded after an eligible lead', () => {
    jest.mocked(useChannelSelector).mockReturnValue({ ...channelState(), selectedChannel: 'voice' })
    const callbacks = props()
    const lead = { ...consentedLead, voice_call_consent_status: 'unknown', voice_call_consent_at: null }
    const { rerender } = render(<ChatInput {...callbacks} leadData={lead} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Keep this greeting' } })
    expect(screen.getByRole('button', { name: 'Start call' })).toBeEnabled()
    rerender(<ChatInput {...callbacks} leadData={{ ...lead, voice_call_consent_status: 'revoked' }} />)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.submit(textarea.closest('form')!)
    expect(screen.getByRole('button', { name: 'Start call' })).toBeDisabled()
    expect(callbacks.handleKeyDown).not.toHaveBeenCalled()
    expect(callbacks.handleSendMessage).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('Keep this greeting')
  })

  it('does not block text-channel sends when outbound voice consent is missing', () => {
    const callbacks = props()
    render(<ChatInput {...callbacks} leadData={{ id: 'lead-1' }} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Text follow-up' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(callbacks.handleSendMessage).toHaveBeenCalledTimes(1)
  })

  it('blocks all public reply submission paths when the comment selection is unavailable', () => {
    const callbacks = props()
    const target = { id: 'comment-a', role: 'user' as const, text: 'Which size?', timestamp: new Date(), metadata: {
      source: 'comment', outstand_post_id: 'post-a', platform_comment_id: 'provider-comment',
    } }
    const selection = { options: [target], target: undefined, select: jest.fn() }
    const { rerender } = render(<ChatInput {...callbacks} commentReplySelection={selection} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Size M' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.submit(textarea.closest('form')!)
    expect(screen.getByRole('button', { name: 'Reply publicly' })).toBeDisabled()
    expect(callbacks.handleSendMessage).not.toHaveBeenCalled()
    expect(callbacks.handleKeyDown).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: 'Comment to reply to' })).toBeInTheDocument()

    rerender(<ChatInput {...callbacks} commentReplySelection={{ ...selection, target }} />)
    expect(screen.getByRole('status')).toHaveTextContent('not a direct message')
    expect(screen.getByRole('button', { name: 'Reply publicly' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Reply publicly' }))
    expect(callbacks.handleSendMessage).toHaveBeenCalledTimes(1)
  })

  it('renders a compact latest-comment selector inside the text composer without submitting on selection', async () => {
    const callbacks = props()
    const { container } = render(<CommentComposer callbacks={callbacks} />)
    const textarea = screen.getByRole('textbox')
    const picker = screen.getByRole('combobox', { name: 'Comment to reply to' })
    const composer = container.querySelector('#tour-chat-input')

    expect(composer).toContainElement(textarea)
    expect(composer).toContainElement(picker)
    expect(picker).toHaveClass('h-8', 'rounded-full', 'bg-secondary', 'border-0', 'max-w-full')
    expect(picker).toHaveTextContent('Comment: Is it available?')
    expect(picker).toHaveAttribute('type', 'button')
    expect(textarea).toHaveStyle({ paddingBottom: '62px' })
    expect(screen.getByRole('button', { name: 'Reply publicly' })).toBeDisabled()

    fireEvent.change(textarea, { target: { value: 'Keep my draft' } })
    expect(screen.getByRole('button', { name: 'Reply publicly' })).toBeEnabled()
    fireEvent.keyDown(picker, { key: 'ArrowDown' })
    const original = await screen.findByRole('option', { name: /Which size\?/ })
    expect(original).toHaveTextContent('Summer collection · @our-store')
    expect(screen.getByRole('option', { name: /Is it available\?/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('listbox')).toHaveAttribute('data-side', 'top')
    fireEvent.keyDown(original, { key: 'Enter' })
    await waitFor(() => expect(picker).toHaveTextContent('Comment: Which size?'))
    expect(textarea).toHaveValue('Keep my draft')
    expect(callbacks.handleSendMessage).not.toHaveBeenCalled()
    expect(callbacks.handleKeyDown).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reply publicly' }))
    expect(callbacks.handleSendMessage).toHaveBeenCalledTimes(1)
  })

  it.each([
    { isLoading: true, isConversationReady: true },
    { isLoading: false, isConversationReady: false },
  ])('disables comment changes and sending while delivery is unavailable (%j)', availability => {
    render(<ChatInput {...props()} {...availability} message="Draft" commentReplySelection={{
      options: [firstComment], target: firstComment, select: jest.fn(),
    }} />)
    expect(screen.getByRole('combobox', { name: 'Comment to reply to' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reply publicly' })).toBeDisabled()
  })

  it('explains the empty comment state and keeps all sending paths blocked', () => {
    const callbacks = props()
    render(<ChatInput {...callbacks} commentReplySelection={{ options: [], target: undefined, select: jest.fn() }} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Draft' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.submit(textarea.closest('form')!)
    expect(screen.getByRole('combobox', { name: 'Comment to reply to' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('No replyable comment is available. Open the original post to reply.')
    expect(screen.getByRole('button', { name: 'Reply publicly' })).toBeDisabled()
    expect(callbacks.handleSendMessage).not.toHaveBeenCalled()
    expect(callbacks.handleKeyDown).not.toHaveBeenCalled()
  })
})