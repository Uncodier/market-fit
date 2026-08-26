export type ImprentaTempConnectionPreview = {
  fromNode: string
  toX: number
  toY: number
} | null

export type ImprentaConnectionStore = {
  get: () => ImprentaTempConnectionPreview
  set: (preview: ImprentaTempConnectionPreview) => void
  subscribe: (listener: (preview: ImprentaTempConnectionPreview) => void) => () => void
}

export function createImprentaConnectionStore(): ImprentaConnectionStore {
  let state: ImprentaTempConnectionPreview = null
  const listeners = new Set<(preview: ImprentaTempConnectionPreview) => void>()

  return {
    get: () => state,
    set: (preview) => {
      if (
        state?.fromNode === preview?.fromNode &&
        state?.toX === preview?.toX &&
        state?.toY === preview?.toY
      ) {
        return
      }
      state = preview
      listeners.forEach((l) => l(preview))
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
