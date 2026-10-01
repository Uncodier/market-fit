import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { ChatInput } from '@/app/components/chat/ChatInput'
import { useChannelSelector } from '@/app/hooks/useChannelSelector'

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

describe('ChatInput send guards', () => {
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
})