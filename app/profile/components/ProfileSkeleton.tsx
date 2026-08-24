import { Skeleton } from "@/app/components/ui/skeleton"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardContent,
} from "@/app/components/ui/section-card"

export function ProfileSkeleton() {
  return (
    <div className="flex-1">
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 md:px-16 py-4 w-full">
          <div className="flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="px-4 md:px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <div className="space-y-4">
          <SectionCard>
            <SectionCardHeader>
              <Skeleton className="h-4 w-40" />
            </SectionCardHeader>
            <SectionCardContent className="space-y-4">
              <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                <div className="min-w-[240px] flex-shrink-0">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="w-[240px] h-[240px] rounded-full" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <Skeleton className="h-4 w-12 mb-2" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-12 mb-2" />
                    <Skeleton className="h-9 w-full rounded-md" />
                    <Skeleton className="h-3 w-32 mt-2" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-12 mb-2" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                </div>
              </div>
              <div>
                <Skeleton className="h-4 w-8 mb-2" />
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
            </SectionCardContent>
          </SectionCard>

          <SectionCard>
            <SectionCardHeader>
              <Skeleton className="h-4 w-32" />
            </SectionCardHeader>
            <SectionCardContent className="space-y-4">
              <div>
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
              <div>
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </SectionCardContent>
          </SectionCard>

          <SectionCard>
            <SectionCardHeader>
              <Skeleton className="h-4 w-32" />
            </SectionCardHeader>
            <SectionCardContent className="space-y-4">
              <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-52" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            </SectionCardContent>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
