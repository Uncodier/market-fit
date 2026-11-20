"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useLocalization } from "@/app/context/LocalizationContext"

export const connectorGridClassName = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4"
export const connectorCatalogueBodyClassName = "mx-auto max-w-[1500px] px-4 py-8 lg:px-8"
export const connectorDetailBodyClassName = "mx-auto max-w-5xl space-y-6 px-4 py-8 lg:px-8"

function LoadingStatus({ children }: { children: ReactNode }) {
  const { t } = useLocalization()
  return <div role="status" className="min-w-0 flex-1">
    <span className="sr-only">{t("connectors.loading")}</span>
    <div aria-hidden="true">{children}</div>
  </div>
}

function ToolbarSkeleton({ catalogue = false }: { catalogue?: boolean }) {
  return <div className="flex min-h-[71px] items-center gap-2 border-b px-4 sm:gap-3 lg:px-8">
    {catalogue && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
    <Skeleton className="h-8 w-40 rounded-full" />
    {catalogue && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
  </div>
}

export function ConnectorDomainRowsSkeleton() {
  return <div aria-hidden="true" className="space-y-0.5">
    {["w-24", "w-20", "w-28", "w-16", "w-24", "w-20"].map((width, index) =>
      <div key={index} className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-[10.8px] py-[7.2px] md:min-h-8">
        <Skeleton className="h-4 w-4" />
        <Skeleton className={`h-3 ${width}`} />
        <Skeleton className="h-3 w-6 rounded-full" />
      </div>)}
  </div>
}

function CatalogueCardsSkeleton() {
  return <div className="space-y-4">
    <Skeleton className="h-5 w-32" />
    <div className={connectorGridClassName}>
      {Array.from({ length: 6 }, (_, index) => <Card key={index} className={index >= 3 ? "hidden md:block" : undefined}>
        <CardHeader>
          <Skeleton className="mb-3 h-12 w-12 rounded-xl" />
          <Skeleton className="h-5 w-32 max-w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>)}
    </div>
  </div>
}

export function ConnectorCatalogueSkeleton({ fullPage = false }: { fullPage?: boolean }) {
  return <LoadingStatus>
    {fullPage ? <div className="flex">
      <div className="hidden w-[319px] max-w-[38%] shrink-0 border-r p-1 pt-6 xl:block">
        <Skeleton className="mb-2 ml-[10.8px] h-3 w-16" />
        <ConnectorDomainRowsSkeleton />
      </div>
      <div className="min-w-0 flex-1">
        <ToolbarSkeleton catalogue />
        <div className={connectorCatalogueBodyClassName}><CatalogueCardsSkeleton /></div>
      </div>
    </div> : <CatalogueCardsSkeleton />}
  </LoadingStatus>
}

export function ConnectorDetailSkeleton({ fullPage = false }: { fullPage?: boolean }) {
  const summary = <>
    <Skeleton className="h-10 w-36 rounded-full" />
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardContent>
    </Card>
    <Card className="space-y-3 p-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-64 max-w-full rounded-lg" />
    </Card>
  </>
  return <LoadingStatus>
    {fullPage ? <><ToolbarSkeleton /><div className={connectorDetailBodyClassName}>{summary}</div></> :
      <div className="space-y-6">{summary}</div>}
  </LoadingStatus>
}

export function ConnectorToolsSkeleton() {
  return <LoadingStatus><div className="space-y-3">
    <Skeleton className="h-5 w-32" />
    {[0, 1, 2].map(key => <div key={key} className="space-y-2 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-full" />
    </div>)}
  </div></LoadingStatus>
}

export function ConnectorAccessSkeleton() {
  return <LoadingStatus><Card className="space-y-4 p-6">
    <Skeleton className="h-5 w-28" />
    <Skeleton className="h-4 w-64 max-w-full" />
    <div className="grid gap-6 sm:grid-cols-2">
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  </Card></LoadingStatus>
}