"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";

export function PosLocalReadNotice({ catalogError, ordersError, ready, retry }: {
  catalogError: boolean;
  ordersError: boolean;
  ready: boolean;
  retry: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);
  if (!catalogError && !ordersError) return null;
  return (
    <div role="status" className="m-4 flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <p>{catalogError
        ? ready
          ? "Catalog refresh is delayed. Your last loaded catalog is still available."
          : "Local catalog data could not be loaded. Checkout will remain unavailable until it recovers."
        : "Order or customer refresh is delayed. The catalog is still available; these lists may be outdated."}</p>
      <Button variant="outline" disabled={retrying} onClick={async () => {
        setRetrying(true);
        try { await retry(); } finally { setRetrying(false); }
      }}>{retrying ? "Retrying…" : "Retry local data"}</Button>
    </div>
  );
}