import { Skeleton } from "@/app/components/ui/skeleton"
import { Menu, Search, ShoppingCart, User, CreditCard, Moon } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { CatalogListingCardSkeleton } from "@/app/components/commerce/CatalogListingCardSkeleton"

export default function ShopLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        mobileLeading={
          <button className={`md:hidden ${shellClasses.iconButton}`} disabled>
            <Menu className="h-6 w-6" />
          </button>
        }
        hideCenterOnMobile={false}
        brand={<Skeleton className="h-6 w-32 ml-2" />}
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

      {/* Shop hero — matches ShopHeroTrust proportions (mobile bleeds under chrome) */}
      <div className="bg-gray-900 text-white h-[520px] md:h-[450px] max-md:-mt-[88px] px-4 md:px-8 relative overflow-hidden flex items-end md:items-center">
        <div className="max-w-7xl mx-auto w-full relative z-10 text-center md:text-left flex flex-col items-center md:items-start pb-10 md:pb-0 max-md:pt-[88px]">
          <Skeleton className="h-12 md:h-16 w-3/4 max-w-2xl mb-6 bg-white/20" />
          <Skeleton className="h-6 w-1/2 max-w-xl mb-10 bg-white/20" />
          <Skeleton className="h-14 w-40 rounded-full bg-white/20" />
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 w-full">
        {/* Category chips */}
        <div className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center mb-8 pb-2">
          {[32, 24, 36, 28, 20].map((w, i) => (
            <Skeleton
              key={i}
              className="flex-shrink-0 h-9 rounded-full"
              style={{ width: `${w * 4}px` }}
            />
          ))}
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
