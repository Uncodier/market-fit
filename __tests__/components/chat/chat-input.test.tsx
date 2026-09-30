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
})