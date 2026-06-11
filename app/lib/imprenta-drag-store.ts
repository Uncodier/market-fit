export type ImprentaDragPreview = { id: string; x: number; y: number } | null

export type ImprentaDragStore = {
  get: () => ImprentaDragPreview
  set: (preview: ImprentaDragPreview) => void
  subscribe: (listener: (preview: ImprentaDragPreview) => void) => () => void
}

export function createImprentaDragStore(): ImprentaDragStore {
  let state: ImprentaDragPreview = null
  const listeners = new Set<(preview: ImprentaDragPreview) => void>()

  return {
    get: () => state,
    set: (preview: ImprentaDragPreview) => {
      if (
        state?.id === preview?.id &&
        state?.x === preview?.x &&
        state?.y === preview?.y
      ) {
        return
      }
      state = preview
      listeners.forEach((l) => l(preview))
    },
    subscribe: (listener: (preview: ImprentaDragPreview) => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
