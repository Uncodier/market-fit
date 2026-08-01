"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { listBuyerLibrary, getUserSites } from "../actions"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { LayoutGrid, Archive, Video, Ticket, File as FileIcon, CheckCircle2 } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { resolveItemImage } from "@/app/lib/image-utils"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { useRouter, useSearchParams } from "next/navigation"
import { getEntitlementExperiencePath } from "@/app/buyer/experience-routes"

const SUBTYPE_ICONS: Record<string, any> = {
  course: <Video size={16} className="text-blue-500" />,
  ticket: <Ticket size={16} className="text-orange-500" />,
  file: <FileIcon size={16} className="text-purple-500" />,
  pass: <CheckCircle2 size={16} className="text-green-500" />,
  license: <CheckCircle2 size={16} className="text-indigo-500" />,
}

export function BuyerLibraryView({
  scope = "personal",
  ownerSiteId,
}: {
  scope?: "personal" | "site"
  ownerSiteId?: string
}) {
  const { t } = useLocalization()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [subtypeFilter, setSubtypeFilter] = useState(searchParams?.get('subtype') || 'all')
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
    ['buyer-library', page, pageSize, searchQuery, subtypeFilter, effectiveOwnerSiteId, scope],
    async () => {
      const res = await listBuyerLibrary({ page, pageSize, q: searchQuery, subtype: subtypeFilter, ownerSiteId: effectiveOwnerSiteId, scope })
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

  return (
    <div className="flex-1 flex flex-col min-h-full">
      <Tabs value={subtypeFilter} onValueChange={(val) => { setSubtypeFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full min-h-0">
        <HeaderWrapper>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar">
              <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <LayoutGrid size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.library.filters.allItems') || 'All Items'}</span>
                </TabsTrigger>
                <TabsTrigger value="course" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <Video size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.library.filters.courses') || 'Courses'}</span>
                </TabsTrigger>
                <TabsTrigger value="ticket" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <Ticket size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.library.filters.tickets') || 'Tickets'}</span>
                </TabsTrigger>
                <TabsTrigger value="file" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <FileIcon size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.library.filters.files') || 'Files'}</span>
                </TabsTrigger>
                <TabsTrigger value="pass" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.library.filters.passes') || 'Passes'}</span>
                </TabsTrigger>
              </TabsList>

              <SearchInput
                placeholder={t('buyer.library.search') || "Search library..."} 
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
                    <SelectValue placeholder={t('buyer.library.filters.allCollections') || "All Collections"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('buyer.library.filters.allAssets') || "All Assets"}</SelectItem>
                    <SelectItem value="personal">{t('buyer.library.filters.personalOnly') || "Personal Only"}</SelectItem>
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
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-4">{t('buyer.library.errorLoading') || 'Error loading assets'}</div>
          ) : !data?.data || data.data.length === 0 ? (
            <EmptyCard 
              icon={<Archive size={40} className="text-muted-foreground" />}
              title={t('buyer.library.empty.title') || "Your assets are empty"}
              description={subtypeFilter !== 'all' || (scope === 'personal' && ownerFilter !== 'all')
                ? (t('buyer.library.empty.descFiltered') || "Try adjusting your filters to see more results.")
                : scope === 'site'
                  ? (t('buyer.library.empty.descBusiness') || "No digital assets purchased for this business yet.")
                  : (t('buyer.library.empty.descPersonal') || "When you purchase digital assets, they will appear here.")
              }
              variant="fancy"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.data.map((entitlement: any) => (
                <div key={entitlement.id} className="bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all">
                  <div className="aspect-video bg-muted relative">
                    <img src={resolveItemImage(entitlement.catalog_item || { name: 'Unknown' })} alt={entitlement.catalog_item?.name || 'Asset'} className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold shadow-sm flex items-center gap-1.5 capitalize">
                      {SUBTYPE_ICONS[entitlement.catalog_item?.digital_subtype || ''] || <Archive size={12} />}
                      {entitlement.catalog_item?.digital_subtype ? (t(`buyer.library.subtypes.${entitlement.catalog_item.digital_subtype.toLowerCase()}`) || entitlement.catalog_item.digital_subtype) : (t('buyer.library.digitalAsset') || 'Digital Asset')}
                    </div>
                  </div>
                  
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <span>{entitlement.site?.name}</span>
                      {scope === 'personal' && entitlement.owner_site_id && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span className="font-medium">{t('buyer.library.business') || 'Business'}</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-bold text-lg mb-4 line-clamp-2">{entitlement.catalog_item?.name}</h3>
                    
                    <div className="mt-auto pt-4 border-t flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          {t('buyer.library.grantedPrefix') || 'Granted'} {format(new Date(entitlement.granted_at), 'MMM d, yyyy')}
                        </div>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="rounded-full font-medium"
                          onClick={() => {
                            const experiencePath = getEntitlementExperiencePath(entitlement)
                            if (experiencePath) {
                              router.push(experiencePath)
                              return
                            }

                            // fallback for unknown or simple access
                            if (entitlement.catalog_item?.is_marketplace_listed) {
                              router.push(`/marketplace/${entitlement.catalog_item_id}`)
                            } else if (entitlement.site) {
                              const slug = entitlement.site.name 
                                ? entitlement.site.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                                : entitlement.site.id
                              router.push(`/shop/${slug}/${entitlement.catalog_item_id}`)
                            }
                          }}
                        >
                          {entitlement.catalog_item?.digital_subtype === 'course' ? (t('buyer.library.actions.course') || 'Go to Course') :
                           entitlement.catalog_item?.digital_subtype === 'ticket' ? (t('buyer.library.actions.ticket') || 'View Ticket') :
                           entitlement.catalog_item?.digital_subtype === 'file' ? (t('buyer.library.actions.file') || 'Download') :
                           entitlement.catalog_item?.digital_subtype === 'pass' ? (t('buyer.library.actions.book') || 'Book') :
                           (t('buyer.library.actions.access') || 'Access')}
                        </Button>
                      </div>
                      {entitlement.catalog_item?.digital_subtype === 'pass' && (
                        <div className="text-xs text-muted-foreground">
                           {entitlement.uses_remaining !== null 
                             ? `${entitlement.uses_remaining} uses remaining`
                             : 'Unlimited uses'}
                        </div>
                      )}
                    </div>
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
