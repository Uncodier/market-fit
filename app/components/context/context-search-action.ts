export type ContextSearchAction = 'idle' | 'load-initial' | 'search'

export function resolveContextSearchAction(input: {
  open: boolean
  wasOpen: boolean
  searchTerm: string
  previousSearchTerm: string
  hasInitialized: boolean
}): ContextSearchAction {
  if (!input.open) return 'idle'

  const trimmed = input.searchTerm.trim()
  const prevTrimmed = input.previousSearchTerm.trim()
  const justOpened = !input.wasOpen

  if (!trimmed) {
    if (justOpened || !input.hasInitialized || prevTrimmed) return 'load-initial'
    return 'idle'
  }

  return 'search'
}
