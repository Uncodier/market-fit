import { Skeleton } from "@/app/components/ui/skeleton"
import { Search, ShoppingCart, User } from "@/app/components/ui/icons"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { CatalogListingCardSkeleton } from "@/app/components/commerce/CatalogListingCardSkeleton"

export default function MarketplaceLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        hideCenterOnMobile={false}
        brand={
          <>
            <Skeleton className="h-6 w-6 rounded-md md:hidden" />
            <div className="hidden md:block text-xl font-black tracking-tight text-primary">
              MARKETPLACE
            </div>
          </>
        }
        center={
          <>
            <Skeleton className="md:hidden h-9 w-full min-w-9 rounded-full" />
            <div className="hidden md:block w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Skeleton className="w-full h-9 rounded-full" />
            </div>
          </>
        }
        actions={
          <div className="flex items-center justify-end gap-1 md:gap-3 min-w-0">
            <button
              className={`relative ${shellClasses.iconButton} h-9 px-3 gap-1.5 border-0 !min-w-0`}
              disabled
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
            <div className="w-8 h-8 min-w-8 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm ml-1 shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        }
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Desktop filter sidebar */}
          <aside className="w-full md:w-64 shrink-0 space-y-8 hidden md:block sticky top-28">
            <div>
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0 w-full">
            {/* Mobile chips only */}
            <div className="md:hidden sticky top-[72px] z-30 -mx-4 px-4 pt-1 pb-3 mb-6">
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-9 w-28 rounded-full shrink-0" />
                ))}
              </div>
            </div>

            {/* 3-col grid beside sidebar — matches marketplace maxCols={3} */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <CatalogListingCardSkeleton key={i} showSeller />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
