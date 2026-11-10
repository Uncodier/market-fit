import { act, renderHook } from '@testing-library/react'
import { useOptimizedKeyboardHandler } from '@/app/hooks/useOptimizedKeyboardHandler'

it.each(['text', 'audio'] as const)('captures %s when Enter schedules a send', async responseFormat => {
  let frame!: FrameRequestCallback
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1 })
  const onSendMessage = jest.fn().mockResolvedValue(undefined)
  const { result } = renderHook(() => useOptimizedKeyboardHandler({
    messageRef: { current: 'Draft' }, isLoading: false, onSendMessage,
  }))
  act(() => result.current.handleKeyDown({ key: 'Enter', preventDefault: jest.fn() } as unknown as React.KeyboardEvent, responseFormat))
  await act(async () => { frame(0) })
  expect(onSendMessage).toHaveBeenCalledWith(expect.anything(), responseFormat)
  jest.restoreAllMocks()
})