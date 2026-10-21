"use client";

import { useSite } from "@/app/context/SiteContext";
import { useAuthContext } from "@/app/components/auth/auth-provider";
import { usePosLocationAccess } from "./hooks/use-pos-location-access";
import PosWorkspace from "./PosWorkspace";

export default function POSPage() {
  const { currentSite } = useSite();
  const { user, isLoading } = useAuthContext();
  const access = usePosLocationAccess(currentSite?.id, user?.id, isLoading);

  // No catalog, draft, or sync hook can run before actor + site verification.
  if (access.status === "allowed" && access.lease) {
    return <PosWorkspace key={`${access.lease.userId}:${access.lease.siteId}:${access.lease.generation}`} />;
  }
  return (
    <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-lg font-medium">
        {access.status === "checking" ? "Checking POS access…" : "POS unavailable"}
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        {access.status === "restricted"
          ? "POS is not supported for members with location exclusions."
          : "An online connection and current site permission are required. Cached POS data is not available offline."}
      </p>
      <p className="max-w-xl text-sm text-muted-foreground">
        Changing account or site access clears this device’s POS cache, unsent drafts, and queued operations.
        Check server orders and payments before retrying any unconfirmed transaction.
      </p>
    </div>
  );
}