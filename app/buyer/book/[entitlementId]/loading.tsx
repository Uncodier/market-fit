import { Skeleton } from "@/app/components/ui/skeleton"
import { ArrowLeft, User } from "@/app/components/ui/icons"
import { CommerceShellHeader } from "@/app/components/commerce/CommerceShellHeader"

export default function BookLoading() {
  return (
    <div className="flex-1 flex flex-col bg-muted/30 min-h-screen">
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        brand={
          <div className="flex items-center text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <Skeleton className="w-12 h-5" />
          </div>
        }
        center={
          <Skeleton className="w-32 h-6" />
        }
        actions={
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 min-w-8 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        }
      />

      <main className="flex-1 w-full flex flex-col items-center justify-center max-w-5xl mx-auto p-4 md:p-8">
        <div className="grid md:grid-cols-3 gap-8 w-full mx-auto max-w-4xl mt-4">
          <div className="md:col-span-1 relative z-10 md:-mr-8 md:pr-8 md:h-[590px] overflow-y-auto no-scrollbar">
            <div className="space-y-6 flex flex-col justify-center items-center md:items-start text-center md:text-left min-h-full py-4 md:py-8">
              <div className="space-y-4 flex flex-col items-center md:items-start w-full">
              <Skeleton className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border border-primary/10 shadow-sm mb-2 shrink-0" />
              
              <div className="w-full">
                <Skeleton className="h-4 w-24 mx-auto md:mx-0 mb-3" />
                <Skeleton className="h-8 w-48 mx-auto md:mx-0" />
                <Skeleton className="h-6 w-16 mx-auto md:mx-0 mt-2" />
              </div>

              <div className="w-full flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>

              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6 mx-auto md:mx-0" />
              </div>
            </div>
          </div>
          </div>

          <div className="md:col-span-2 relative w-full overflow-visible z-0">
            {/* ReservationSlotPicker Skeleton */}
            <div className="bg-card border rounded-3xl p-6 shadow-sm flex flex-col h-[590px] w-full max-w-full">
              <div className="flex-1 flex flex-col w-full">
                <div className="flex items-center justify-between mb-6 px-1">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-7 w-32 mx-auto" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>

                <div className="grid grid-cols-7 gap-1 mb-4">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-4 mx-auto my-2" />
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-y-5 md:gap-y-6 gap-x-1 mt-4">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-11 sm:h-12 sm:w-12 mx-auto rounded-full" />
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
