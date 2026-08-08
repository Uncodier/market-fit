import { Skeleton } from "@/app/components/ui/skeleton"
import { ArrowLeft, ShoppingCart, User } from "@/app/components/ui/icons"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"

export default function PdpLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Spacer for floating header */}
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        brand={
          <div className="flex items-center min-w-0">
            <button type="button" className={`${shellClasses.iconButton} shrink-0 md:mr-2`} disabled>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 border-l border-black/10 dark:border-white/10 pl-3 ml-1 min-w-0 overflow-hidden">
              <Skeleton className="w-6 h-6 rounded-full shrink-0" />
              <Skeleton className="h-4 w-20 max-w-full min-w-0" />
            </div>
          </div>
        }
        actions={
          <div
            data-commerce-shell-actions-core
            className="flex items-center justify-end gap-3 md:gap-4 min-w-0"
          >
            <div className="relative inline-flex shrink-0">
              <button type="button" className={shellClasses.iconButton} disabled>
                <ShoppingCart className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              className={`md:hidden ${shellClasses.iconButton}`}
              disabled
              aria-label="Account"
            >
              <User className="h-4 w-4" />
            </button>
            <div className="hidden md:flex w-8 h-8 min-w-8 rounded-full bg-muted items-center justify-center border border-border shrink-0 ml-0.5">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        }
      />

      <main className="flex-1 pb-24 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="w-full lg:w-[55%]">
              <Skeleton className="w-full aspect-[4/3] rounded-2xl" />
              <div className="grid grid-cols-4 gap-4 mt-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="w-full aspect-square rounded-xl" />
                ))}
              </div>
            </div>

            <div className="w-full lg:w-[45%] flex flex-col">
              <Skeleton className="w-24 h-6 rounded-full mb-4" />
              <Skeleton className="w-3/4 h-10 mb-4" />
              <div className="flex items-end gap-3 mb-6">
                <Skeleton className="w-32 h-10" />
                <Skeleton className="w-16 h-6 mb-1" />
              </div>
              <Skeleton className="w-full h-24 rounded-xl mb-8" />
              <Skeleton className="w-full h-14 rounded-xl mb-4" />
              <Skeleton className="w-full h-14 rounded-xl mb-8" />

              <div className="pt-8 border-t mt-8">
                <Skeleton className="w-1/3 h-8 mb-4 sm:mb-6" />
                <div className="border rounded-2xl sm:rounded-[1.5rem] overflow-hidden">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex border-b last:border-0">
                      <div className="w-1/3 bg-muted/30 p-4 sm:p-5 flex items-center">
                        <Skeleton className="w-3/4 h-4" />
                      </div>
                      <div className="w-2/3 p-4 sm:p-5 flex items-center">
                        <Skeleton className="w-5/6 h-5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
