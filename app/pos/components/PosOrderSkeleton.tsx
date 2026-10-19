import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { X } from "@/app/components/ui/icons";

export function PosOrderLinesSkeleton() {
  return (
    <div role="status" aria-label="Loading order items" className="space-y-3">
      <span className="sr-only">Loading order items</span>
      <div aria-hidden="true" className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-lg border p-2">
            <Skeleton className="h-16 w-16 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PosCartPanelSkeleton({
  isMobile,
  closeCart,
}: {
  isMobile?: boolean;
  closeCart?: () => void;
}) {
  return (
    <div role="status" aria-label="Loading order data" aria-busy="true" className="flex h-full flex-col overflow-hidden">
      <span className="sr-only">Loading order data</span>
      <div className="flex min-h-[71px] shrink-0 items-center gap-2 border-b bg-background/80 px-4">
        <Skeleton aria-hidden="true" className="h-10 flex-1" />
        {isMobile && closeCart && (
          <Button variant="ghost" size="icon" onClick={closeCart} aria-label="Close cart" className="md:hidden shrink-0">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <PosOrderLinesSkeleton />
      </div>
      <div aria-hidden="true" className="shrink-0 space-y-4 border-t bg-muted/30 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="flex justify-between border-t pt-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}