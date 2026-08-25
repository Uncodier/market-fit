import { Skeleton } from "@/app/components/ui/skeleton"
import { ArrowLeft, ShoppingCart, User } from "@/app/components/ui/icons"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"

export function PdpModifierSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mb-8 sm:mb-10 space-y-4">
      <Skeleton className="h-6 w-36" />
      <div className="space-y-1.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-5 w-5 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Route-level PDP placeholder — matches ProductPdpLayout (gallery, price, description, modifiers). */
export function PdpPageSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
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
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16 pb-32 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20">
            <div>
              <Skeleton className="w-full aspect-[4/5] rounded-[2rem]" />
              <div className="flex gap-3 sm:gap-4 mt-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="aspect-square w-20 sm:w-24 rounded-2xl shrink-0" />
                ))}
              </div>
            </div>

            <div className="flex flex-col py-0 sm:py-4 lg:py-8">
              <div className="mb-8 sm:mb-10">
                <Skeleton className="h-8 w-24 rounded-full mb-4 sm:mb-6" />
                <Skeleton className="h-12 sm:h-16 w-3/4 mb-4 sm:mb-6" />
                <Skeleton className="h-10 sm:h-12 w-40 mb-4 sm:mb-6" />
                <div className="space-y-2 mt-4 sm:mt-6">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>

              <PdpModifierSkeleton rows={4} />

              <div className="hidden lg:block space-y-3">
                <Skeleton className="w-full h-14 rounded-xl" />
                <Skeleton className="w-full h-14 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/80 backdrop-blur-xl border-t p-4">
        <div className="flex gap-2 w-full">
          <Skeleton className="h-12 w-20 rounded-xl shrink-0" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
