"use client";

import { useSite } from "@/app/context/SiteContext";
import { useAuthContext } from "@/app/components/auth/auth-provider";
import { usePosLocationAccess } from "./hooks/use-pos-location-access";
import PosWorkspace from "./PosWorkspace";
import { PosWorkspaceSkeleton } from "./components/PosWorkspaceSkeleton";
import { Button } from "@/app/components/ui/button";
import { useLocalization } from "@/app/context/LocalizationContext";

const ACCESS_ERRORS = {
  offline: "pos.access.offline",
  session: "pos.access.session",
  permission: "pos.access.permission",
  storage: "pos.access.storage",
  timeout: "pos.access.timeout",
  context: "pos.access.context",
};

export default function POSPage() {
  const { t } = useLocalization();
  const { currentSite, refreshSites } = useSite();
  const { user, isLoading } = useAuthContext();
  const access = usePosLocationAccess(currentSite?.id, user?.id, isLoading);
  const retryAccess = () => {
    // Retrying the permission hook alone cannot restore an unhydrated site.
    // Reload authorized sites; never infer authorization from a stored site ID.
    if (!currentSite?.id && user?.id) void refreshSites({ recoverMissingSite: true });
    access.retry?.();
  };

  // No catalog, draft, or sync hook can run before actor + site verification.
  if (access.status === "allowed" && access.lease) {
    return <PosWorkspace key={`${access.lease.userId}:${access.lease.siteId}:${access.lease.generation}`} />;
  }
  if (access.status === "checking") return <PosWorkspaceSkeleton />;
  return (
    <div role="status" className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-lg font-medium">
        {t("pos.access.unavailable")}
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        {access.status === "restricted"
          ? t("pos.access.restricted")
          : access.reason ? t(ACCESS_ERRORS[access.reason]) : t("pos.access.unverified")}
      </p>
      {access.reason === "storage" && access.diagnostic && (
        <code className="text-xs text-muted-foreground">{access.diagnostic}</code>
      )}
      {access.status === "unavailable" && access.retry && (
        <Button variant="outline" onClick={retryAccess}>{t("pos.access.retry")}</Button>
      )}
      <p className="max-w-xl text-sm text-muted-foreground">
        {t("pos.access.cacheWarning")}
      </p>
    </div>
  );
}