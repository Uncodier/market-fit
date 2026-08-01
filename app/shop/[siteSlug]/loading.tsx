import { Skeleton } from "@/app/components/ui/skeleton"
import { Menu, Search, ShoppingCart, User, CreditCard, Moon } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"

export default function ShopLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Top Spacer for floating header */}
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        mobileLeading={
          <button className={`md:hidden ${shellClasses.iconButton}`} disabled>
            <Menu className="h-6 w-6" />
          </button>
        }
        brand={
          <Skeleton className="h-6 w-32 ml-2" />
        }
        center={
          <div className="w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Skeleton className="w-full h-9 rounded-full" />
          </div>
        }
        actions={
          <>
            <button className={`relative ${shellClasses.iconButton} h-9 px-3 gap-1.5`} disabled>
              <ShoppingCart className="h-4 w-4" />
              <Skeleton className="w-3 h-3 rounded-full" />
            </button>
            <div className="w-8 h-8 min-w-8 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm ml-1 shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          </>
        }
      />

      {/* Hero Section */}
      <div className="bg-gray-900 text-white h-[350px] md:h-[450px] px-4 md:px-8 relative overflow-hidden flex items-center">
        <div className="max-w-7xl mx-auto w-full relative z-10 text-center md:text-left flex flex-col items-center md:items-start">
          <Skeleton className="h-12 md:h-16 w-3/4 max-w-2xl mb-6 bg-white/20" />
          <Skeleton className="h-6 w-1/2 max-w-xl mb-10 bg-white/20" />
          <Skeleton className="h-14 w-40 rounded-full bg-white/20" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 w-full">
        {/* Categories Skeleton */}
        <div className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center mb-8 pb-2">
          <Skeleton className="flex-shrink-0 h-9 w-32 rounded-full" />
          <Skeleton className="flex-shrink-0 h-9 w-24 rounded-full" />
          <Skeleton className="flex-shrink-0 h-9 w-36 rounded-full" />
          <Skeleton className="flex-shrink-0 h-9 w-28 rounded-full" />
          <Skeleton className="flex-shrink-0 h-9 w-20 rounded-full" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Skeleton className="h-8 w-48" />
          
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-24" />
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex flex-col bg-card rounded-2xl border overflow-hidden shadow-sm">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="p-5 flex flex-col flex-1">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                
                <div className="mt-auto pt-2 mb-4">
                  <Skeleton className="h-7 w-24" />
                </div>
                
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </main>
      
      {/* Footer */}
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
