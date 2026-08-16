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

      <main className="flex-1 w-full flex flex-col max-w-7xl mx-auto p-4 md:p-8">
        <div className="mb-8">
          <div className="bg-card border rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Skeleton className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl shrink-0" />
            <div className="flex-1 w-full">
              <Skeleton className="h-8 w-3/4 max-w-md mb-3" />
              <Skeleton className="h-4 w-full max-w-2xl mb-2" />
              <Skeleton className="h-4 w-2/3 max-w-xl" />
            </div>
          </div>
        </div>

        <div className="flex-1 w-full">
          {/* ReservationSlotPicker Skeleton */}
          <div className="relative w-full pb-8">
            <div className="flex flex-col md:flex-row md:items-stretch gap-8 lg:gap-12 w-full mt-4">
              {/* Calendar Side */}
              <div className="w-full md:w-[350px] lg:w-[400px] shrink-0 flex">
                <div className="bg-card border rounded-3xl p-6 shadow-sm w-full h-full">
                  <div className="flex items-center justify-between mb-8">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center mb-4">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
                      <div key={idx} className="text-sm font-bold text-muted-foreground uppercase py-2">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-y-3 gap-x-2 mt-4">
                    {Array.from({ length: 35 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-12 mx-auto rounded-full" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Time Slots Side */}
              <div className="flex-1 flex flex-col">
                <div className="bg-card border rounded-3xl p-6 shadow-sm flex-1 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <Skeleton className="h-7 w-48" />
                  </div>
                  <div className="flex-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
