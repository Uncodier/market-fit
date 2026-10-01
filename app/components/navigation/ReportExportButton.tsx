"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/app/hooks/use-auth";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { getReportSection, isReportId } from "@/app/dashboard/report-sections";
import {
  subscribeReportExport,
  getReportExportSnapshot,
  getServerReportExportSnapshot,
} from "@/app/dashboard/export/report-export-store";
import { Button } from "../ui/button";
import { Download } from "../ui/icons";

export function ReportExportButton() {
  const snapshot = useSyncExternalStore(
    subscribeReportExport,
    getReportExportSnapshot,
    getServerReportExportSnapshot,
  );
  const { user, isLoading: authLoading } = useAuth();
  const { currentSite, isLoading: siteLoading } = useSite();
  const { t } = useLocalization();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reportParam = searchParams.get("tab");
  const report = pathname === "/costs" ? "costs" : isReportId(reportParam) ? reportParam : "performance";
  const section = getReportSection(report, searchParams.get("section"));
  const canExport = Boolean(
    !authLoading && !siteLoading && user?.id && currentSite?.id &&
    currentSite.id !== "default" && snapshot?.ready && snapshot.scopeKey &&
    snapshot.report === report && snapshot.section === section &&
    snapshot.siteId === currentSite.id && snapshot.userId === user.id,
  );

  const handleExport = () => {
    // A scope can be invalidated after render but before the click is handled.
    if (!canExport || !snapshot || getReportExportSnapshot() !== snapshot) return;

    try {
      snapshot.download();
      toast.success("Report exported successfully");
    } catch (error) {
      console.error("Error exporting report section:", error);
      toast.error("Failed to export report");
    }
  };

  if (pathname !== "/costs" && reportParam === "onboarding") return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex items-center gap-1"
      onClick={handleExport}
      disabled={!canExport}
      aria-label="Export current section (CSV)"
      title="Export current section (CSV)"
    >
      <Download className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">{t("layout.topbar.export") || "Export"}</span>
    </Button>
  );
}