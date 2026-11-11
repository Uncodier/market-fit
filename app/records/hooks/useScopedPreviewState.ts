import { useCallback, useState } from "react"

/** Hide previous-site data immediately, including the render before effects run. */
export function useScopedPreviewState<T>(scope: string | undefined, empty: T): [T, (value: T) => void] {
  const [state, setState] = useState<{ scope: string | undefined; value: T }>({ scope, value: empty })
  const setValue = useCallback((value: T) => setState({ scope, value }), [scope])
  return [state.scope === scope ? state.value : empty, setValue]
}