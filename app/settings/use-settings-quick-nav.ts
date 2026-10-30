"use client";

import { useState, useEffect } from "react";
import type { QuickNavSection } from "@/app/components/ui/quick-nav";
import { getGeneralSections, getCompanySections, getMarketplaceSections, getVisitsSections, getChannelsSections, getInitialSocialSections, getInitialTeamSections, getInitialCopywritingSections, getActivitiesSections, getCalendarSections, getSecretsSections, getPrintersSections } from "./settings-navigation";

export function useSettingsQuickNav(t: (key: string) => string) {
  const [teamSections, setTeamSections] = useState<QuickNavSection[]>(
    getInitialTeamSections(t),
  );
  const [, setCopywritingSections] = useState<
    QuickNavSection[]
  >(getInitialCopywritingSections(t));
  const [socialSections, setSocialSections] = useState<QuickNavSection[]>(
    getInitialSocialSections(t),
  );
  const [companySectionsState, setCompanySectionsState] = useState<
    QuickNavSection[]
  >(getCompanySections(t));
  const [printersSections, setPrintersSections] = useState<QuickNavSection[]>(
    getPrintersSections(t),
  );
  const [channelsSections, setChannelsSections] = useState<QuickNavSection[]>(
    getChannelsSections(t),
  );


  // Listen for team members updates
  useEffect(() => {
    const handleTeamMembersUpdate = (event: CustomEvent) => {
      const members = event.detail as { id: string; title: string }[];
      setTeamSections([
        {
          id: "team-members",
          title: t("settings.nav.teamMembers") || "Team Members",
          children: members,
        },
      ]);
    };

    window.addEventListener(
      "teamMembersUpdated",
      handleTeamMembersUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "teamMembersUpdated",
        handleTeamMembersUpdate as EventListener,
      );
    };
  }, [t]);

  useEffect(() => {
    const handleSupportChannelsUpdate = (event: CustomEvent) => {
      const channels = event.detail as QuickNavSection[];
      setChannelsSections(getChannelsSections(t, channels));
    };

    window.addEventListener(
      "supportChannelsUpdated",
      handleSupportChannelsUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "supportChannelsUpdated",
        handleSupportChannelsUpdate as EventListener,
      );
    };
  }, [t]);

  // Listen for business hours updates
  useEffect(() => {
    const handleBusinessHoursUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setCompanySectionsState((prev) =>
        prev.map((section) => {
          if (section.id === "business-hours") {
            return { ...section, children: items };
          }
          return section;
        }),
      );
    };

    window.addEventListener(
      "businessHoursUpdated",
      handleBusinessHoursUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "businessHoursUpdated",
        handleBusinessHoursUpdate as EventListener,
      );
    };
  }, []);

  // Listen for office locations updates
  useEffect(() => {
    const handleOfficeLocationsUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setCompanySectionsState((prev) =>
        prev.map((section) => {
          if (section.id === "office-locations") {
            return { ...section, children: items };
          }
          return section;
        }),
      );
    };

    window.addEventListener(
      "officeLocationsUpdated",
      handleOfficeLocationsUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "officeLocationsUpdated",
        handleOfficeLocationsUpdate as EventListener,
      );
    };
  }, []);

  // Listen for service available restrictions updates
  useEffect(() => {
    const handleServiceAvailableRestrictionsUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setCompanySectionsState((prev) =>
        prev.map((section) => {
          if (section.id === "service-available-restrictions") {
            return { ...section, children: items };
          }
          return section;
        }),
      );
    };

    window.addEventListener(
      "serviceAvailableRestrictionsUpdated",
      handleServiceAvailableRestrictionsUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "serviceAvailableRestrictionsUpdated",
        handleServiceAvailableRestrictionsUpdate as EventListener,
      );
    };
  }, []);

  // Listen for service exclusions addresses updates
  useEffect(() => {
    const handleServiceExclusionsAddressesUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setCompanySectionsState((prev) =>
        prev.map((section) => {
          if (section.id === "service-exclusions-addresses") {
            return { ...section, children: items };
          }
          return section;
        }),
      );
    };

    window.addEventListener(
      "serviceExclusionsAddressesUpdated",
      handleServiceExclusionsAddressesUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "serviceExclusionsAddressesUpdated",
        handleServiceExclusionsAddressesUpdate as EventListener,
      );
    };
  }, []);

  // Listen for copywriting updates
  useEffect(() => {
    const handleCopywritingUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setCopywritingSections([
        {
          id: "copywriting-collection",
          title: t("settings.nav.copySequences") || "Copy Sequences",
          children: items,
        },
      ]);
    };

    window.addEventListener(
      "copywritingUpdated",
      handleCopywritingUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "copywritingUpdated",
        handleCopywritingUpdate as EventListener,
      );
    };
  }, [t]);

  // Listen for social networks updates
  useEffect(() => {
    const handleSocialNetworksUpdate = (event: CustomEvent) => {
      const networks = event.detail as { id: string; title: string }[];
      setSocialSections([
        {
          id: "social-networks-section",
          title: t("settings.nav.socialNetworks") || "Social Networks",
          children: networks,
        },
      ]);
    };

    window.addEventListener(
      "socialNetworksUpdated",
      handleSocialNetworksUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "socialNetworksUpdated",
        handleSocialNetworksUpdate as EventListener,
      );
    };
  }, [t]);

  // Listen for printers updates
  useEffect(() => {
    const handlePrintersUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setPrintersSections([
        {
          id: "printers",
          title: t("settings.nav.printers") || "Printers",
          children: items,
        },
      ]);
    };

    window.addEventListener(
      "printersUpdated",
      handlePrintersUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        "printersUpdated",
        handlePrintersUpdate as EventListener,
      );
    };
  }, [t]);

  // Get current sections based on active segment
  const getCurrentSections = (activeSegment: string): QuickNavSection[] => {
    switch (activeSegment) {
      case "general":
        return getGeneralSections(t);
      case "company":
        return getCompanySections(t).map((section) => {
          const existing = companySectionsState.find((item) => item.id === section.id);
          return existing?.children?.length ? { ...section, children: existing.children } : section;
        });
      case "channels":
        return getChannelsSections(t, channelsSections[0]?.children || []);
      case "team":
        return teamSections;
      case "activities":
        return getActivitiesSections(t);
      case "marketplace":
        return getMarketplaceSections(t);
      case "visits":
        return getVisitsSections(t);
      case "social":
        return socialSections;
      case "calendar":
        return getCalendarSections(t);
      case "secrets":
        return getSecretsSections(t);
      case "printers":
        return printersSections;
      default:
        return [];
    }
  };

  return getCurrentSections;
}
