import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";

export function RegisterSummarySkeleton() {
  return (
    <div data-slot="register-summary-skeleton" aria-busy="true">
      <span role="status" className="sr-only">Loading register summary…</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="rounded-xl border p-5 space-y-3">
          <Skeleton className="h-4 w-40 max-w-full motion-reduce:animate-none" />
          <Skeleton className="h-10 w-48 max-w-full motion-reduce:animate-none" />
          <Skeleton className="h-3 w-3/4 motion-reduce:animate-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((item) => <div key={item} className="min-w-0 space-y-3 rounded-xl border p-4">
            <Skeleton className="h-3 w-3/4 motion-reduce:animate-none" />
            <Skeleton className="h-7 w-2/3 motion-reduce:animate-none" />
          </div>)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((item) => <div key={item} className="space-y-4 rounded-xl border p-4">
            <Skeleton className="h-4 w-1/2 motion-reduce:animate-none" />
            {[0, 1, 2, 3].map((row) => <div key={row} className="flex justify-between gap-4">
              <Skeleton className="h-3 w-1/2 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-1/4 motion-reduce:animate-none" />
            </div>)}
          </div>)}
        </div>
        {[0, 1].map((item) => <Skeleton key={item} className="h-12 w-full rounded-xl motion-reduce:animate-none" />)}
      </div>
    </div>
  );
}

export function RegisterSessionSkeleton() {
  return (
    <Card data-slot="register-session-skeleton" className="overflow-hidden">
      <CardHeader aria-hidden="true" className="space-y-3 border-b bg-muted/20 p-4 sm:p-5">
        <Skeleton className="h-5 w-40 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-3 w-2/3 motion-reduce:animate-none" />
      </CardHeader>
      <CardContent className="p-4 sm:p-5"><RegisterSummarySkeleton /></CardContent>
    </Card>
  );
}

export function RegisterDashboardSkeleton() {
  return (
    <div data-slot="register-dashboard-skeleton" className="space-y-4">
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-4 w-32 motion-reduce:animate-none" />
        <Skeleton className="h-11 w-full motion-reduce:animate-none" />
        <Skeleton className="h-3 w-3/4 motion-reduce:animate-none" />
        <Skeleton className="h-10 w-full motion-reduce:animate-none" />
      </div>
      <RegisterSessionSkeleton />
    </div>
  );
}

export function RegisterRefreshSkeleton() {
  return <div data-slot="register-refresh-skeleton" aria-busy="true">
    <span role="status" className="sr-only">Updating cash register…</span>
    <Skeleton aria-hidden="true" className="h-1 w-full motion-reduce:animate-none" />
  </div>;
}