"use client"

import { useContext, type ReactNode } from "react"
import { SWRConfig } from "swr"
import { AuthContext } from "@/app/components/auth/auth-context"
import { Button } from "@/app/components/ui/button"

// Functional configuration deliberately excludes the app's error-masking middleware
// and persistent cache. This memory cache lives across section changes, not sessions.
const reportConfig = () => ({
  provider: () => new Map(),
  use: [],
  keepPreviousData: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  shouldRetryOnError: false,
  dedupingInterval: 30_000,
})

export function SocialCostReportScope({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext)
  return <SWRConfig key={auth?.user?.id ?? "anonymous"} value={reportConfig}>{children}</SWRConfig>
}

export function ReportRequestError({ title, description, retry, retryLabel = "Try again", retrying = false }: {
  title: string
  description: string
  retry: () => void
  retryLabel?: string
  retrying?: boolean
}) {
  return (
    <div role="alert" className="space-y-3 rounded-lg border bg-background p-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button variant="outline" onClick={retry} disabled={retrying}>{retrying ? "Retrying…" : retryLabel}</Button>
    </div>
  )
}