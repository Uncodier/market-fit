export const CACHE_PERSIST_DEBOUNCE_MS = 400
export const DEFAULT_MIN_TEXTAREA_HEIGHT = 135
export const DEFAULT_MAX_TEXTAREA_HEIGHT = 300

export function inputCacheStorageKey(cacheKey: string) {
  return `input-cache-${cacheKey}`
}

export function readInputCache(cacheKey: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const cached = window.localStorage.getItem(inputCacheStorageKey(cacheKey))
    if (cached === null) return null
    const parsed = JSON.parse(cached)
    return typeof parsed === "string" ? parsed : null
  } catch {
    return null
  }
}

export function writeInputCache(cacheKey: string, value: string) {
  if (typeof window === "undefined") return
  try {
    const key = inputCacheStorageKey(cacheKey)
    if (!value) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // Ignore quota / private-mode failures
  }
}

export function resizeComposerTextarea(
  textarea: HTMLTextAreaElement,
  options: {
    minHeight?: number
    maxHeight?: number
    previousLength?: number
  } = {}
) {
  const minHeight = options.minHeight ?? DEFAULT_MIN_TEXTAREA_HEIGHT
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_TEXTAREA_HEIGHT
  const valueLength = textarea.value.length
  const currentHeight = parseFloat(textarea.style.height) || textarea.offsetHeight || minHeight
  const isDeleting =
    options.previousLength !== undefined && valueLength < options.previousLength

  // Adding text that still fits the current box does not need a layout pass
  if (!isDeleting && textarea.scrollHeight <= currentHeight && currentHeight >= minHeight) {
    if (currentHeight < maxHeight && textarea.style.overflowY !== "hidden") {
      textarea.style.overflowY = "hidden"
    }
    return currentHeight
  }

  textarea.style.height = "auto"
  const scrollHeight = textarea.scrollHeight
  const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
  textarea.style.height = `${newHeight}px`
  textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden"
  return newHeight
}
