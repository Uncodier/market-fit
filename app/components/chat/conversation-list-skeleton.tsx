import { Skeleton } from "@/app/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  conversationFilterHeaderClassName,
  conversationRowLayout,
  conversationSearchContentClassName,
  conversationSearchHeaderClassName,
} from "./conversation-list-layout"

function ConversationSkeleton() {
  return (
    <div className={conversationRowLayout.root}>
      <div className={conversationRowLayout.title}>
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <div className={cn(conversationRowLayout.preview, "flex items-center")}>
        <Skeleton className="h-3 w-[85%]" />
      </div>
      <div className={conversationRowLayout.metadata}>
        <div className={conversationRowLayout.details}>
          <Skeleton className="size-[15px] shrink-0 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="size-1 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-10 shrink-0" />
      </div>
    </div>
  )
}

export function ConversationListSkeleton({ label, withControls = false }: { label: string; withControls?: boolean }) {
  return <div className={cn("motion-reduce:[&_.animate-pulse]:animate-none", withControls && "flex h-full w-full flex-col")} role="status" aria-label={label} aria-busy="true">
    {withControls && (
      <div className={conversationSearchHeaderClassName}>
        <div className={conversationSearchContentClassName}>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    )}
    <div className={withControls ? "min-h-0 flex-1 overflow-auto" : undefined} aria-hidden="true">
      {withControls && (
        <div className={cn(conversationFilterHeaderClassName, "bg-background")}>
          <div className="flex h-8 shrink-0 items-center rounded-full bg-muted/30 p-0.5">
            {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="size-7 rounded-full" />)}
          </div>
        </div>
      )}
      <div className="pb-[200px]">
        {Array.from({ length: 5 }, (_, index) => <ConversationSkeleton key={index} />)}
      </div>
    </div>
  </div>
}
