"use client"

import { Skeleton } from "@/app/components/ui/skeleton"

export function WorkflowSkeleton() {
  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-background">
      <div
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(currentColor 2px, transparent 2px)`,
          backgroundSize: "20px 20px",
        }}
      />

      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="relative w-[1200px] h-[800px] scale-75 md:scale-90 lg:scale-100 origin-center">
          <svg className="absolute inset-0 w-full h-full" style={{ overflow: "visible" }}>
            <path
              d="M 480 400 C 520 400, 520 180, 560 180"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground/20"
            />
            <path
              d="M 480 400 C 520 400, 520 560, 560 560"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground/20"
            />
          </svg>

          <div className="absolute top-[220px] left-[0px] w-[480px]">
            <WorkflowTriggerCardSkeleton />
          </div>

          <div className="absolute top-[40px] left-[560px] w-[480px]">
            <WorkflowStepCardSkeleton />
          </div>

          <div className="absolute top-[420px] left-[560px] w-[480px]">
            <WorkflowStepCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

function Port({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left"
  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-background border-2 rounded-full flex items-center justify-center z-20 ${
        isLeft ? "-left-3 border-muted-foreground" : "-right-3 border-primary"
      }`}
      aria-hidden
    >
      <div className={`w-1.5 h-1.5 rounded-full ${isLeft ? "bg-muted-foreground" : "bg-primary"}`} />
    </div>
  )
}

function WorkflowTriggerCardSkeleton() {
  return (
    <div className="w-full relative overflow-visible bg-card/95 backdrop-blur-sm border-2 border-black/5 dark:border-white/10 rounded-3xl p-5 shadow-sm">
      <Port side="right" />
      <div className="flex items-center bg-muted/50 p-1 rounded-2xl gap-1 mb-3">
        <Skeleton className="h-7 flex-1 rounded-full" />
        <Skeleton className="h-7 flex-1 rounded-full" />
        <Skeleton className="h-7 flex-1 rounded-full" />
        <Skeleton className="h-7 flex-1 rounded-full" />
      </div>
      <div className="rounded-2xl bg-muted/30 p-3 flex flex-col gap-3">
        <Skeleton className="h-9 w-full rounded-full" />
        <Skeleton className="h-[72px] w-full rounded-3xl" />
        <Skeleton className="h-9 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function WorkflowStepCardSkeleton() {
  return (
    <div className="w-full relative overflow-visible bg-card/95 backdrop-blur-sm border-2 border-black/5 dark:border-white/10 rounded-3xl p-5 shadow-sm">
      <Port side="left" />
      <Port side="right" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full rounded-full" />
        <div className="flex items-center bg-muted/50 p-1 rounded-2xl gap-1">
          <Skeleton className="h-7 flex-1 rounded-full" />
          <Skeleton className="h-7 flex-1 rounded-full" />
          <Skeleton className="h-7 flex-1 rounded-full" />
          <Skeleton className="h-7 flex-1 rounded-full" />
          <Skeleton className="h-7 flex-1 rounded-full" />
        </div>
        <div className="rounded-2xl bg-muted/30 p-3 flex flex-col gap-2">
          <Skeleton className="h-[72px] w-full rounded-3xl" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-9 w-full rounded-full" />
            <Skeleton className="h-9 w-full rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
