"use client"

import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { ChannelsSection as SettingsChannelsSection } from "@/app/components/settings/ChannelsSection"
import { siteFormSchema, type SiteFormValues } from "@/app/components/settings/form-schema"
import { adaptSiteToForm } from "@/app/components/settings/data-adapter"
import { handleSaveChannels } from "@/app/components/settings/save-handlers"
import { useState } from "react"
import { toast } from "sonner"

export function ChannelsSection() {
  const { currentSite, updateSite, updateSettings, refreshSites } = useSite()
  const [isSaving, setIsSaving] = useState(false)

  // Adapt site data to form values
  const adaptedSiteData = useMemo(() => {
    if (!currentSite) return null
    return adaptSiteToForm(currentSite)
  }, [currentSite])

  // Initialize form with site data
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: adaptedSiteData || {
      name: "",
      url: "",
      description: "",
      logo_url: "",
      resource_urls: [],
      competitors: [],
      focusMode: 50,
      about: "",
      company_size: "",
      industry: "",
      products: [],
      services: [],
      locations: [],
      business_hours: [],
      goals: {
        quarterly: "",
        yearly: "",
        fiveYear: "",
        tenYear: ""
      },
      swot: {
        strengths: "",
        weaknesses: "",
        opportunities: "",
        threats: ""
      },
      marketing_budget: {
        total: 0,
        available: 0
      },
      channels: {
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
        },
        agent_email: {
          domain: undefined,
          customDomain: "",
          username: "",
          displayName: "",
          setupRequested: false,
          status: "not_configured"
        },
        agent_whatsapp: {
          country: "",
          region: "",
          setupRequested: false,
          status: "not_configured"
        }
      },
      marketing_channels: [],
      social_media: [],
      team_members: [],
      tracking: {
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
    }
  })

  // Update form when site data changes
  useEffect(() => {
    if (adaptedSiteData) {
      form.reset(adaptedSiteData)
    }
  }, [adaptedSiteData, form])

  // Save handler
  const onSaveChannels = async (data: SiteFormValues) => {
    if (!currentSite) return

    const saveOptions = {
      currentSite,
      updateSite,
      updateSettings,
      refreshSites,
      setIsSaving
    }

    await handleSaveChannels(data, saveOptions)
  }

  // Copy tracking code handler
  const handleCopyTrackingCode = async () => {
    const trackingCode = `<script>
  (function() {
    window.MarketFit = window.MarketFit || {};
    
    MarketFit.siteId = "${currentSite?.id || 'YOUR_SITE_ID'}";
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://files.uncodie.com/tracking.min.js';
    
    script.onload = function() {
      if (window.MarketFit && typeof window.MarketFit.init === 'function') {
        window.MarketFit.init({
          siteId: "${currentSite?.id || 'YOUR_SITE_ID'}",
          trackVisitors: ${form.getValues("tracking.track_visitors")},
          trackActions: ${form.getValues("tracking.track_actions")},
          recordScreen: ${form.getValues("tracking.record_screen")},
          debug: false,
          chat: {
            enabled: ${form.getValues("tracking.enable_chat")},
            accentColor: "${form.getValues("tracking.chat_accent_color") || "#e0ff17"}",
            allowAnonymousMessages: ${form.getValues("tracking.allow_anonymous_messages") || false},
            position: "${form.getValues("tracking.chat_position") || "bottom-right"}",
            title: "${form.getValues("tracking.chat_title") || "Chat with us"}",
            welcomeMessage: "${form.getValues("tracking.welcome_message") || "Welcome to our website! How can we assist you today?"}"
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
        await navigator.clipboard.writeText(trackingCode)
        toast.success("Tracking code copied to clipboard")
        return
      }
      
      // Fallback to older document.execCommand method
      const textArea = document.createElement('textarea')
      textArea.value = trackingCode
      
      // Make the textarea out of viewport
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      
      // Select and copy
      textArea.focus()
      textArea.select()
      
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (success) {
        toast.success("Tracking code copied to clipboard")
      } else {
        throw new Error("Copy command failed")
      }
    } catch (err) {
      console.error("Error copying tracking code:", err)
      toast.error("Failed to copy tracking code. Please try selecting and copying manually.")
    }
  }

  if (!currentSite) {
    return null
  }

  return (
    <FormProvider {...form}>
      <SettingsChannelsSection
        active={true}
        siteName={currentSite.name}
        siteId={currentSite.id}
        copyTrackingCode={handleCopyTrackingCode}
        onSave={onSaveChannels}
        excludeWebsite={true}
        useAgentChannels={false}
      />
    </FormProvider>
  )
}

























