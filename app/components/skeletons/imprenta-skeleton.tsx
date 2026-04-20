"use client"

import { Skeleton } from "@/app/components/ui/skeleton"
import { useLayout } from "@/app/context/LayoutContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"

export function ImprentaSkeleton() {
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const sidebarWidth = isMobile ? 0 : isLayoutCollapsed ? 64 : 256
  /** ImprentaPanel uses width calc(100% + sidebarWidth) and negative marginLeft; flex-center is offset from the visible viewport. */
  const viewportRecenterPx = sidebarWidth / 2

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-background">
      {/* Background Dots Canvas Simulation */}
      <div 
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(currentColor 2px, transparent 2px)`,
          backgroundSize: '20px 20px',
        }}
      />

      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none overflow-hidden">
        <div style={{ transform: `translateX(${viewportRecenterPx}px)` }}>
          <div className="relative w-[1200px] h-[800px] scale-75 md:scale-90 lg:scale-100 origin-center">
            {/* Skeleton lines connecting nodes */}
            <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
              {/* From Left Top to Center */}
              <path d="M 480 200 C 530 200, 670 400, 720 400" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/20" />
              {/* From Left Bottom to Center */}
              <path d="M 480 600 C 530 600, 670 400, 720 400" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/20" />
            </svg>

            {/* Node 1 (Top Left) */}
            <div className="absolute top-[50px] left-[0px] w-[480px]">
               <ImprentaCardSkeleton />
            </div>

            {/* Node 2 (Bottom Left) */}
            <div className="absolute top-[450px] left-[0px] w-[480px]">
               <ImprentaCardSkeleton />
            </div>

            {/* Node 3 (Center) */}
            <div className="absolute top-[250px] left-[720px] w-[480px]">
               <ImprentaCardSkeleton result />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImprentaCardSkeleton({ result = false }: { result?: boolean }) {
  return (
    <div className="w-full relative overflow-hidden bg-card/95 backdrop-blur-sm border-2 border-black/5 dark:border-white/10 rounded-3xl p-5 shadow-sm space-y-4">
      {/* Floating background orbs from fancy empty card */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute bg-violet-500/25 rounded-full blur-2xl animate-pulse" style={{ top: '25.4%', left: '12.3%', width: '114px', height: '114px', animationDelay: '1.2s' }}></div>
        <div className="absolute bg-indigo-500/20 rounded-full blur-2xl animate-pulse" style={{ top: '68.1%', left: '45.7%', width: '88.4px', height: '88.4px', animationDelay: '0.5s' }}></div>
        <div className="absolute bg-purple-500/22 rounded-full blur-2xl animate-pulse" style={{ top: '15.8%', left: '63.2%', width: '73.6px', height: '73.6px', animationDelay: '2.1s' }}></div>
        <div className="absolute bg-pink-500/24 rounded-full blur-xl animate-pulse" style={{ top: '42.6%', left: '28.9%', width: '66.8px', height: '66.8px', animationDelay: '1.8s' }}></div>
        <div className="absolute bg-emerald-500/18 rounded-full blur-xl animate-pulse" style={{ top: '58.3%', left: '74.5%', width: '49.2px', height: '49.2px', animationDelay: '0.9s' }}></div>
        <div className="absolute bg-cyan-500/19 rounded-full blur-xl animate-pulse" style={{ top: '31.2%', left: '56.4%', width: '79.2px', height: '79.2px', animationDelay: '2.5s' }}></div>
      </div>

      <div className="relative z-10 flex items-center justify-between">
         <Skeleton className="h-3 w-20 rounded uppercase" />
         {result && <Skeleton className="h-4 w-16 rounded-full" />}
      </div>
      
      {!result ? (
        <div className="relative z-10">
          <div className="flex gap-2 bg-muted/50 p-1 rounded-2xl mb-4">
             <Skeleton className="h-7 flex-1 rounded-full" />
             <Skeleton className="h-7 flex-1 rounded-full" />
             <Skeleton className="h-7 flex-1 rounded-full" />
             <Skeleton className="h-7 flex-1 rounded-full" />
          </div>

          <Skeleton className="h-[100px] w-full rounded-xl mb-4" />

          <div className="pt-3 border-t border-black/5 dark:border-white/5 flex gap-2 w-full">
             <Skeleton className="h-8 flex-1 rounded-md" />
          </div>
        </div>
      ) : (
        <div className="relative z-10">
          <Skeleton className="h-[200px] w-full rounded-xl mb-4" />
          <div className="pt-3 border-t border-black/5 dark:border-white/5 flex gap-2 w-full">
             <Skeleton className="h-8 flex-1 rounded-md" />
             <Skeleton className="h-8 flex-1 rounded-md" />
             <Skeleton className="h-8 flex-1 rounded-md" />
          </div>
        </div>
      )}
    </div>
  )
}
