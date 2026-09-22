import { act, renderHook } from '@testing-library/react'
import { useTypewriterPlaceholder } from '@/app/components/simple-messages-view/hooks/useTypewriterPlaceholder'

const createMatchMedia = (matches: boolean) =>
  jest.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }))

describe('useTypewriterPlaceholder', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    jest.useFakeTimers()
    window.matchMedia = createMatchMedia(false)
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    window.matchMedia = originalMatchMedia
  })

  it('types a phrase and starts deleting it after the pause', () => {
    const { result, unmount } = renderHook(() =>
      useTypewriterPlaceholder({
        phrases: ['Plan'],
        enabled: true,
        typingDelay: 10,
        deletingDelay: 5,
        pauseDelay: 20,
      })
    )

    expect(result.current).toBe('')

    for (let index = 0; index < 4; index += 1) {
      act(() => jest.runOnlyPendingTimers())
    }
    expect(result.current).toBe('Plan')

    act(() => jest.runOnlyPendingTimers())
    act(() => jest.runOnlyPendingTimers())
    expect(result.current).toBe('Pla')

    unmount()
  })

  it('shows a stable phrase when reduced motion is preferred', () => {
    window.matchMedia = createMatchMedia(true)

    const { result } = renderHook(() =>
      useTypewriterPlaceholder({
        phrases: ['Analyze product-market fit'],
        enabled: true,
      })
    )

    expect(result.current).toBe('Analyze product-market fit')
  })
})
