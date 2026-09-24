import {
  SectionCard,
  SectionCardHeader,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Skeleton } from "@/app/components/ui/skeleton"
import { steps } from "./constants/onboarding-constants"

function IntroductionSkeleton() {
  return (
    <div>
      <Skeleton className="mb-3 h-9 w-full max-w-sm" />
      <Skeleton className="mb-2 h-5 w-full max-w-md" />
      <Skeleton className="h-5 w-3/4 max-w-sm" />
    </div>
  )
}

function FormContentSkeleton() {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {["name", "url", "description"].map((field) => (
            <div className="space-y-2" key={field}>
              <Skeleton className="h-4 w-28" />
              <Skeleton className={field === "description" ? "h-20 w-full" : "h-10 w-full"} />
            </div>
          ))}
        </div>
        <div className="flex justify-center pt-1 md:justify-end md:pr-4">
          <div className="w-full max-w-[200px] space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="aspect-square w-full rounded-lg" />
          </div>
        </div>
      </div>
      <div className="mt-8 space-y-4 rounded-xl border border-dashed p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-[88px] w-full rounded-md" />
      </div>
    </>
  )
}

export function SiteOnboardingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center p-4">
      <div className="container max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div />
        </div>

        <div className="space-y-6 lg:hidden">
          <IntroductionSkeleton />
          <SectionCard className="bg-card shadow-sm">
            <SectionCardHeader className="flex-row items-center gap-3 p-4">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </SectionCardHeader>
            <SectionCardContent className="border-t px-4 pb-8 pt-6">
              <FormContentSkeleton />
            </SectionCardContent>
            <ActionFooter className="px-4 py-4">
              <div />
              <Skeleton className="h-11 w-24" />
            </ActionFooter>
          </SectionCard>
          <div className="space-y-3">
            {steps.slice(1).map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
              >
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
            ))}
          </div>
        </div>

        <div className="hidden grid-cols-1 gap-8 lg:grid lg:grid-cols-3">
          <div className="space-y-6">
            <IntroductionSkeleton />

            <div className="flex flex-col">
              {steps.map((step, index) => (
                <div key={step.id}>
                  <div className="flex items-center gap-4 rounded-lg p-2">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Skeleton className="h-4 w-36 mb-1.5" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="ml-6 w-px h-5 bg-border my-1" />
                  )}
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
                <FormContentSkeleton />
              </SectionCardContent>

              <ActionFooter className="px-8 py-6">
                <div /> {/* Spacer for left side */}
                <Skeleton className="h-11 w-24" />
              </ActionFooter>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}
