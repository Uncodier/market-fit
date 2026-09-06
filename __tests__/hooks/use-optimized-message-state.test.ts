import { act, renderHook } from "@testing-library/react"
import { useOptimizedMessageState } from "@/app/hooks/useOptimizedMessageState"
import {
  CACHE_PERSIST_DEBOUNCE_MS,
  inputCacheStorageKey,
} from "@/app/hooks/optimized-message-state-utils"

function createChangeEvent(value: string) {
  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.style.height = "135px"
  Object.defineProperty(textarea, "scrollHeight", { configurable: true, get: () => 80 })
  Object.defineProperty(textarea, "offsetHeight", { configurable: true, get: () => 135 })
  return { target: textarea } as React.ChangeEvent<HTMLTextAreaElement>
}

describe("useOptimizedMessageState", () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it("keeps the live value on the ref without re-rendering while typing", () => {
    const { result } = renderHook(() => useOptimizedMessageState("", "chat-typing"))

    act(() => {
      result.current.handleMessageChange(createChangeEvent("hello"))
    })

    expect(result.current.messageRef.current).toBe("hello")
    expect(result.current.message).toBe("")
  })

  it("updates React state only for programmatic set/clear", () => {
    const { result } = renderHook(() => useOptimizedMessageState("", "chat-set"))

    act(() => {
      result.current.setMessage("from prompt")
    })
    expect(result.current.message).toBe("from prompt")
    expect(result.current.messageRef.current).toBe("from prompt")

    act(() => {
      result.current.clearMessage()
    })
    expect(result.current.message).toBe("")
    expect(result.current.messageRef.current).toBe("")
  })

  it("debounces localStorage writes while typing", () => {
    const { result } = renderHook(() => useOptimizedMessageState("", "chat-cache"))

    act(() => {
      result.current.handleMessageChange(createChangeEvent("draft"))
    })

    expect(window.localStorage.getItem(inputCacheStorageKey("chat-cache"))).toBeNull()

    act(() => {
      jest.advanceTimersByTime(CACHE_PERSIST_DEBOUNCE_MS)
    })

    expect(window.localStorage.getItem(inputCacheStorageKey("chat-cache"))).toBe(JSON.stringify("draft"))
  })

  it("restores a cached draft on mount", () => {
    window.localStorage.setItem(inputCacheStorageKey("chat-restore"), JSON.stringify("cached draft"))

    const { result } = renderHook(() => useOptimizedMessageState("", "chat-restore"))

    expect(result.current.message).toBe("cached draft")
    expect(result.current.messageRef.current).toBe("cached draft")
  })
})
