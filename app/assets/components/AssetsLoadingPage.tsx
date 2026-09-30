"use client"
import { Button } from "@/app/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { LayoutGrid, Image, FileVideo, FileText, ListOrdered } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { AssetCardSkeleton } from "./AssetCardSkeleton"

// Loading page component that doesn't use useSearchParams
export function AssetsLoadingPage() {
  const { t } = useLocalization()
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all">
        <StickyHeader>
          <div className="w-full pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                  <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                    <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('assets.tabs.all')}>
                      <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.all')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="images" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('assets.tabs.images')}>
                      <Image size={13} className="shrink-0 md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.images')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="videos" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('assets.tabs.videos')}>
                      <FileVideo size={13} className="shrink-0 md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.videos')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5" title={t('assets.tabs.documents')}>
                      <FileText size={13} className="shrink-0 md:!hidden" />
                      <span className="tab-label">{t('assets.tabs.documents')}</span>
                    </TabsTrigger>
                  </TabsList>
                  <SearchInput   
                    placeholder={t('assets.searchPlaceholder')}
                    
                    disabled  className="w-full h-10 md:h-9"  containerClassName="w-full" />
                <Button variant="secondary" size="sm" disabled aria-label="Sort assets">
                  <ListOrdered className="mr-2 h-4 w-4" />Newest
                </Button>
              </div>
              <div className="ml-auto">
                {/* Any other buttons would go here */}
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4 bg-muted/30 flex-1">
            <>
              <TabsContent value="all" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <AssetCardSkeleton key={index} />
                  ))}
                </div>
              </TabsContent>
            </>
        </div>
      </Tabs>
    </div>
  )
}

