"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSimpleRefreshPrevention } from "@/app/hooks/use-prevent-refresh";
import { useSite } from "@/app/context/SiteContext";
import { StickyHeader } from "@/app/components/ui/sticky-header";
import {
  ResponsiveTabsList,
} from "@/app/components/ui/responsive-tabs-list";
import { Tabs } from "@/app/components/ui/tabs";
import { SiteForm } from "@/app/components/settings/site-form";
import { type SiteFormValues } from "@/app/components/settings/form-schema";
import { adaptSiteToForm } from "@/app/components/settings/data-adapter";
import {
  handleSaveGeneral,
  handleSaveCompany,
  handleSaveBranding,
  handleSaveMarketing,
  handleSaveCustomerJourney,
  handleSaveSocial,
  handleSaveChannels,
  handleSaveActivities,
  handleSaveShop,
  handleSavePrinters,
} from "@/app/components/settings/save-handlers";
import { QuickNav } from "@/app/components/ui/quick-nav";
import { useLocalization } from "@/app/context/LocalizationContext";
import { ProcurementPage } from "@/app/purchases/procurement/components/procurement-page";
import { SettingsFormSkeleton } from "./settings-form-skeleton";
import { getSettingsTabs, resolveSettingsSegment } from "./settings-navigation";
import { useSettingsQuickNav } from "./use-settings-quick-nav";

export default function SettingsPage() {
  const { t } = useLocalization();
  const {
    currentSite,
    updateSite,
    isLoading,
    updateSettings,
    refreshSites,
  } = useSite();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [navigation, setNavigation] = useState(() => ({
    searchParams,
    segment: resolveSettingsSegment(searchParams.get("tab") || searchParams.get("segment")) || "general",
  }));
  // Apply new URL selections without resetting manually selected tabs on rerenders.
  if (navigation.searchParams !== searchParams) {
    setNavigation({
      searchParams,
      segment: resolveSettingsSegment(searchParams.get("tab") || searchParams.get("segment")) || navigation.segment,
    });
  }
  const activeSegment = navigation.segment;
  const setActiveSegment = (segment: string) => setNavigation({ searchParams, segment });
  const [formKey, setFormKey] = useState(0);
  const [, setIsSaving] = useState(false);
  const getCurrentSections = useSettingsQuickNav(t);

  useSimpleRefreshPrevention();

  // OAuth implicit callback finished server-side (synced Outstand accounts into settings)
  useEffect(() => {
    const oauthConnected = searchParams.get("oauth_connected");
    const oauthSite = searchParams.get("oauth_site");
    const oauthNetwork = searchParams.get("oauth_network");
    if (oauthConnected !== "1" || !oauthSite) return;
    if (!currentSite?.id) return;

    const stripOAuthParams = () => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("oauth_connected");
      params.delete("oauth_site");
      params.delete("oauth_network");
      const qs = params.toString();
      router.replace(qs ? `/settings?${qs}` : "/settings", { scroll: false });
    };

    if (oauthSite !== currentSite.id) {
      stripOAuthParams();
      return;
    }

    const label = oauthNetwork
      ? oauthNetwork.charAt(0).toUpperCase() + oauthNetwork.slice(1)
      : "Social";
    toast.success(`${label} account connected`, {
      description: "Your social settings have been updated.",
    });
    void refreshSites().catch(() => {}).then(() => setFormKey((key) => key + 1));
    stripOAuthParams();
  }, [searchParams, currentSite?.id, router, refreshSites]);

  // Debug log to verify refresh prevention status
  useEffect(() => {
    const logPreventionStatus = () => {
      const preventRefresh = sessionStorage.getItem("preventAutoRefresh");
      const justBecameVisible = sessionStorage.getItem("JUST_BECAME_VISIBLE");
      const justGainedFocus = sessionStorage.getItem("JUST_GAINED_FOCUS");

      console.log("🔍 Settings page prevention status:", {
        preventRefresh: preventRefresh === "true",
        justBecameVisible: justBecameVisible === "true",
        justGainedFocus: justGainedFocus === "true",
      });
    };

    // Log initial status
    logPreventionStatus();

    // Log status every few seconds for debugging
    const interval = setInterval(logPreventionStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  // Update form key only when the site ID actually changes (new site selected)
  // Use a ref to track the previous site ID to prevent unnecessary form resets
  const prevSiteIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentSite?.id && currentSite.id !== prevSiteIdRef.current) {
      console.log(
        "Settings: Site ID changed, updating formKey for site:",
        currentSite.id,
      );
      console.log("Settings: Previous site ID was:", prevSiteIdRef.current);
      setFormKey((prev) => prev + 1);
      prevSiteIdRef.current = currentSite.id;
    } else if (currentSite && currentSite.id === prevSiteIdRef.current) {
      console.log(
        "Settings: Same site ID, not updating formKey:",
        currentSite.id,
      );
    }
  }, [currentSite]);

  // Wrapper functions for save handlers
  const saveOptions = {
    currentSite: currentSite!,
    updateSite,
    updateSettings,
    refreshSites,
    setIsSaving,
    t,
  };

  const onSaveGeneral = async (data: SiteFormValues) => {
    if (!currentSite) return;
    await handleSaveGeneral(data, saveOptions);
  };

  const onSaveCompany = async (data: SiteFormValues) => {
    if (!currentSite) return;
    await handleSaveCompany(data, saveOptions);
  };

  const onSaveBranding = async (data: SiteFormValues) => {
    if (!currentSite) return;
    await handleSaveBranding(data, saveOptions);
  };

  const onSaveMarketing = async (data: SiteFormValues) => {
    if (!currentSite) return;
    await handleSaveMarketing(data, saveOptions);
  };

  const onSaveCustomerJourney = async (data: SiteFormValues) => {
    if (!currentSite) return;
    await handleSaveCustomerJourney(data, saveOptions);
  };

  const onSaveSocial = async (data: SiteFormValues) => {
    if (!currentSite) return;
    await handleSaveSocial(data, saveOptions);
  };

  const onSaveChannels = async (data: SiteFormValues) => {
    if (!currentSite) return false;
    return handleSaveChannels(data, saveOptions);
  };

  const onSaveActivities = async (data: SiteFormValues) => {
    if (!currentSite) return;
    await handleSaveActivities(data, saveOptions);
  };

  const onSaveShop = async (data: SiteFormValues) => {
    if (!currentSite) return;
    await handleSaveShop(data, saveOptions);
  };

  const onSavePrinters = async (data: SiteFormValues) => {
    if (!currentSite) return;
    await handleSavePrinters(data, saveOptions);
  };

  // Simple approach - just track when data changes
  const adaptedSiteData = useMemo(() => {
    if (!currentSite) return null;
    return adaptSiteToForm(currentSite);
  }, [currentSite]);

  const settingsTabs = getSettingsTabs(t);

  // Only show skeleton when initially loading, not when saving
  if (isLoading) {
    return (
      <div className="flex-1">
        {activeSegment !== "activities" && <StickyHeader>
          <div className="flex items-center justify-between px-4 md:px-16 w-full">
            <Tabs value={activeSegment} className="w-auto flex-1 max-w-full">
              <ResponsiveTabsList
                tabs={settingsTabs}
                activeTab={activeSegment}
                onTabChange={() => {}}
                className="h-8 p-0.5 bg-muted/30 rounded-full"
              />
            </Tabs>
          </div>
        </StickyHeader>}
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-4 md:px-16">
              <SettingsFormSkeleton segment={activeSegment} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentSite) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">
          {t("settings.empty.noSite") || "No site selected"}
        </p>
      </div>
    );
  }

  const showSettingsTabBar = activeSegment !== "activities";

  return (
    <div className="flex-1">
      {showSettingsTabBar ? (
        <StickyHeader>
          <div className="flex items-center justify-between px-4 md:px-16 w-full">
            <Tabs
              value={activeSegment}
              onValueChange={setActiveSegment}
              className="w-auto flex-1 max-w-full"
            >
              <ResponsiveTabsList
                tabs={settingsTabs}
                activeTab={activeSegment}
                onTabChange={setActiveSegment}
                className="h-8 p-0.5 bg-muted/30 rounded-full"
              />
            </Tabs>
          </div>
        </StickyHeader>
      ) : null}
      {activeSegment === "tenders" ? (
        <ProcurementPage screen="settings" embedded />
      ) : (
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-4 md:px-16">
              <SiteForm
                key={formKey}
                id="settings-form"
                initialData={adaptedSiteData || undefined}
                onSaveGeneral={onSaveGeneral}
                onSaveCompany={onSaveCompany}
                onSaveBranding={onSaveBranding}
                onSaveMarketing={onSaveMarketing}
                onSaveCustomerJourney={onSaveCustomerJourney}
                onSaveSocial={onSaveSocial}
                onSaveChannels={onSaveChannels}
                onSaveActivities={onSaveActivities}
                onSaveShop={onSaveShop}
                onSavePrinters={onSavePrinters}
                activeSegment={activeSegment}
                siteId={currentSite.id}
              />
            </div>
            <QuickNav sections={getCurrentSections(activeSegment)} />
          </div>
        </div>
      )}
    </div>
  );
}
