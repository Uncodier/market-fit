import { Skeleton } from "@/app/components/ui/skeleton"
import { Menu, Search, ShoppingCart, User } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import Link from "next/link"

export default function MarketplaceLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Spacer for floating header */}
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        mobileLeading={
          <button className={`md:hidden ${shellClasses.iconButton}`} disabled>
            <Menu className="h-6 w-6" />
          </button>
        }
        brand={
          <div className="text-xl font-black tracking-tight text-primary">
            MARKETPLACE
          </div>
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

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-64 shrink-0 space-y-8 hidden md:block">
            <div>
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-lg" />
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex flex-col rounded-xl overflow-hidden border border-border bg-card">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="p-4 flex flex-col flex-1 space-y-4">
                    <div className="flex justify-between items-start">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="mt-auto pt-4 flex items-center justify-between">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-9 w-24 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
