/** Deduplicates the actual read, not a timeout race; abort retains ownership until settlement. */
export function createChatMessageRead<T>(read: (signal: AbortSignal) => Promise<T>) {
  let pending: Promise<T> | undefined
  let controller: AbortController | undefined
  return {
    read() {
      if (pending) return pending
      controller = new AbortController()
      const signal = controller.signal
      pending = Promise.resolve().then(() => read(signal)).finally(() => {
        pending = undefined
        controller = undefined
      })
      return pending
    },
    abort() {
      controller?.abort()
    },
  }
}