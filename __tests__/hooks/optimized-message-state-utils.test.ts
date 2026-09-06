import {
  CACHE_PERSIST_DEBOUNCE_MS,
  inputCacheStorageKey,
  readInputCache,
  resizeComposerTextarea,
  writeInputCache,
} from "@/app/hooks/optimized-message-state-utils"

function createTextarea(options: {
  value?: string
  height?: number
  scrollHeight?: number
  offsetHeight?: number
} = {}) {
  const textarea = document.createElement("textarea")
  textarea.value = options.value ?? ""
  if (options.height) textarea.style.height = `${options.height}px`
  Object.defineProperty(textarea, "scrollHeight", {
    configurable: true,
    get: () => options.scrollHeight ?? 80,
  })
  Object.defineProperty(textarea, "offsetHeight", {
    configurable: true,
    get: () => options.offsetHeight ?? options.height ?? 135,
  })
  return textarea
}

describe("input cache", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("round-trips a string value", () => {
    writeInputCache("chat-1", "draft text")
    expect(window.localStorage.getItem(inputCacheStorageKey("chat-1"))).toBe(JSON.stringify("draft text"))
    expect(readInputCache("chat-1")).toBe("draft text")
  })

  it("removes the cache entry when the value is empty", () => {
    writeInputCache("chat-1", "draft text")
    writeInputCache("chat-1", "")
    expect(readInputCache("chat-1")).toBeNull()
  })
})

describe("resizeComposerTextarea", () => {
  it("skips the auto-height layout pass when adding text that still fits", () => {
    const textarea = createTextarea({
      value: "hello",
      height: 135,
      scrollHeight: 80,
      offsetHeight: 135,
    })

    const nextHeight = resizeComposerTextarea(textarea, { previousLength: 4 })

    expect(nextHeight).toBe(135)
    expect(textarea.style.height).toBe("135px")
    expect(textarea.style.overflowY).toBe("hidden")
  })

  it("measures again when deleting so the box can shrink", () => {
    const textarea = createTextarea({
      value: "short",
      height: 200,
      scrollHeight: 135,
      offsetHeight: 200,
    })

    const nextHeight = resizeComposerTextarea(textarea, { previousLength: 80 })

    expect(nextHeight).toBe(135)
    expect(textarea.style.height).toBe("135px")
  })

  it("grows up to the max height and enables scroll after that", () => {
    const textarea = createTextarea({
      value: "long text",
      height: 135,
      scrollHeight: 420,
      offsetHeight: 135,
    })

    const nextHeight = resizeComposerTextarea(textarea, { previousLength: 4 })

    expect(nextHeight).toBe(300)
    expect(textarea.style.height).toBe("300px")
    expect(textarea.style.overflowY).toBe("auto")
  })
})

describe("cache persist debounce constant", () => {
  it("is long enough to stay off the typing path", () => {
    expect(CACHE_PERSIST_DEBOUNCE_MS).toBeGreaterThanOrEqual(300)
  })
})
