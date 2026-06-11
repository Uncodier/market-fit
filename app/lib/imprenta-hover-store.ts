export type ImprentaHoverStore = {
  get: () => string | null
  set: (id: string | null) => void
  subscribe: (listener: (id: string | null) => void) => () => void
}

export function createImprentaHoverStore(): ImprentaHoverStore {
  let state: string | null = null
  const listeners = new Set<(id: string | null) => void>()

  return {
    get: () => state,
    set: (id: string | null) => {
      if (state === id) return
      state = id
      listeners.forEach((l) => l(id))
    },
    subscribe: (listener: (id: string | null) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
