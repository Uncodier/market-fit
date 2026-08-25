import { Skeleton } from "@/app/components/ui/skeleton"
import { Search, ShoppingCart, User, CreditCard, Moon } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { CatalogListingCardSkeleton } from "@/app/components/commerce/CatalogListingCardSkeleton"

export default function ShopLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        hideCenterOnMobile
        brand={<Skeleton className="h-6 w-32 ml-2" />}
        center={
          <div className="hidden md:block w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Skeleton className="w-full h-9 rounded-full" />
          </div>
        }
        actions={
          <div className="flex items-center justify-end gap-1 md:gap-3 min-w-0">
            <div className="md:hidden">
              <button
                type="button"
                className={`relative ${shellClasses.iconButton} !bg-muted/50`}
                disabled
                aria-hidden
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
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

      {/* Shop hero — matches ShopHeroTrust proportions */}
      <div className="bg-gray-900 text-white h-[580px] md:h-[550px] -mt-[88px] md:-mt-[104px] relative overflow-hidden flex items-center">
        <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 text-center md:text-left flex flex-col items-center md:items-start w-full pt-[88px] md:pt-[104px] pb-20">
          <Skeleton className="h-10 md:h-16 w-3/4 max-w-2xl mb-3 md:mb-6 bg-white/20" />
          <Skeleton className="h-5 md:h-7 w-1/2 max-w-xl mb-6 md:mb-10 bg-white/20" />
          
          <div className="md:hidden w-full max-w-md mb-5 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center justify-start gap-1.5 rounded-2xl bg-white/10 px-2 py-2.5">
                <Skeleton className="h-4 w-4 rounded-full bg-white/20 shrink-0" />
                <div className="w-full flex flex-col items-center gap-1 mt-0.5">
                  <Skeleton className="h-3 w-16 bg-white/20" />
                  <Skeleton className="h-2 w-12 bg-white/20" />
                </div>
              </div>
            ))}
          </div>
          
          <div className="md:hidden">
            <Skeleton className="h-14 w-40 rounded-full bg-white/20" />
          </div>
        </div>

        {/* Fulfillment skeleton at the bottom */}
        <div className="absolute inset-x-0 bottom-3 md:bottom-4 z-10">
          <div className="max-w-7xl mx-auto px-3 md:px-8">
            <div className="flex items-center justify-between md:grid w-full gap-2" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
              <div className="flex items-center gap-2 min-w-0 w-full md:w-[320px] md:max-w-none flex-1 md:flex-initial overflow-hidden">
                <Skeleton className="h-14 w-full md:w-64 rounded-full bg-white/20" />
                <div className="hidden md:block shrink-0 flex-none w-14 min-w-14">
                  <Skeleton className="h-14 w-14 rounded-full bg-white/20" />
                </div>
              </div>
              <div className="hidden md:flex justify-center items-center">
                <Skeleton className="h-14 w-40 rounded-full bg-white/20" />
              </div>
              <div className="shrink-0 flex-none w-14 min-w-14 md:min-w-0">
                <div className="md:hidden shrink-0 flex-none w-14 min-w-14">
                  <Skeleton className="h-14 w-14 rounded-full bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop trust strip */}
      <div className="hidden md:block bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center justify-center gap-2">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex flex-col items-center gap-1.5">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 w-full">
        {/* Category chips */}
        <div className="-mx-4 md:mx-0 mb-8 pb-2">
          <div className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center px-4 md:px-0 pb-2">
            {[32, 24, 36, 28, 20].map((w, i) => (
              <Skeleton
                key={i}
                className="flex-shrink-0 h-9 rounded-full"
                style={{ width: `${w * 4}px` }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-24" />
        </div>

        {/* Borderless listing grid — matches CatalogListingCard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <CatalogListingCardSkeleton key={i} />
          ))}
        </div>
      </main>

      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
          <div className="flex items-center gap-4">
            <CreditCard className="h-8 w-8 text-gray-300 dark:text-gray-700" />
            <Button variant="ghost" size="icon" disabled className="rounded-full">
              <Moon className="h-5 w-5 text-gray-500" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
