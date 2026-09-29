"use client";

import { getSiteFormDefaults } from "./site-form-defaults";
import { useActivityHydration } from "./use-activity-hydration";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  siteFormSchema,
  type SiteFormValues,
  getFocusModeConfig,
} from "./form-schema";
import { GeneralSection } from "./GeneralSection";
import { WebResourcesSection } from "./WebResourcesSection";
import { CompanySection } from "./CompanySection";
import { BrandingSection } from "./BrandingSection";
import { MarketingSection } from "./MarketingSection";
import { ShopSection } from "./ShopSection";
import { PrintersSection } from "./PrintersSection";
import { VisitsSection } from "./VisitsSection";
import { CustomerJourneySection } from "./CustomerJourneySection";
import { SocialSection } from "./SocialSection";
import { ChannelsSection } from "./ChannelsSection";
import { createTrackingSnippet } from "./tracking-snippet";
import { TeamSection } from "./TeamSection";
import { BillingSection } from "./BillingSection";
import { ActivitiesSection } from "./ActivitiesSection";
import { CalendarSection } from "./CalendarSection";
import { SecretsSection } from "./SecretsSection";
import { useDropzone } from "react-dropzone";
import { cn } from "../../lib/utils";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import Image from "next/image";

import {
  AppWindow,
  Check,
  Copy,
  FileText,
  Globe,
  Link,
  PlusCircle,
  Tag,
  UploadCloud,
  User,
} from "../ui/icons";
import { SocialIcon } from "../ui/social-icons";

interface SiteFormProps {
  id?: string;
  initialData?: Partial<SiteFormValues>;
  onSaveGeneral?: (data: SiteFormValues) => void;
  onSaveCompany?: (data: SiteFormValues) => void;
  onSaveBranding?: (data: SiteFormValues) => void;
  onSaveMarketing?: (data: SiteFormValues) => void;
  onSaveCustomerJourney?: (data: SiteFormValues) => void;
  onSaveSocial?: (data: SiteFormValues) => void;
  onSaveChannels?: (data: SiteFormValues) => boolean | void | Promise<boolean | void>;
  onSaveActivities?: (data: SiteFormValues) => boolean | void | Promise<boolean | void>;
  onSaveShop?: (data: SiteFormValues) => void;
  onSavePrinters?: (data: SiteFormValues) => void;
  onDeleteSite?: () => void;
  activeSegment: string;
  siteId?: string;
}

export function SiteForm({
  id,
  initialData,
  onSaveGeneral,
  onSaveCompany,
  onSaveBranding,
  onSaveMarketing,
  onSaveCustomerJourney,
  onSaveSocial,
  onSaveChannels,
  onSaveActivities,
  onSaveShop,
  onSavePrinters,
  onDeleteSite,
  activeSegment,
  siteId,
}: SiteFormProps) {
  const [lastSiteId, setLastSiteId] = useState<string | undefined>(siteId);

  // Simplified since component re-mounts when data changes
  const stableInitialData = initialData;

  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: getSiteFormDefaults(initialData),
  });

  const [codeCopied, setCodeCopied] = useState(false);
  useActivityHydration(form, initialData?.activities, siteId);

  // Debounce function to avoid too many updates to localStorage
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: any[]) => {
      const later = () => {
        timeout = null;
        func(...args);
      };

      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(later, wait);
    };
  };

  // Create debounced version of saveFocusMode
  const saveFocusMode = useCallback(
    (value: number) => {
      if (siteId && typeof value === "number") {
        try {
          console.log(
            `SiteForm: Storing focusMode in localStorage: site_${siteId}_focusMode = ${value}`,
          );
          localStorage.setItem(`site_${siteId}_focusMode`, String(value));
        } catch (e) {
          console.error(
            "Error saving focusMode to localStorage from SiteForm:",
            e,
          );
        }
      }
    },
    [siteId],
  );

  const debouncedSaveFocusMode = useCallback(debounce(saveFocusMode, 300), [
    saveFocusMode,
  ]);

  // Listen for focusMode changes and save to localStorage with debounce
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "focusMode" && typeof value.focusMode === "number") {
        debouncedSaveFocusMode(value.focusMode);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, debouncedSaveFocusMode]);

  // Load focusMode from localStorage on initial render
  useEffect(() => {
    if (siteId) {
      try {
        const storedFocusMode = localStorage.getItem(
          `site_${siteId}_focusMode`,
        );
        if (storedFocusMode) {
          const focusModeValue = parseInt(storedFocusMode, 10);
          if (
            !isNaN(focusModeValue) &&
            focusModeValue !== form.getValues("focusMode")
          ) {
            console.log(
              `SiteForm: Loading focusMode from localStorage: ${focusModeValue}`,
            );
            form.setValue("focusMode", focusModeValue);
          }
        }
      } catch (e) {
        console.error(
          "Error loading focusMode from localStorage in SiteForm:",
          e,
        );
      }
    }
  }, [siteId, form]);

  useEffect(() => {
    // Exponer el formulario para depuración
    if (typeof window !== "undefined") {
      (window as any).__debug_form = form;
    }

    return () => {
      // Limpiar la referencia al salir
      if (typeof window !== "undefined") {
        (window as any).__debug_form = undefined;
      }
    };
  }, [form]);

  // Actualizar explícitamente el formulario cuando cambien los initialData principales
  // Solo actualizamos cuando el ID del sitio cambia o cuando es la primera carga
  useEffect(() => {
    if (stableInitialData && siteId && siteId !== lastSiteId) {
      console.log(
        "SiteForm: Site changed from",
        lastSiteId,
        "to",
        siteId,
        "- resetting form",
      );
      setLastSiteId(siteId);
      form.reset(getSiteFormDefaults(stableInitialData));
    }
  }, [siteId, lastSiteId, form]); // CRITICAL: Don't include stableInitialData - only reset on site ID change, not after saves

  // Note: Removed the complex update logic since the component now re-mounts when data changes
  // Form-level submit is no longer needed - each card handles its own save

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          form.setValue("logo_url", reader.result as string, {
            shouldDirty: true,
            shouldValidate: true,
          });
        };
        reader.readAsDataURL(file);
      }
    },
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  const copyTrackingCode = async () => {
    const trackingCode = createTrackingSnippet(
      siteId || initialData?.name || "YOUR_SITE_ID",
    );

    try {
      // Try to use the modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(trackingCode);
        setCodeCopied(true);
        toast.success("Tracking code copied to clipboard");
        setTimeout(() => setCodeCopied(false), 2000);
        return;
      }

      // Fallback to older document.execCommand method
      const textArea = document.createElement("textarea");
      textArea.value = trackingCode;

      // Make the textarea out of viewport
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);

      // Select and copy
      textArea.focus();
      textArea.select();

      const success = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (success) {
        setCodeCopied(true);
        toast.success("Tracking code copied to clipboard");
        setTimeout(() => setCodeCopied(false), 2000);
      } else {
        throw new Error("Copy command failed");
      }
    } catch (err) {
      console.error("Error copying tracking code:", err);
      toast.error(
        "Failed to copy tracking code. Please try selecting and copying manually.",
      );
    }
  };

  const renderCard = (segment: string, card: React.ReactElement) => {
    if (activeSegment === segment) {
      return card;
    }
    return null;
  };

  return (
    <FormProvider {...form}>
      <form id={id} className="space-y-12">
        <div className="space-y-12">
          {renderCard(
            "general",
            <GeneralSection active={true} onSave={onSaveGeneral} />,
          )}

          {renderCard(
            "general",
            <WebResourcesSection active={true} onSave={onSaveGeneral} />,
          )}

          {renderCard(
            "company",
            <CompanySection active={true} onSave={onSaveCompany} />,
          )}

          {renderCard(
            "marketplace",
            <ShopSection active={true} onSave={onSaveShop} siteId={siteId} />,
          )}

          {renderCard(
            "printers",
            <PrintersSection active={true} onSave={onSavePrinters} />,
          )}

          {renderCard("visits", <VisitsSection active={true} />)}

          {renderCard(
            "branding",
            <BrandingSection active={true} onSave={onSaveBranding} />,
          )}

          {renderCard(
            "marketing",
            <MarketingSection active={true} onSave={onSaveMarketing} />,
          )}

          {renderCard(
            "customer-journey",
            <CustomerJourneySection
              active={true}
              onSave={onSaveCustomerJourney}
            />,
          )}

          {renderCard(
            "social",
            <SocialSection
              active={true}
              onSave={onSaveSocial}
              siteId={siteId}
            />,
          )}

          {renderCard(
            "activities",
            <ActivitiesSection active={true} onSave={onSaveActivities} siteId={siteId} />,
          )}

          {renderCard(
            "channels",
            <ChannelsSection
              active={true}
              copyTrackingCode={copyTrackingCode}
              codeCopied={codeCopied}
              siteName={initialData?.name || ""}
              siteId={siteId}
              onSave={onSaveChannels}
            />,
          )}

          {renderCard("team", <TeamSection active={true} siteId={siteId} />)}

          {renderCard("calendar", <CalendarSection />)}

          {renderCard("secrets", <SecretsSection />)}

          {renderCard("billing", <BillingSection />)}
        </div>
      </form>
    </FormProvider>
  );
}
