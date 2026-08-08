import { Skeleton } from "@/app/components/ui/skeleton"

export function SaleInvoiceSkeleton() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-card dark:bg-card rounded-lg shadow-lg overflow-hidden border border-border dark:border-border" style={{
        boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
        background: "var(--card)"
      }}>
        <div className="p-6 border-b border-border dark:border-border bg-muted/50 dark:bg-muted/10">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6 p-6 border-b border-border dark:border-border">
          <div>
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-5 w-36 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-5 w-36 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="p-6 border-b border-border dark:border-border">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="bg-muted/50 dark:bg-muted/10 p-4 rounded-md mb-6">
            <div className="grid md:grid-cols-3 gap-4 text-center">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-16 mx-auto mb-2" />
                  <Skeleton className="h-6 w-24 mx-auto" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[0, 1].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-36 mb-2" />
                <div className="border border-border dark:border-border rounded-md p-4">
                  <Skeleton className="h-12 w-full mb-2" />
                  <Skeleton className="h-12 w-full mb-2" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 border-b border-border dark:border-border">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
        <div className="p-6 bg-muted/50 dark:bg-muted/10">
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  )
}
