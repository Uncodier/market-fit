"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { listBuyerSubscriptions, getUserSites } from "../actions"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { LayoutGrid, CheckCircle2, Repeat, Play, Pause, Archive, Video, Ticket, File as FileIcon } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { resolveItemImage } from "@/app/lib/image-utils"
import { formatCurrency } from "@/app/lib/formatters"
import { StatusDot } from "@/app/components/documents/document-list"

const SUBTYPE_ICONS: Record<string, any> = {
  course: <Video size={16} className="text-blue-500" />,
  ticket: <Ticket size={16} className="text-orange-500" />,
  file: <FileIcon size={16} className="text-purple-500" />,
  pass: <CheckCircle2 size={16} className="text-green-500" />,
  license: <CheckCircle2 size={16} className="text-indigo-500" />,
}

export function BuyerSubscriptionsView({
  scope = "personal",
  ownerSiteId,
}: {
  scope?: "personal" | "site"
  ownerSiteId?: string
}) {
  const { t } = useLocalization()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [sites, setSites] = useState<any[]>([])

  useEffect(() => {
    if (scope === 'personal') {
      getUserSites().then(res => {
        if (res.data) setSites(res.data)
      })
    }
  }, [scope])

  const effectiveOwnerSiteId = scope === 'site' ? ownerSiteId : ownerFilter

  const { data, error, isLoading, mutate } = useSWR(
    ['buyer-subscriptions', page, pageSize, searchQuery, statusFilter, effectiveOwnerSiteId, scope],
    async () => {
      const res = await listBuyerSubscriptions({ page, pageSize, q: searchQuery, status: statusFilter, ownerSiteId: effectiveOwnerSiteId, scope })
      if (res.error) throw new Error(res.error)
      return res
    }
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }

  const HeaderWrapper = scope === 'site' ? StickyHeader : ({ children }: any) => (
    <div className="sticky top-[72px] z-30 bg-transparent h-[72px] flex items-center">
      {children}
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-full">
        <HeaderWrapper>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar">
              <Skeleton className="h-8 w-[280px] rounded-full flex-shrink-0" />
              <Skeleton className="h-9 w-48 rounded-md flex-shrink-0" />
            </div>
            
            <div className="ml-auto flex items-center justify-end gap-3 flex-shrink-0">
              <Skeleton className="h-9 w-[160px] rounded-md hidden sm:block" />
            </div>
          </div>
        </HeaderWrapper>

        <div className={`flex-1 overflow-auto ${scope === 'personal' ? 'py-4 md:py-6' : 'p-4 md:p-6 lg:p-8'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="p-5 flex flex-col flex-1 space-y-4">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-3/4" />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <div className="flex justify-between items-end pt-4 border-t mt-auto">
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-1 items-end flex flex-col">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-full">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full min-h-0">
        <HeaderWrapper>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar">
              <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <LayoutGrid size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.subscriptions.filters.all') || 'All'}</span>
                </TabsTrigger>
                <TabsTrigger value="active" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <Play size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.subscriptions.filters.active') || 'Active'}</span>
                </TabsTrigger>
                <TabsTrigger value="paused" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <Pause size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.subscriptions.filters.paused') || 'Paused'}</span>
                </TabsTrigger>
              </TabsList>

              <SearchInput
                placeholder={t('buyer.subscriptions.search') || "Search subscriptions..."} 
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                alwaysExpanded={false}
              />
            </div>
            
            <div className="ml-auto flex items-center justify-end gap-3">
              {scope === 'personal' && sites.length > 1 && (
                <Select value={ownerFilter} onValueChange={(val) => { setOwnerFilter(val); setPage(1); mutate(); }}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder={t('buyer.subscriptions.filters.allCollections') || "All Collections"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('buyer.subscriptions.filters.allSubscriptions') || "All Subscriptions"}</SelectItem>
                    <SelectItem value="personal">{t('buyer.subscriptions.filters.personalOnly') || "Personal Only"}</SelectItem>
                    {sites.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </HeaderWrapper>

        <div className={`flex-1 overflow-auto ${scope === 'personal' ? 'py-4 md:py-6' : 'p-4 md:p-6 lg:p-8'}`}>
          {error ? (
            <div className="text-center text-red-500 p-4">{t('buyer.subscriptions.errorLoading') || 'Error loading subscriptions'}</div>
          ) : !data?.data || data.data.length === 0 ? (
            <EmptyCard 
              icon={<Repeat size={40} className="text-muted-foreground" />}
              title={t('buyer.subscriptions.empty.title') || "No subscriptions"}
              description={statusFilter !== 'all' || (scope === 'personal' && ownerFilter !== 'all')
                ? (t('buyer.subscriptions.empty.descFiltered') || "Try adjusting your filters to see more results.")
                : scope === 'site'
                  ? (t('buyer.subscriptions.empty.descBusiness') || "No active subscriptions for this business.")
                  : (t('buyer.subscriptions.empty.descPersonal') || "You don't have any active subscriptions.")
              }
              variant="fancy"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.data.map((sub: any) => (
                <div 
                  key={sub.id} 
                  className="overflow-hidden rounded-xl border border-border/70 bg-card flex flex-col group hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => router.push(`/shop/${sub.site?.id || sub.owner_site_id}/${sub.catalog_item?.id || sub.catalog_item_id}`)}
                >
                  <div className="aspect-video bg-muted relative">
                    <img src={resolveItemImage(sub.catalog_item || { name: 'Unknown' })} alt={sub.catalog_item?.name || 'Subscription'} className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {sub.site?.name}
                        {scope === "personal" && sub.owner_site_id
                          ? ` · ${t("buyer.subscriptions.business") || "Business"}`
                          : ""}
                      </p>
                      <StatusDot
                        status={(sub.status || "unknown").toLowerCase()}
                        label={
                          sub.status
                            ? (t(`status.${sub.status.toLowerCase()}`) || sub.status)
                            : (t("status.unknown") || "Unknown")
                        }
                      />
                    </div>
                    
                    <h3 className="font-medium text-base mb-1 line-clamp-2">{sub.catalog_item?.name || t('buyer.subscriptions.unknownPlan') || 'Unknown Plan'}</h3>
                    <div className="text-xs text-muted-foreground mb-4 flex flex-col gap-1">
                      <span>{t('buyer.subscriptions.startedPrefix') || 'Started'} {sub.start_date && !isNaN(new Date(sub.start_date).getTime()) ? format(new Date(sub.start_date), 'MMM d, yyyy') : '-'}</span>
                      {sub.end_date && !isNaN(new Date(sub.end_date).getTime()) && (
                        <span>{t('buyer.subscriptions.endsPrefix') || 'Ends'} {format(new Date(sub.end_date), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{t('buyer.subscriptions.table.nextBilling') || 'Next Billing'}</span>
                        <span className="text-sm text-muted-foreground">
                          {sub.next_billing_date && !isNaN(new Date(sub.next_billing_date).getTime()) ? format(new Date(sub.next_billing_date), 'MMM d, yyyy') : '-'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[15px] font-semibold tabular-nums tracking-tight">
                          {formatCurrency(Number(sub.amount) || 0, sub.catalog_item?.currency || 'USD')}
                        </span>
                        <span className="text-[11px] text-muted-foreground">/mo</span>
                      </div>
                    </div>

                    {sub.entitlements && sub.entitlements.length > 0 && (
                      <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                        <div className="text-xs font-medium text-muted-foreground">{t('buyer.subscriptions.includedAccess') || 'Included Access'}:</div>
                        {sub.entitlements.map((e: any) => (
                          <div 
                            key={e.id} 
                            className={`flex items-center gap-2 text-sm bg-muted/30 p-2 rounded-md ${e.catalog_item?.digital_subtype === 'pass' ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              if (e.catalog_item?.digital_subtype === 'pass') {
                                router.push(`/buyer/book/${e.id}`)
                              }
                            }}
                          >
                            {SUBTYPE_ICONS[e.catalog_item?.digital_subtype || ''] || <Archive size={14} />}
                            <span className="flex-1 truncate">{e.catalog_item?.name}</span>
                            {e.catalog_item?.digital_subtype === 'pass' && (
                               <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                                 {e.uses_remaining !== null ? `${e.uses_remaining} uses` : '∞'}
                               </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {data.count !== undefined && data.count > pageSize && (
                <div className="col-span-full pt-6 border-t mt-2">
                  <Pagination 
                    currentPage={page} 
                    totalPages={Math.ceil(data.count / pageSize)} 
                    onPageChange={setPage} 
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  )
}
