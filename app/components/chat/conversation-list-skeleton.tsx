import { Skeleton } from "@/app/components/ui/skeleton"

function ConversationSkeleton() {
  return (
    <div className="w-full text-left py-3 px-4 rounded-none border-b dark:border-white/5 border-black/5" style={{ boxSizing: 'border-box' }}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Skeleton className="h-4 w-[60%]" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      </div>
      <div className="mt-1">
        <Skeleton className="h-3 w-[85%]" />
      </div>
      <div className="flex justify-between items-center mt-2">
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-1" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  )
}

export function ConversationListSkeleton({ label }: { label: string }) {
  return <div className="pb-[200px] motion-reduce:[&_.animate-pulse]:animate-none" role="status" aria-label={label} aria-busy="true">
    {Array.from({ length: 5 }, (_, index) => <ConversationSkeleton key={index} />)}
  </div>
}
