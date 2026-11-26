"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/app/components/ui/card"
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from "@/app/components/ui/section-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { stickyHeaderBorderClassName } from "@/app/components/ui/sticky-header-styles"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"

export const connectorGridClassName = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4"
export const connectorCatalogueBodyClassName = "mx-auto max-w-[1500px] px-4 py-8 lg:px-8"
export const connectorDetailBodyClassName = "mx-auto max-w-5xl space-y-6 px-4 py-8 lg:px-8"
export const connectorDetailToolbarClassName = "flex w-full min-w-0 flex-wrap items-center gap-2 py-3 sm:gap-3"
export const connectorAccountControlClassName = "w-full sm:ml-auto sm:w-60"

function LoadingStatus({ children, message = "connectors.loading" }: { children: ReactNode; message?: string }) {
  const { t } = useLocalization()
  return <div role="status" className="min-w-0 flex-1">
    <span className="sr-only">{t(message)}</span>
    <div aria-hidden="true" className="motion-reduce:[&_.animate-pulse]:animate-none">{children}</div>
  </div>
}

function CatalogueToolbarSkeleton() {
  return <div className={`flex min-h-[71px] items-center gap-2 px-4 sm:gap-3 lg:px-8 ${stickyHeaderBorderClassName}`}>
    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
    <Skeleton className="h-8 w-40 rounded-full" />
    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
  </div>
}

export function ConnectorAccountSkeleton() {
  return <Skeleton aria-hidden="true" data-testid="connector-account-skeleton"
    className={cn("h-10 motion-reduce:animate-none md:h-9 md:rounded-full", connectorAccountControlClassName)} />
}

function DetailToolbarSkeleton() {
  return <div className={`flex min-h-[71px] items-center px-4 lg:px-8 ${stickyHeaderBorderClassName}`}>
    <div className={connectorDetailToolbarClassName}>
      <div className="flex h-8 shrink-0 items-center gap-2 rounded-full bg-muted/30 px-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-3 w-12 rounded-full" />
      </div>
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <ConnectorAccountSkeleton />
    </div>
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
        <CatalogueToolbarSkeleton />
        <div className={connectorCatalogueBodyClassName}><CatalogueCardsSkeleton /></div>
      </div>
    </div> : <CatalogueCardsSkeleton />}
  </LoadingStatus>
}

function DetailCardSkeleton({ section, headingWidth, description = true, children, footer }: {
  section: string; headingWidth: string; description?: boolean; children: ReactNode; footer?: ReactNode
}) {
  return <SectionCard data-skeleton-section={section}>
    <SectionCardHeader>
      <Skeleton className={cn("h-6 max-w-full", headingWidth)} />
      {description && <div className="space-y-1">
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/5 sm:w-1/3" />
      </div>}
    </SectionCardHeader>
    {children}
    {footer}
  </SectionCard>
}

function AccessSummarySkeleton() {
  return <DetailCardSkeleton section="access" headingWidth="w-20">
    <SectionCardContent>
      <Skeleton className="h-4 w-4/5" />
    </SectionCardContent>
  </DetailCardSkeleton>
}

export function ConnectorDetailSkeleton({ fullPage = false }: { fullPage?: boolean }) {
  const summary = <div className="space-y-6" data-testid="connector-summary-skeleton">
    <DetailCardSkeleton section="overview" headingWidth="w-40">
      <SectionCardContent>
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-56 max-w-full" />
        <Skeleton className="h-5 w-11/12" />
        <div className="space-y-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </SectionCardContent>
    </DetailCardSkeleton>
    <DetailCardSkeleton section="connection" headingWidth="w-32" footer={
      <SectionCardFooter className="flex-wrap">
        <Skeleton className="h-8 w-36 max-w-full rounded-full" />
        <Skeleton className="h-8 w-40 max-w-full rounded-full" />
      </SectionCardFooter>
    }>
      <SectionCardContent>
        <div className="space-y-3">
          <Skeleton className="h-5 w-64 max-w-full rounded-full" />
          <Skeleton className="h-4 w-11/12" />
        </div>
      </SectionCardContent>
    </DetailCardSkeleton>
    <AccessSummarySkeleton />
    <DetailCardSkeleton section="related-skills" headingWidth="w-32">
      <SectionCardContent><Skeleton className="h-4 w-40 max-w-full" /></SectionCardContent>
    </DetailCardSkeleton>
    <DetailCardSkeleton section="activity" headingWidth="w-24" description={false}>
      <SectionCardContent>
        <Skeleton className="h-4 w-52 max-w-full" />
        <Skeleton className="h-3 w-3/4" />
      </SectionCardContent>
    </DetailCardSkeleton>
  </div>
  return <LoadingStatus>
    {fullPage ? <><DetailToolbarSkeleton /><div className={connectorDetailBodyClassName}><div className="mt-2">{summary}</div></div></> : summary}
  </LoadingStatus>
}

export function ConnectorToolsSkeleton() {
  return <LoadingStatus message="connectors.loadingTools"><div className="space-y-4">
    <Skeleton className="h-4 w-28" />
    <div className="space-y-3">
      <Skeleton className="h-5 w-24" />
      {[0, 1, 2].map(key => <div key={key} className="space-y-2 rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-5 w-36 max-w-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full" />
      </div>)}
    </div>
  </div></LoadingStatus>
}

export function ConnectorToolsNavSkeleton() {
  return <div aria-hidden="true" className="hidden w-[240px] shrink-0 space-y-2 motion-reduce:[&_.animate-pulse]:animate-none xl:block">
    <Skeleton className="mb-3 h-3 w-24" />
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-8 w-full" />
  </div>
}

export function ConnectorAccessSkeleton() {
  return <LoadingStatus><AccessSummarySkeleton /></LoadingStatus>
}