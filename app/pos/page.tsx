"use client";

import { useSite } from "@/app/context/SiteContext";
import { useAuthContext } from "@/app/components/auth/auth-provider";
import { usePosLocationAccess } from "./hooks/use-pos-location-access";
import PosWorkspace from "./PosWorkspace";
import { PosWorkspaceSkeleton } from "./components/PosWorkspaceSkeleton";
import { Button } from "@/app/components/ui/button";

const ACCESS_ERRORS = {
  offline: "Your browser reports that it is offline. Reconnect to verify POS access.",
  session: "Your session could not be verified. Retry the access check or sign in again.",
  permission: "Your current site permissions could not be verified. Retry or contact your site administrator.",
  storage: "POS device storage could not be prepared. Check that browser storage is available and retry.",
  timeout: "POS access verification timed out. Retry the access check.",
  context: "Your account or current site did not finish loading. Retry or select your site again.",
};

export default function POSPage() {
  const { currentSite } = useSite();
  const { user, isLoading } = useAuthContext();
  const access = usePosLocationAccess(currentSite?.id, user?.id, isLoading);

  // No catalog, draft, or sync hook can run before actor + site verification.
  if (access.status === "allowed" && access.lease) {
    return <PosWorkspace key={`${access.lease.userId}:${access.lease.siteId}:${access.lease.generation}`} />;
  }
  if (access.status === "checking") return <PosWorkspaceSkeleton />;
  return (
    <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-lg font-medium">
        POS unavailable
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        {access.status === "restricted"
          ? "POS is not supported for members with location exclusions."
          : access.reason ? ACCESS_ERRORS[access.reason] : "POS access could not be verified. Please retry."}
      </p>
      {access.status === "unavailable" && access.retry && (
        <Button variant="outline" onClick={access.retry}>Retry access check</Button>
      )}
      <p className="max-w-xl text-sm text-muted-foreground">
        Changing account or site access clears this device’s POS cache, unsent drafts, and queued operations.
        Check server orders and payments before retrying any unconfirmed transaction.
      </p>
    </div>
  );
}