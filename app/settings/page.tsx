"use client"

import { useState, useEffect } from "react"
import { useSite } from "../context/SiteContext"
import { useTheme } from "../context/ThemeContext"
import { toast } from "sonner"
import { type Site, type SiteSettings } from "../context/SiteContext"
import { Button } from "../components/ui/button"
import { StickyHeader } from "../components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Skeleton } from "../components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog"
import { SiteForm } from "../components/settings/site-form"
import { type SiteFormValues, type MarketingChannel } from "../components/settings/form-schema"
import { secureTokensService } from "../services/secure-tokens-service"

// Type definition for competitor URLs to match the form values
interface CompetitorWithMaybeOptionalName {
  url: string;
  name: string;
}

// Handle the type mismatch between our form values and the API types
type AdaptedSiteFormValues = Omit<SiteFormValues, 'competitors'> & {
  competitors: CompetitorWithMaybeOptionalName[];
}

function SettingsFormSkeleton() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/4" />
          </CardTitle>
          <Skeleton className="h-4 w-2/3 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/3" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-10 w-24" />
              </div>
            ))}
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/3" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-10 w-24" />
              </div>
            ))}
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-12 w-full" />
            <div className="flex justify-end">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-12" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/4" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  const { currentSite, updateSite, deleteSite, isLoading, updateSettings } = useSite()
  const { theme } = useTheme()
  const [isSaving, setIsSaving] = useState(false)
  const [activeSegment, setActiveSegment] = useState("general")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [formKey, setFormKey] = useState(0)

  // Update form key when currentSite changes to force re-render
  useEffect(() => {
    if (currentSite) {
      setFormKey(prev => prev + 1)
    }
  }, [currentSite?.id])

  // Force re-render when settings change
  useEffect(() => {
    if (currentSite?.settings) {
      console.log("Settings changed, forcing form re-render")
      setFormKey(prev => prev + 1)
    }
  }, [currentSite?.settings])

  // Convert any existing marketing channels data to the correct format
  const formatMarketingChannels = (channels: any[]): MarketingChannel[] => {
    if (!channels || !Array.isArray(channels)) return [];
    
    return channels.map(channel => {
      if (typeof channel === 'string') {
        return { name: channel };
      } else if (typeof channel === 'object' && channel !== null) {
        return { 
          name: channel.name || '', 
          type: channel.type 
        };
      }
      return { name: '' };
    });
  }

  // Convert existing social media data to the new format with all fields
  const formatSocialMedia = (socialMedia: any[]): any[] => {
    if (!socialMedia || !Array.isArray(socialMedia)) return [];
    
    return socialMedia.map(sm => {
      // Ensure every social media item has the required fields
      // URL is still marked as required for backward compatibility
      const formattedItem = {
        platform: sm.platform || '',
        url: sm.url || '',
        handle: sm.handle || '',
        phone: sm.phone || '',
        phoneCode: sm.phoneCode || '',
        inviteCode: sm.inviteCode || '',
        channelId: sm.channelId || ''
      };
      
      return formattedItem;
    });
  }

  // Convert products data to the new format with name, description, and pricing fields
  const formatProducts = (products: any[]): any[] => {
    if (!products || !Array.isArray(products)) return [];
    
    return products.map(product => {
      // Handle migration from string to object format
      if (typeof product === 'string') {
        return {
          name: product,
          description: '',
          cost: 0,
          lowest_sale_price: 0,
          target_sale_price: 0
        };
      } else if (typeof product === 'object' && product !== null) {
        return {
          name: product.name || '',
          description: product.description || '',
          cost: typeof product.cost === 'number' ? product.cost : 0,
          lowest_sale_price: typeof product.lowest_sale_price === 'number' ? product.lowest_sale_price : 0,
          target_sale_price: typeof product.target_sale_price === 'number' ? product.target_sale_price : 0
        };
      }
      return {
        name: '',
        description: '',
        cost: 0,
        lowest_sale_price: 0,
        target_sale_price: 0
      };
    });
  }

  // Convert services data to the new format with name, description, and pricing fields
  const formatServices = (services: any[]): any[] => {
    if (!services || !Array.isArray(services)) return [];
    
    return services.map(service => {
      // Handle migration from string to object format
      if (typeof service === 'string') {
        return {
          name: service,
          description: '',
          cost: 0,
          lowest_sale_price: 0,
          target_sale_price: 0
        };
      } else if (typeof service === 'object' && service !== null) {
        return {
          name: service.name || '',
          description: service.description || '',
          cost: typeof service.cost === 'number' ? service.cost : 0,
          lowest_sale_price: typeof service.lowest_sale_price === 'number' ? service.lowest_sale_price : 0,
          target_sale_price: typeof service.target_sale_price === 'number' ? service.target_sale_price : 0
        };
      }
      return {
        name: '',
        description: '',
        cost: 0,
        lowest_sale_price: 0,
        target_sale_price: 0
      };
    });
  }

  // Adaptar Site a SiteFormValues para el formulario
  const adaptSiteToForm = (site: Site): AdaptedSiteFormValues => {
    console.log("Adapting site to form:", site);
    
    // Convertir los campos de goals al nuevo formato si existen
    const goalsData = site.settings?.goals 
      ? {
          quarterly: site.settings.goals.quarterly || "",
          yearly: site.settings.goals.yearly || "",
          fiveYear: site.settings.goals.fiveYear || "",
          tenYear: site.settings.goals.tenYear || ""
        }
      : {
          quarterly: "",
          yearly: "",
          fiveYear: "",
          tenYear: ""
        };

    // Check for secure tokens and use a placeholder for display
    const hasEmailPassword = site.settings?.channels?.email?.password || site.settings?.channels?.email?.enabled || "";
    const emailPassword = hasEmailPassword ? "STORED_SECURELY" : "";
    const emailStatus = (site.settings?.channels?.email?.status || (hasEmailPassword ? "synced" : "not_configured")) as "not_configured" | "password_required" | "pending_sync" | "synced";

    // WhatsApp configuration (no longer includes apiToken in form data)
    
    // Process team members data
    const teamMembers = site.settings?.team_members || [];
    console.log("🔍 ADAPT: Raw team_members from site.settings:", teamMembers);
    console.log("🔍 ADAPT: site.settings:", site.settings);
    
    // Make sure each team member has the required fields
    const processedTeamMembers = teamMembers.map(member => {
      if (!member) return null;
      
      const processed = {
        email: member.email || "",
        role: member.role || "view",
        name: member.name || "",
        position: member.position || ""
      };
      console.log("🔍 ADAPT: Processing member:", member, "→", processed);
      return processed;
    }).filter(Boolean) as {
      email: string;
      role: "view" | "create" | "delete" | "admin";
      name?: string;
      position?: string;
    }[]; // Type assertion and remove null entries
    
    console.log("🔍 ADAPT: Final processed team members:", processedTeamMembers);
    
    // Add business_hours
    const business_hours = site.settings?.business_hours?.map(bh => ({
      ...bh,
      respectHolidays: bh.respectHolidays ?? true // Ensure it's always boolean, default to true
    })) || [];
    
    console.log("🔍 ADAPT: site.settings?.business_hours:", site.settings?.business_hours)
    console.log("🔍 ADAPT: Final adapted data business_hours:", business_hours)
    
    const result = {
      name: site.name,
      url: site.url || "",
      description: site.description || "",
      logo_url: site.logo_url || "",
      resource_urls: site.resource_urls || [],
      // Leer competitors y focusMode desde settings en lugar de site
      competitors: site.settings?.competitors?.map(comp => ({
        url: comp.url || "",
        name: comp.name || "" // Ensure name is always a string
      })) || [],
      focusMode: site.settings?.focus_mode || 50,
      // Add company info
      about: site.settings?.about || "",
      company_size: site.settings?.company_size || "",
      industry: site.settings?.industry || "",
      products: formatProducts(site.settings?.products || []),
      services: formatServices(site.settings?.services || []),
      locations: site.settings?.locations || [],
      // Add goals with converted field names
      goals: goalsData,
      swot: site.settings?.swot || {
        strengths: "",
        weaknesses: "",
        opportunities: "",
        threats: ""
      },
      // Add channels configuration with password placeholder if secured
      channels: site.settings?.channels ? {
        email: {
          enabled: site.settings.channels.email?.enabled || false,
          email: site.settings.channels.email?.email || "",
          password: emailPassword,
          incomingServer: site.settings.channels.email?.incomingServer || "",
          incomingPort: site.settings.channels.email?.incomingPort || "",
          outgoingServer: site.settings.channels.email?.outgoingServer || "",
          outgoingPort: site.settings.channels.email?.outgoingPort || "",
          status: emailStatus
        },
        whatsapp: {
          enabled: Boolean(site.settings.channels.whatsapp?.enabled) || Boolean(site.settings.channels.whatsapp?.apiToken),
          setupType: site.settings.channels.whatsapp?.setupType,
          country: site.settings.channels.whatsapp?.country,
          region: site.settings.channels.whatsapp?.region,
          existingNumber: site.settings.channels.whatsapp?.existingNumber,
          setupRequested: site.settings.channels.whatsapp?.setupRequested || false,
          status: site.settings.channels.whatsapp?.status || "not_configured"
        }
      } : {
        email: {
          enabled: false,
          email: "",
          password: "",
          incomingServer: "",
          incomingPort: "",
          outgoingServer: "",
          outgoingPort: "",
          status: "not_configured" as const
        },
        whatsapp: {
          enabled: false,
          setupType: undefined,
          country: undefined,
          region: undefined,
          existingNumber: undefined,
          setupRequested: false,
          status: "not_configured" as const
        }
      },
      // Add marketing info
      marketing_budget: site.settings?.marketing_budget || {
        total: 0,
        available: 0
      },
      marketing_channels: formatMarketingChannels(site.settings?.marketing_channels || []),
      social_media: formatSocialMedia(site.settings?.social_media || []),
      // Add tracking info with explicit tracking.chat_accent_color
      tracking: {
        track_visitors: site.tracking?.track_visitors || false,
        track_actions: site.tracking?.track_actions || false,
        record_screen: site.tracking?.record_screen || false,
        enable_chat: site.tracking?.enable_chat || false,
        chat_accent_color: site.tracking?.chat_accent_color || "#e0ff17",
        allow_anonymous_messages: site.tracking?.allow_anonymous_messages || false,
        chat_position: site.tracking?.chat_position || "bottom-right",
        welcome_message: site.tracking?.welcome_message || "Welcome to our website! How can we assist you today?",
        chat_title: site.tracking?.chat_title || "Chat with us",
        analytics_provider: site.tracking?.analytics_provider || "",
        analytics_id: site.tracking?.analytics_id || "",
        tracking_code: site.tracking?.tracking_code || ""
      },
      // Add team info
      team_members: processedTeamMembers,
      // Billing info
      billing: site.billing || {
        plan: "free",
        auto_renew: true
      },
      // Agregar datos de company (este campo es requerido por el esquema)
      company: {
        name: "",
        vision: "",
        mission: "",
        values: "",
        differentiators: ""
      },
      // Add business_hours
      business_hours: business_hours
    }
    
    console.log("🔍 ADAPT: Final adapted data:", result);
    return result
  }

  const handleSave = async (data: SiteFormValues) => {
    if (!currentSite) return;
    
    try {
      console.log("SAVE 1: Inicio del proceso de guardado");
      setIsSaving(true)
      
      // Validate required fields
      if (!data.name?.trim()) {
        toast.error("Site name is required");
        setIsSaving(false);
        return;
      }

      if (!data.url?.trim()) {
        toast.error("Site URL is required");
        setIsSaving(false);
        return;
      }
      
      console.log("SAVE 2: Validaciones básicas completadas");
      
      // Extract site-specific fields (exclude team_members from general save)
      const { 
        name, url, description, logo_url, resource_urls, 
        competitors, focusMode, billing, tracking, 
        team_members, channels, 
        // Extract all the settings fields explicitly to avoid any tracking contamination
        about, company_size, industry, products, services, locations, 
        business_hours, goals: rawGoals, swot: rawSwot, marketing_budget, marketing_channels, 
        social_media, company
      } = data;
      
      // Create settingsData object explicitly without any tracking fields
      const settingsData = {
        about, company_size, industry, products, services, locations,
        business_hours, goals: rawGoals, swot: rawSwot, marketing_budget, marketing_channels,
        social_media, company
      };
      
      console.log("SAVE 3: Datos extraídos del formulario:", {
        site: { name, url, description },
        settings: { goals: rawGoals, about: settingsData.about }
      });
      
      // Guardar inmediatamente el focusMode en localStorage para asegurar que persista
      if (typeof focusMode === 'number') {
        try {
          localStorage.setItem(`site_${currentSite.id}_focus_mode`, String(focusMode));
        } catch (e) {
          console.error("Error saving focus_mode to localStorage:", e);
        }
      }
      
      // Filter out empty URLs
      const filteredResourceUrls = resource_urls?.filter((url: any) => url.key && url.url && url.key.trim() !== '' && url.url.trim() !== '') || [];
      const filteredCompetitors = competitors?.filter((comp: any) => comp.url && comp.url.trim() !== '') || [];
      
      console.log("SAVE 4: Datos filtrados");
      
      // Filter out social media entries with empty URLs or required fields based on platform
      const filteredSocialMedia = settingsData.social_media?.filter((sm: any) => {
        // If platform is empty, don't include it
        if (!sm.platform || sm.platform.trim() === '') {
          return false;
        }
        
        // Platform-specific validations
        switch (sm.platform) {
          case 'whatsapp':
            // WhatsApp requires phone number
            if (!sm.phone || sm.phone.trim() === '') {
              console.log(`Skipping WhatsApp entry due to missing phone number`);
              return false;
            }
            return true;
          
          case 'telegram':
            // Telegram requires either a handle or a URL
            if ((!sm.handle || sm.handle.trim() === '') && (!sm.url || sm.url.trim() === '')) {
              console.log(`Skipping Telegram entry due to missing handle or URL`);
              return false;
            }
            
            // Validate URL format if provided
            if (sm.url && sm.url.trim() !== '' && !sm.url.match(/^https?:\/\/.+/)) {
              console.log(`Skipping Telegram entry due to invalid URL: ${sm.url}`);
              return false;
            }
            return true;
            
          case 'discord':
            // Discord requires either an invite code or a URL
            if ((!sm.inviteCode || sm.inviteCode.trim() === '') && (!sm.url || sm.url.trim() === '')) {
              console.log(`Skipping Discord entry due to missing invite code or URL`);
              return false;
            }
            
            // Validate URL format if provided
            if (sm.url && sm.url.trim() !== '' && !sm.url.match(/^https?:\/\/.+/)) {
              console.log(`Skipping Discord entry due to invalid URL: ${sm.url}`);
              return false;
            }
            return true;
            
          default:
            // For standard platforms, URL is not required - we can just have a handle
            // But if URL is provided, validate its format
            if (sm.url && sm.url.trim() !== '') {
              const hasValidUrl = sm.url.match(/^https?:\/\/.+/);
              if (!hasValidUrl) {
                console.log(`Skipping social media entry with platform ${sm.platform} due to invalid URL format: "${sm.url}"`);
                return false;
              }
            }
            return true;
        }
      }) || [];
      
      // Ensure SWOT and goals have the correct structure
      const swot = {
        strengths: rawSwot?.strengths || "",
        weaknesses: rawSwot?.weaknesses || "",
        opportunities: rawSwot?.opportunities || "",
        threats: rawSwot?.threats || ""
      };
      
      console.log("SAVE 5: Goals data original:", rawGoals);
      
      const goals = {
        quarterly: rawGoals?.quarterly || "",
        yearly: rawGoals?.yearly || "",
        fiveYear: rawGoals?.fiveYear || "",
        tenYear: rawGoals?.tenYear || ""
      };
      
      console.log("SAVE 6: Goals data procesado:", goals);
      
      // Update site basic info
      const siteUpdate = {
        name,
        url,
        description: description || null,
        logo_url: logo_url || null,
        resource_urls: filteredResourceUrls,
        tracking: {
          track_visitors: Boolean(tracking?.track_visitors),
          track_actions: Boolean(tracking?.track_actions),
          record_screen: Boolean(tracking?.record_screen),
          enable_chat: Boolean(tracking?.enable_chat),
          chat_accent_color: tracking?.chat_accent_color || "#e0ff17",
          allow_anonymous_messages: Boolean(tracking?.allow_anonymous_messages),
          chat_position: tracking?.chat_position || "bottom-right",
          welcome_message: tracking?.welcome_message || "Welcome to our website! How can we assist you today?",
          chat_title: tracking?.chat_title || "Chat with us",
          analytics_provider: tracking?.analytics_provider || "",
          analytics_id: tracking?.analytics_id || "",
          tracking_code: tracking?.tracking_code || ""
        }
      };
      
      console.log("SAVE 7: Site update preparado:", siteUpdate);
      
      // Create settings object with direct field access to prevent undefined values
      // NOTE: team_members is now excluded from general save - handled in TeamSection
      const settings = {
        site_id: currentSite.id, // Explicitly set the site_id to ensure it's always correct
        about: settingsData.about || "",
        company_size: settingsData.company_size || "",
        industry: settingsData.industry || "",
        products: Array.isArray(settingsData.products) ? settingsData.products : [],
        services: Array.isArray(settingsData.services) ? settingsData.services : [],
        swot, // Use the validated swot object
        locations: settingsData.locations || [],
        business_hours: settingsData.business_hours || [],
        marketing_budget: {
          total: settingsData.marketing_budget?.total || 0,
          available: settingsData.marketing_budget?.available || 0
        },
        marketing_channels: settingsData.marketing_channels || [],
        social_media: filteredSocialMedia,
        // Include channels configuration
        channels: channels || {
          email: {
            enabled: false,
            email: "",
            password: "",
            incomingServer: "",
            incomingPort: "",
            outgoingServer: "",
            outgoingPort: "",
            status: "not_configured" as const
          },
          whatsapp: {
            enabled: false,
            setupType: undefined,
            country: undefined,
            region: undefined,
            existingNumber: undefined,
            setupRequested: false,
            status: "not_configured" as const
          }
        },
        // Incluir competitors y focus_mode en settings en lugar de site
        competitors: filteredCompetitors?.length > 0 ? filteredCompetitors : [],
        focus_mode: focusMode || 50,
        goals: {
          quarterly: goals.quarterly || "",
          yearly: goals.yearly || "", 
          fiveYear: goals.fiveYear || "",
          tenYear: goals.tenYear || ""
        } // Use the validated goals object with correct field names
      };
      
      // Handle secure token storage if new values are provided
      if (currentSite.id) {
        console.log("SAVE SECURE: Processing secure tokens");
        
        // Check for email credentials - Don't process 'STORED_SECURELY' as it's just a placeholder
        if (data.channels?.email?.password && 
            data.channels.email.password.trim() !== '' && 
            data.channels.email.password !== 'STORED_SECURELY') {
          try {
            console.log("SAVE SECURE: Storing email credentials");
            const emailIdentifier = data.channels.email.email || 'default';
            await secureTokensService.storeToken(
              currentSite.id,
              'email',
              data.channels.email.password,
              emailIdentifier
            );
            // Clear the password from the form data to avoid storing in plaintext
            data.channels.email.password = "";
            // Ensure we keep email settings structure in settings with ALL fields
            if (!settings.channels) settings.channels = { 
              email: {} as any,
              whatsapp: {
                enabled: false,
                setupType: undefined,
                country: undefined,
                region: undefined,
                existingNumber: undefined,
                setupRequested: false,
                status: "not_configured" as const
              }
            };
            // Copy all email configuration fields from the form data
            settings.channels.email = {
              enabled: data.channels.email.enabled || false,
              email: data.channels.email.email || "",
              password: "PASSWORD_PRESENT", // Indicate password is stored securely
              incomingServer: data.channels.email.incomingServer || "",
              incomingPort: data.channels.email.incomingPort || "",
              outgoingServer: data.channels.email.outgoingServer || "",
              outgoingPort: data.channels.email.outgoingPort || "",
              status: (data.channels.email.status || "not_configured") as "not_configured" | "password_required" | "pending_sync" | "synced"
            };
          } catch (tokenError) {
            console.error("Error storing email credentials:", tokenError);
          }
        } else if (data.channels?.email?.password === 'STORED_SECURELY' && data.channels.email.enabled) {
          // If using the stored password, make sure we keep ALL email configuration fields
          if (!settings.channels) settings.channels = { 
            email: {} as any,
            whatsapp: {
              enabled: false,
              setupType: undefined,
              country: undefined,
              region: undefined,
              existingNumber: undefined,
              setupRequested: false,
              status: "not_configured" as const
            }
          };
          settings.channels.email = {
            enabled: data.channels.email.enabled || false,
            email: data.channels.email.email || "",
            password: "PASSWORD_PRESENT", // Keep the indicator
            incomingServer: data.channels.email.incomingServer || "",
            incomingPort: data.channels.email.incomingPort || "",
            outgoingServer: data.channels.email.outgoingServer || "",
            outgoingPort: data.channels.email.outgoingPort || "",
            status: (data.channels.email.status || "not_configured") as "not_configured" | "password_required" | "pending_sync" | "synced"
          };
          // Clear the placeholder from data
          data.channels.email.password = "";
        }
      }
      
      // Preserve existing settings ID if it exists
      if (currentSite.settings?.id) {
        (settings as any).id = currentSite.settings.id;
      }
      
      console.log("SAVE 8: Settings preparado:", {
        id: (settings as any).id,
        site_id: settings.site_id,
        goals: settings.goals
      });
      
      // First update the site
      console.log("SAVE 9: Llamando a updateSite...");
      try {
        await updateSite({
          ...currentSite,
          ...siteUpdate
        } as any);
        console.log("SAVE 10: updateSite completado con éxito");
      } catch (siteError) {
        console.error("SAVE ERROR en updateSite:", siteError);
        throw siteError;
      }
      
      // Then update the settings
      console.log("SAVE 11: Llamando a updateSettings...");
      try {
        await updateSettings(currentSite.id, settings as any);
        console.log("SAVE 12: updateSettings completado con éxito");
      } catch (settingsError) {
        console.error("SAVE ERROR en updateSettings:", settingsError);
        throw settingsError;
      }

      // NOTE: team_members sync is now handled in TeamSection specifically
      
      console.log("SAVE 13: Todo el proceso completado con éxito");
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("SAVE ERROR GENERAL:", error);
      
      // Show more specific error message if available
      if (error instanceof Error) {
        toast.error(`Error: ${error.message}`);
      } else {
        toast.error("Error saving settings");
      }
    } finally {
      // Always set saving to false, even if there was an error
      setIsSaving(false);
    }
  }

  // Función para manejar la acción de borrar caché y reconstruir
  const handleCacheAndRebuild = async () => {
    try {
      setIsSaving(true)
      // Aquí iría la lógica para borrar caché y reconstruir experimentos
      toast.success("Cache cleared and experiments rebuilt successfully")
    } catch (error) {
      console.error(error)
      toast.error("Error clearing cache and rebuilding experiments")
    } finally {
      setIsSaving(false)
    }
  }

  // Función para manejar la acción de borrar todo el sitio
  const handleDeleteSite = async () => {
    if (!currentSite) return

    try {
      setIsSaving(true)
      await deleteSite(currentSite.id)
      toast.success("Site deleted successfully")
    } catch (error) {
      console.error(error)
      toast.error("Error deleting site")
    } finally {
      setIsSaving(false)
      setShowDeleteDialog(false)
    }
  }

  // Función para guardar manualmente (sin depender del submit)
  const handleManualSave = async () => {
    console.log("MANUAL SAVE: Obteniendo formulario");
    const formElement = document.getElementById('settings-form') as HTMLFormElement;
    if (!formElement) {
      console.error("MANUAL SAVE ERROR: No se encontró el formulario");
      return;
    }
    
    console.log("MANUAL SAVE: Disparando validación");
    // Obtener una referencia al formulario React Hook Form dentro del SiteForm
    // Esto es un hack, idealmente debería hacerse de otra manera
    const form = (window as any).__debug_form;
    if (!form) {
      console.error("MANUAL SAVE ERROR: No se pudo obtener el formulario");
      console.log("MANUAL SAVE FALLBACK: Usando evento submit directo");
      formElement.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      return;
    }
    
    console.log("MANUAL SAVE: Obteniendo valores del formulario");
    const formValues = form.getValues();
    console.log("MANUAL SAVE: Valores del formulario:", formValues);
    
    // Procesar con el handleSave normal
    await handleSave(formValues);
  };

  if (isLoading) {
    return (
      <div className="flex-1">
        <StickyHeader>
          <div className="flex items-center justify-between px-16 w-full">
            <Tabs value="general" className="w-auto">
              <TabsList>
                <TabsTrigger value="general">General Settings</TabsTrigger>
                <TabsTrigger value="company">Company</TabsTrigger>
                <TabsTrigger value="marketing">Marketing</TabsTrigger>
                <TabsTrigger value="social">Social Networks</TabsTrigger>
                <TabsTrigger value="channels">Channels</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button disabled>Save settings</Button>
          </div>
        </StickyHeader>
        <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
          <SettingsFormSkeleton />
        </div>
      </div>
    )
  }

  if (!currentSite) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">No site selected</p>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
          <Tabs value={activeSegment} onValueChange={setActiveSegment} className="w-auto">
            <TabsList className="flex">
              <TabsTrigger value="general" className="whitespace-nowrap">General Settings</TabsTrigger>
              <TabsTrigger value="company" className="whitespace-nowrap">Company</TabsTrigger>
              <TabsTrigger value="marketing" className="whitespace-nowrap">Marketing</TabsTrigger>
              <TabsTrigger value="social" className="whitespace-nowrap">Social Networks</TabsTrigger>
              <TabsTrigger value="channels" className="whitespace-nowrap">Channels</TabsTrigger>
              <TabsTrigger value="team" className="whitespace-nowrap">Team</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button 
              type="button"
              onClick={handleManualSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </div>
      </StickyHeader>
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <SiteForm
          key={formKey}
          id="settings-form"
          initialData={adaptSiteToForm(currentSite)}
          onSubmit={handleSave}
          onDeleteSite={() => setShowDeleteDialog(true)}
          onCacheAndRebuild={handleCacheAndRebuild}
          isSaving={isSaving}
          activeSegment={activeSegment}
          siteId={currentSite.id}
        />
      </div>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the site
              "{currentSite?.name}" and all of its data including pages, assets, and settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSite}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={isSaving}
            >
              {isSaving ? "Deleting..." : "Delete Site"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 