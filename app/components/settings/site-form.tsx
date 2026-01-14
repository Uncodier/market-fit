"use client"

import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { siteFormSchema, type SiteFormValues, getFocusModeConfig } from "./form-schema"
import { GeneralSection } from "./GeneralSection"
import { WebResourcesSection } from "./WebResourcesSection"
import { CompanySection } from "./CompanySection"
import { BrandingSection } from "./BrandingSection"
import { MarketingSection } from "./MarketingSection"
import { CustomerJourneySection } from "./CustomerJourneySection"
import { SocialSection } from "./SocialSection"
import { ChannelsSection } from "./ChannelsSection"
import { TeamSection } from "./TeamSection"
import { BillingSection } from "./BillingSection"
import { ActivitiesSection } from "./ActivitiesSection"
import { useDropzone } from "react-dropzone"
import { cn } from "../../lib/utils"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "../ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Slider } from "../ui/slider"
import { Switch } from "../ui/switch"
import Image from "next/image"

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
  User
} from "../ui/icons"
import { SocialIcon } from "../ui/social-icons"

interface SiteFormProps {
  id?: string
  initialData?: Partial<SiteFormValues>
  onSaveGeneral?: (data: SiteFormValues) => void
  onSaveCompany?: (data: SiteFormValues) => void
  onSaveBranding?: (data: SiteFormValues) => void
  onSaveMarketing?: (data: SiteFormValues) => void
  onSaveCustomerJourney?: (data: SiteFormValues) => void
  onSaveSocial?: (data: SiteFormValues) => void
  onSaveChannels?: (data: SiteFormValues) => void
  onSaveActivities?: (data: SiteFormValues) => void
  onDeleteSite?: () => void
  activeSegment: string
  siteId?: string
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
  onDeleteSite,
  activeSegment,
  siteId 
}: SiteFormProps) {
  
  const [lastSiteId, setLastSiteId] = useState<string | undefined>(siteId)
  
  // Simplified since component re-mounts when data changes
  const stableInitialData = initialData;
  
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      url: initialData?.url || "",
      description: initialData?.description || "",
      logo_url: initialData?.logo_url || "",
      resource_urls: initialData?.resource_urls || [],
      competitors: initialData?.competitors || [],
      focusMode: initialData?.focusMode || 50,
      about: initialData?.about || "",
      company_size: initialData?.company_size || "",
      industry: initialData?.industry || "",
      products: Array.isArray(initialData?.products) ? [...initialData.products] : [],
      services: Array.isArray(initialData?.services) ? [...initialData.services] : [],
      locations: initialData?.locations || [],
      business_hours: initialData?.business_hours || [],
      goals: initialData?.goals || {
        quarterly: "",
        yearly: "",
        fiveYear: "",
        tenYear: ""
      },
      swot: initialData?.swot || {
        strengths: "",
        weaknesses: "",
        opportunities: "",
        threats: ""
      },
      marketing_budget: initialData?.marketing_budget || {
        total: 0,
        available: 0
      },
      channels: initialData?.channels || {
        email: {
          enabled: false,
          email: "",
          password: "",
          incomingServer: "",
          incomingPort: "",
          outgoingServer: "",
          outgoingPort: "",
          status: "not_configured"
        },
        whatsapp: {
          enabled: false,
          setupRequested: false,
          status: "not_configured"
        },
        website: {
          enabled: false,
          track_visitors: false,
          track_actions: false,
          record_screen: false,
          enable_chat: false,
          chat_accent_color: "#e0ff17",
          allow_anonymous_messages: false,
          chat_position: "bottom-right",
          welcome_message: "Welcome to our website! How can we assist you today?",
          chat_title: "Chat with us",
          analytics_provider: "",
          analytics_id: "",
          tracking_code: ""
        }
      },
      marketing_channels: initialData?.marketing_channels || [],
      social_media: initialData?.social_media?.length 
        ? initialData.social_media 
        : [
            { platform: "facebook", url: "", handle: "" },
            { platform: "twitter", url: "", handle: "" },
            { platform: "instagram", url: "", handle: "" },
            { platform: "linkedin", url: "", handle: "" },
            { platform: "youtube", url: "", handle: "" },
            { platform: "tiktok", url: "", handle: "" },
            { platform: "pinterest", url: "", handle: "" },
            { platform: "github", url: "", handle: "" },
            { platform: "reddit", url: "", handle: "" },
            { platform: "medium", url: "", handle: "" },
            { platform: "whatsapp", url: "", handle: "", phone: "", phoneCode: "" },
            { platform: "telegram", url: "", handle: "", inviteCode: "", channelId: "" },
            { platform: "discord", url: "", handle: "", inviteCode: "", channelId: "" }
          ],
      team_members: initialData?.team_members?.map(member => ({
        ...member, 
        position: member.position || ""
      })) || [],
      tracking: initialData?.tracking || {
        track_visitors: false,
        track_actions: false,
        record_screen: false,
        enable_chat: false,
        chat_accent_color: "#e0ff17",
        allow_anonymous_messages: false,
        chat_position: "bottom-right",
        welcome_message: "Welcome to our website! How can we assist you today?",
        chat_title: "Chat with us"
      },
      billing: initialData?.billing || {
        plan: "commission",
        auto_renew: true,
        card_name: "",
        card_number: "",
        card_expiry: "",
        card_cvc: "",
        billing_address: "",
        billing_city: "",
        billing_postal_code: "",
        billing_country: ""
      },
      branding: initialData?.branding || {
        brand_essence: "",
        brand_personality: "",
        brand_benefits: "",
        brand_attributes: "",
        brand_values: "",
        brand_promise: "",
        primary_color: "#000000",
        secondary_color: "#666666",
        accent_color: "#e0ff17",
        success_color: "#22c55e",
        warning_color: "#f59e0b",
        error_color: "#ef4444",
        background_color: "#ffffff",
        surface_color: "#f8fafc",
        primary_font: "",
        secondary_font: "",
        font_size_scale: "medium",
        communication_style: "friendly",
        personality_traits: [],
        forbidden_words: [],
        preferred_phrases: [],
        logo_variations: [],
        do_list: [],
        dont_list: [],
        emotions_to_evoke: [],
        brand_archetype: undefined
      },
      customer_journey: initialData?.customer_journey || {
        awareness: { metrics: [], actions: [], tactics: [] },
        consideration: { metrics: [], actions: [], tactics: [] },
        decision: { metrics: [], actions: [], tactics: [] },
        purchase: { metrics: [], actions: [], tactics: [] },
        retention: { metrics: [], actions: [], tactics: [] },
        referral: { metrics: [], actions: [], tactics: [] }
      }
      ,
      activities: initialData?.activities || {
        daily_resume_and_stand_up: { status: "default" },
        local_lead_generation: { status: "default" },
        icp_lead_generation: { status: "default" },
        leads_initial_cold_outreach: { status: "default" },
        leads_follow_up: { status: "default" },
        email_sync: { status: "default" },
        assign_leads_to_team: { status: "inactive" },
        notify_team_on_inbound_conversations: { status: "default" },
        supervise_conversations: { status: "inactive" }
      }
    }
  })

  const [codeCopied, setCodeCopied] = useState(false)
  
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
  const saveFocusMode = useCallback((value: number) => {
    if (siteId && typeof value === 'number') {
      try {
        console.log(`SiteForm: Storing focusMode in localStorage: site_${siteId}_focusMode = ${value}`);
        localStorage.setItem(`site_${siteId}_focusMode`, String(value));
      } catch (e) {
        console.error("Error saving focusMode to localStorage from SiteForm:", e);
      }
    }
  }, [siteId]);
  
  const debouncedSaveFocusMode = useCallback(debounce(saveFocusMode, 300), [saveFocusMode]);
  
  // Listen for focusMode changes and save to localStorage with debounce
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'focusMode' && typeof value.focusMode === 'number') {
        debouncedSaveFocusMode(value.focusMode);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, debouncedSaveFocusMode]);
  
  // Load focusMode from localStorage on initial render
  useEffect(() => {
    if (siteId) {
      try {
        const storedFocusMode = localStorage.getItem(`site_${siteId}_focusMode`);
        if (storedFocusMode) {
          const focusModeValue = parseInt(storedFocusMode, 10);
          if (!isNaN(focusModeValue) && focusModeValue !== form.getValues('focusMode')) {
            console.log(`SiteForm: Loading focusMode from localStorage: ${focusModeValue}`);
            form.setValue('focusMode', focusModeValue);
          }
        }
      } catch (e) {
        console.error("Error loading focusMode from localStorage in SiteForm:", e);
      }
    }
  }, [siteId, form]);

  useEffect(() => {
    // Exponer el formulario para depuración
    if (typeof window !== 'undefined') {
      (window as any).__debug_form = form;
    }
    
    return () => {
      // Limpiar la referencia al salir
      if (typeof window !== 'undefined') {
        (window as any).__debug_form = undefined;
      }
    };
  }, [form]);

  // Actualizar explícitamente el formulario cuando cambien los initialData principales
  // Solo actualizamos cuando el ID del sitio cambia o cuando es la primera carga
  useEffect(() => {
    if (stableInitialData && siteId && siteId !== lastSiteId) {
      console.log("SiteForm: Site changed from", lastSiteId, "to", siteId, "- resetting form");
      setLastSiteId(siteId);
      form.reset({
        ...stableInitialData,
        // Ensure goals are properly structured
        goals: stableInitialData.goals || {
          quarterly: "",
          yearly: "",
          fiveYear: "",
          tenYear: ""
        }
      });
    }
  }, [siteId, lastSiteId, form]) // CRITICAL: Don't include stableInitialData - only reset on site ID change, not after saves

  // Note: Removed the complex update logic since the component now re-mounts when data changes
  // Form-level submit is no longer needed - each card handles its own save

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (file) {
        const reader = new FileReader()
        reader.onloadend = () => {
          form.setValue("logo_url", reader.result as string)
        }
        reader.readAsDataURL(file)
      }
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false
  })

  const copyTrackingCode = async () => {
    const trackingCode = `<script>
  (function() {
    window.MarketFit = window.MarketFit || {};
    
    MarketFit.siteId = "${siteId || (initialData ? initialData.name : 'YOUR_SITE_ID')}";
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://files.uncodie.com/tracking.min.js';
    
    script.onload = function() {
      if (window.MarketFit && typeof window.MarketFit.init === 'function') {
        window.MarketFit.init({
          siteId: "${siteId || (initialData ? initialData.name : 'YOUR_SITE_ID')}",
          trackVisitors: ${form.watch("tracking.track_visitors")},
          trackActions: ${form.watch("tracking.track_actions")},
          recordScreen: ${form.watch("tracking.record_screen")},
          debug: false,
          chat: {
            enabled: ${form.watch("tracking.enable_chat")},
            accentColor: "${form.watch("tracking.chat_accent_color") || "#e0ff17"}",
            allowAnonymousMessages: ${form.watch("tracking.allow_anonymous_messages")},
            position: "${form.watch("tracking.chat_position") || "bottom-right"}",
            title: "${form.watch("tracking.chat_title") || "Chat with us"}",
            welcomeMessage: "${form.watch("tracking.welcome_message") || "Welcome to our website! How can we assist you today?"}"
          }
        });
      }
    };
    
    var firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      // Fallback: append to head or body if no script tags exist
      var target = document.head || document.body;
      if (target) {
        target.appendChild(script);
      }
    }
  })();
</script>`

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
      const textArea = document.createElement('textarea');
      textArea.value = trackingCode;
      
      // Make the textarea out of viewport
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      
      // Select and copy
      textArea.focus();
      textArea.select();
      
      const success = document.execCommand('copy');
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
      toast.error("Failed to copy tracking code. Please try selecting and copying manually.");
    }
  }

  const renderCard = (segment: string, card: React.ReactElement) => {
    if (activeSegment === segment) {
      return card
    }
    return null
  }

  return (
    <FormProvider {...form}>
      <form id={id} className="space-y-12">
        <div className="space-y-12">
          {renderCard("general", 
            <GeneralSection active={true} onSave={onSaveGeneral} />
          )}

          {renderCard("general",
            <WebResourcesSection active={true} onSave={onSaveGeneral} />
          )}

          {renderCard("company",
            <CompanySection active={true} onSave={onSaveCompany} />
          )}

          {renderCard("branding",
            <BrandingSection active={true} onSave={onSaveBranding} />
          )}

          {renderCard("marketing",
            <MarketingSection active={true} onSave={onSaveMarketing} />
          )}

          {renderCard("customer-journey",
            <CustomerJourneySection active={true} onSave={onSaveCustomerJourney} />
          )}

          {renderCard("social",
            <SocialSection active={true} onSave={onSaveSocial} />
          )}

          {renderCard("activities",
            <ActivitiesSection active={true} onSave={onSaveActivities} />
          )}

          {renderCard("channels",
            <ChannelsSection 
              active={true} 
              copyTrackingCode={copyTrackingCode} 
              codeCopied={codeCopied} 
              siteName={initialData?.name || ''}
              siteId={siteId}
              onSave={onSaveChannels}
            />
          )}

          {renderCard("team",
            <TeamSection active={true} siteId={siteId} />
          )}


          {renderCard("billing",
            <BillingSection />
          )}
        </div>
      </form>
    </FormProvider>
  )
} 