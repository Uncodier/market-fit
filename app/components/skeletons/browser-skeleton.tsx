import { Skeleton } from "@/app/components/ui/skeleton"

export function BrowserSkeleton() {
  return (
    <div className="w-full h-full bg-card relative overflow-hidden">
      {/* Browser-like header */}
      <div className="border-b border-border p-3 bg-muted/50">
        <div className="flex items-center gap-2">
          {/* Browser controls */}
          <div className="flex gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-3 rounded-full" />
          </div>
          {/* Address bar */}
          <div className="flex-1 ml-4">
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
          {/* Browser actions */}
          <div className="flex gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </div>
      </div>

      {/* Browser content area */}
      <div className="p-4 space-y-4 h-full">
        {/* Navigation/header section */}
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="flex gap-4">
            <Skeleton className="h-8 w-24 rounded" />
            <Skeleton className="h-8 w-32 rounded" />
            <Skeleton className="h-8 w-28 rounded" />
          </div>
        </div>

        {/* Content blocks */}
        <div className="space-y-6">
          {/* Large content block */}
          <div className="space-y-2">
            <Skeleton className="h-6 w-2/3 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
          </div>

          {/* Grid layout simulation */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-3 w-2/3 rounded" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-3 w-4/5 rounded" />
            </div>
          </div>

          {/* Footer area */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-20 rounded" />
              <Skeleton className="h-8 w-24 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Loading overlay effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" 
           style={{
             backgroundSize: '200% 100%',
             animation: 'shimmer 2s infinite linear'
           }} />
      
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}