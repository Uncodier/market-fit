"use client"

import { Card, CardContent } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ActionFooter } from "@/app/components/ui/card-footer"

export function VisitFormSkeleton() {
  return (
    <div className="max-w-4xl w-full mx-auto">
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6 flex flex-col justify-center items-center md:items-start text-center md:text-left bg-background relative z-10 md:-mr-8 md:pr-8">
          <div className="flex items-center justify-center md:justify-start gap-3 w-full">
            <Skeleton className="h-10 w-10 rounded" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="space-y-4 flex flex-col items-center md:items-start w-full">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="w-full flex flex-col items-center md:items-start gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="flex items-center justify-center md:justify-start gap-2 w-full">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-2 w-full flex flex-col items-center md:items-start">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>

        <div className="md:col-span-2 relative w-full overflow-visible z-0">
          <Card className="bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col w-full md:w-[590px] md:max-w-full">
            <CardContent className="p-6 flex-1 flex flex-col space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <div className="space-y-4 flex-1">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
              </div>
            </CardContent>
            <ActionFooter>
              <Skeleton className="h-10 w-full rounded-full" />
            </ActionFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
