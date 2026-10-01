"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "../ui/button";
import { PlusCircle, Bot, Globe, LogOut } from "../ui/icons";
import { CreateTaskDialog } from "../create-task-dialog";
import { RobotPrimaryActions } from "./RobotPrimaryActions";
import { ReportExportButton } from "./ReportExportButton";
import { TopBarCreationActions } from "./TopBarCreationActions";
import { TopBarCommerceActions } from "./TopBarCommerceActions";
import { TopBarFinanceActions } from "./TopBarFinanceActions";
import type { TopBarActionsProps } from "./topbar-action-types";

export function TopBarActions(props: TopBarActionsProps) {
  const { isDashboardPage, isControlCenterPage, isRobotsPage, requirementData, viewMode } = props;
  const { t } = useLocalization();
  const { currentSite } = useSite();
  const pathname = usePathname();
  // Handle logout function
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      toast.loading(t("layout.topbar.signingOut"));

      const supabase = createClient();
      await supabase.auth.signOut();

      window.location.href = "/api/auth/logout";
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Error signing out");

      window.location.href = "/api/auth/logout";
    }
  };

  return (
    <div className="flex items-center gap-4">
      {pathname.startsWith("/content/") &&
        pathname !== "/content/deepResearch" && (
          <Button
            variant="default"
            className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            title={t("layout.topbar.publishToSocial") || "Publish"}
            onClick={() =>
              window.dispatchEvent(new CustomEvent("content:publish"))
            }
          >
            <Globe className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline font-inter font-medium text-sm">
              {t("layout.topbar.publishToSocial") || "Publish"}
            </span>
          </Button>
        )}

      {isControlCenterPage && currentSite ? (
        <CreateTaskDialog
          trigger={
            <Button
              className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
              title={t("layout.topbar.newTask")}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline ml-2">
                {t("layout.topbar.newTask")}
              </span>
            </Button>
          }
        />
      ) : null}

      {(isDashboardPage || pathname === "/costs") && currentSite && <ReportExportButton />}

      {/* Requirement Detail Page Build Button */}
      {requirementData && currentSite && (
        <Button
          variant="default"
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("requirement:build-trigger"));
          }}
          disabled={requirementData.isBuilding}
          title={
            requirementData.hasRequirementStatus
              ? "Rebuild Requirement"
              : "Build Requirement"
          }
        >
          {requirementData.isBuilding ? (
            <>
              <div className="h-4 w-4 animate-pulse bg-primary-foreground/50 rounded" />
              <span className="hidden sm:inline font-inter font-medium text-sm">
                Building...
              </span>
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline font-inter font-medium text-sm">
                {requirementData.hasRequirementStatus
                  ? "Rebuild Requirement"
                  : "Build Requirement"}
              </span>
            </>
          )}
        </Button>
      )}
      <TopBarCreationActions {...props} />
      <TopBarCommerceActions {...props} />
      {isRobotsPage && currentSite ? (
        <RobotPrimaryActions currentSite={currentSite} viewMode={viewMode} />
      ) : null}
      <TopBarFinanceActions {...props} />

      {/* Logout button in toolbar - only visible on profile page */}
      {pathname.startsWith("/profile") && (
        <Button
          variant="default"
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={handleLogout}
          title={
            isLoggingOut
              ? t("layout.topbar.signingOut")
              : t("layout.topbar.logOut")
          }
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm pt-0.5">
            {isLoggingOut
              ? t("layout.topbar.signingOut")
              : t("layout.topbar.logOut")}
          </span>
        </Button>
      )}
    </div>
  );
}
