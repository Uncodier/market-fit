import { useEffect, useState } from "react"
import { retryOnError } from "@/app/hooks/use-optimistic-error"
import { listWorkspaceQuotations } from "./workspace-read-actions"

export type WorkspaceQuote = {
  id: string
  lead?: { name?: string; email?: string } | null
  status?: string
  valid_until?: string | null
  total?: number | string
  currency?: string
  created_at: string
  purpose?: string
  tender_url?: string
}

type Result = { data: WorkspaceQuote[]; count: number }
type LoadState = { key: string; data?: Result; error: Error | null; isLoading: boolean }

export function useWorkspaceQuotations(params: Parameters<typeof listWorkspaceQuotations>[0]) {
  const [reloadCount, setReloadCount] = useState(0)
  const key = JSON.stringify([params, reloadCount])
  const [state, setState] = useState<LoadState>({ key, error: null, isLoading: true })
  // Mark changed requests as pending during render, not synchronously in an effect.
  if (state.key !== key) {
    setState({ key, data: state.data, error: null, isLoading: true })
  }

  useEffect(() => {
    let obsolete = false
    const [input] = JSON.parse(key) as [Parameters<typeof listWorkspaceQuotations>[0], number]
    void retryOnError(async () => {
      const result = await listWorkspaceQuotations(input)
      if (result.error) throw new Error(result.error)
      return result as Result
    }).then(
      (data) => {
        if (!obsolete) setState({ key, data, error: null, isLoading: false })
      },
      (error: unknown) => {
        if (!obsolete) setState((previous) => ({
          key, data: previous.data, error: error instanceof Error ? error : new Error(String(error)), isLoading: false,
        }))
      },
    )
    return () => { obsolete = true }
  }, [key])

  return { ...state, reload: () => setReloadCount((count) => count + 1) }
}
