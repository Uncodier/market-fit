"use client"

import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react"
import { AuthContext } from "@/app/components/auth/auth-context"
import { createReportExportRegistry, type ReportExportRegistry } from "./report-export-registry"
import type { ReportExportScope as Scope } from "./report-export-data"
import { reportExportResourceKey } from "./report-export-key"

const ExportContext = createContext<ReportExportRegistry | null>(null)

export function ReportExportScope({ children, ...filters }: Omit<Scope, "userId" | "timeZone"> & { children: ReactNode }) {
  const auth = useContext(AuthContext)
  const scope: Scope = {
    ...filters,
    userId: auth?.isLoading ? "" : auth?.user?.id ?? "",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
  return <ExportScope key={JSON.stringify(scope)} scope={scope}>{children}</ExportScope>
}

function ExportScope({ scope, children }: { scope: Scope; children: ReactNode }) {
  const [registry] = useState(() => createReportExportRegistry(scope))
  useLayoutEffect(() => {
    registry.mount()
    return () => registry.dispose()
  }, [registry])
  return <ExportContext.Provider value={registry}>{children}</ExportContext.Provider>
}

export function useReportExportResource(key: string | readonly unknown[] | null, data: unknown, ready: boolean) {
  const registry = useContext(ExportContext)
  const [subscriber] = useState(() => Symbol("report-resource"))
  const encodedKey = JSON.stringify(key)
  const resource = useMemo(() => registry
    ? reportExportResourceKey(JSON.parse(encodedKey), registry.scope) : null, [registry, encodedKey])
  useLayoutEffect(() => {
    if (!registry || !resource) return
    registry.set(subscriber, { ...resource, data, ready })
    return () => registry.remove(subscriber)
  }, [registry, subscriber, resource, data, ready])
}