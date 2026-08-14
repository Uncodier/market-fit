import {
  SectionCard,
  SectionCardHeader,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Skeleton } from "@/app/components/ui/skeleton"
import { steps } from "./constants/onboarding-constants"

export function SiteOnboardingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center p-4">
      <div className="container max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div>
              <Skeleton className="h-9 w-full max-w-sm mb-3" />
              <Skeleton className="h-5 w-full max-w-md mb-2" />
              <Skeleton className="h-5 w-3/4 max-w-sm" />
            </div>

            <div className="space-y-4">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center gap-4 rounded-lg p-2">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-36 mb-1.5" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <SectionCard className="bg-card rounded-xl border shadow-lg overflow-hidden">
              <SectionCardHeader className="p-8 pb-6">
                <Skeleton className="h-7 w-48 mb-3" />
                <Skeleton className="h-5 w-40" />
              </SectionCardHeader>

              <SectionCardContent className="pb-12">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="w-[240px] h-[240px] rounded-lg" />
                    </div>
                  </div>
                </div>
              </SectionCardContent>

              <ActionFooter>
                <Skeleton className="h-11 w-28" />
                <Skeleton className="h-11 w-24" />
              </ActionFooter>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}
