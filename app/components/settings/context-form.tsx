"use client"

import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { siteFormSchema, type SiteFormValues, getFocusModeConfig } from "./form-schema"
import { GeneralSection } from "./GeneralSection"
import { CompanySection } from "./CompanySection"
import { BrandingSection } from "./BrandingSection"
import { MarketingSection } from "./MarketingSection"
import { CustomerJourneySection } from "./CustomerJourneySection"
import { SocialSection } from "./SocialSection"
import { BillingSection } from "./BillingSection"
import { RotateCcw } from "../ui/icons"
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
  Trash2,
  UploadCloud,
  User
} from "../ui/icons"
import { SocialIcon } from "../ui/social-icons"

interface ContextFormProps {
  id?: string
  initialData?: Partial<SiteFormValues>
  onSubmit: (data: SiteFormValues) => void
  onDeleteSite?: () => void
  onCacheAndRebuild?: () => void
  isSaving?: boolean
  activeSegment: string
  siteId?: string
}

export function ContextForm({ 
  id, 
  initialData, 
  onSubmit, 
  onDeleteSite, 
  onCacheAndRebuild, 
  isSaving, 
  activeSegment,
  siteId 
}: ContextFormProps) {
  
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
      business_goals: Array.isArray(initialData?.business_goals) ? [...initialData.business_goals] : [],
      financial_info: initialData?.financial_info ? { ...initialData.financial_info } : { annual_revenue: "", monthly_recurring_revenue: "", customer_acquisition_cost: "", average_deal_size: "", burn_rate: "", runway_months: 0 },
      operational_info: initialData?.operational_info ? { ...initialData.operational_info } : { countries: [], languages: [], time_zones: [] },
      key_metrics: Array.isArray(initialData?.key_metrics) ? [...initialData.key_metrics] : [],
      technologies: Array.isArray(initialData?.technologies) ? [...initialData.technologies] : [],
      target_audience: Array.isArray(initialData?.target_audience) ? [...initialData.target_audience] : [],
      customer_segments: Array.isArray(initialData?.customer_segments) ? [...initialData.customer_segments] : [],
      challenges: Array.isArray(initialData?.challenges) ? [...initialData.challenges] : [],
      solution_description: initialData?.solution_description || "",
      value_proposition: initialData?.value_proposition || "",
      revenue_streams: Array.isArray(initialData?.revenue_streams) ? [...initialData.revenue_streams] : [],
      strengths: Array.isArray(initialData?.strengths) ? [...initialData.strengths] : [],
      weaknesses: Array.isArray(initialData?.weaknesses) ? [...initialData.weaknesses] : [],
      opportunities: Array.isArray(initialData?.opportunities) ? [...initialData.opportunities] : [],
      threats: Array.isArray(initialData?.threats) ? [...initialData.threats] : [],
      goals: Array.isArray(initialData?.goals) ? [...initialData.goals] : [],
      primary_color: initialData?.primary_color || "",
      secondary_color: initialData?.secondary_color || "",
      text_color: initialData?.text_color || "",
      background_color: initialData?.background_color || "",
      font_family: initialData?.font_family || "",
      brand_personality: Array.isArray(initialData?.brand_personality) ? [...initialData.brand_personality] : [],
      brand_voice: initialData?.brand_voice || "",
      brand_mission: initialData?.brand_mission || "",
      brand_vision: initialData?.brand_vision || "",
      brand_values: Array.isArray(initialData?.brand_values) ? [...initialData.brand_values] : [],
      brand_story: initialData?.brand_story || "",
      positioning_statement: initialData?.positioning_statement || "",
      tone_of_voice: initialData?.tone_of_voice || "",
      core_messaging: Array.isArray(initialData?.core_messaging) ? [...initialData.core_messaging] : [],
      customer_personas: Array.isArray(initialData?.customer_personas) ? [...initialData.customer_personas] : [],
      customer_pain_points: Array.isArray(initialData?.customer_pain_points) ? [...initialData.customer_pain_points] : [],
      customer_journey_stages: Array.isArray(initialData?.customer_journey_stages) ? [...initialData.customer_journey_stages] : [],
      touchpoints: Array.isArray(initialData?.touchpoints) ? [...initialData.touchpoints] : [],
      marketing_channels: Array.isArray(initialData?.marketing_channels) ? [...initialData.marketing_channels] : [],
      marketing_budget: initialData?.marketing_budget || "",
      primary_marketing_goals: Array.isArray(initialData?.primary_marketing_goals) ? [...initialData.primary_marketing_goals] : [],
      current_marketing_activities: Array.isArray(initialData?.current_marketing_activities) ? [...initialData.current_marketing_activities] : [],
      target_metrics: initialData?.target_metrics || [],
      compliance_requirements: Array.isArray(initialData?.compliance_requirements) ? [...initialData.compliance_requirements] : [],
      privacy_policy_url: initialData?.privacy_policy_url || "",
      terms_of_service_url: initialData?.terms_of_service_url || "",
      social_media_facebook: initialData?.social_media_facebook || "",
      social_media_twitter: initialData?.social_media_twitter || "",
      social_media_linkedin: initialData?.social_media_linkedin || "",
      social_media_instagram: initialData?.social_media_instagram || "",
      social_media_youtube: initialData?.social_media_youtube || "",
      social_media_tiktok: initialData?.social_media_tiktok || "",
      social_media_pinterest: initialData?.social_media_pinterest || "",
      communication_channels: initialData?.communication_channels || [],
      channels: initialData?.channels || [],
      team_members: Array.isArray(initialData?.team_members) ? [...initialData.team_members] : [],
    }
  });

  // Don't reset the form if it's the same site
  useEffect(() => {
    if (siteId === lastSiteId) {
      console.log("ContextForm: Same site ID, skipping form reset:", siteId);
      return;
    }
    
    console.log("ContextForm: Resetting form for site ID:", siteId);
    setLastSiteId(siteId);
    
    // Reset the form with new data
    if (stableInitialData) {
      form.reset({
        name: stableInitialData.name || "",
        url: stableInitialData.url || "",
        description: stableInitialData.description || "",
        logo_url: stableInitialData.logo_url || "",
        resource_urls: stableInitialData.resource_urls || [],
        competitors: stableInitialData.competitors || [],
        focusMode: stableInitialData.focusMode || 50,
        about: stableInitialData.about || "",
        company_size: stableInitialData.company_size || "",
        industry: stableInitialData.industry || "",
        products: Array.isArray(stableInitialData.products) ? [...stableInitialData.products] : [],
        services: Array.isArray(stableInitialData.services) ? [...stableInitialData.services] : [],
        business_goals: Array.isArray(stableInitialData.business_goals) ? [...stableInitialData.business_goals] : [],
        financial_info: stableInitialData.financial_info ? { ...stableInitialData.financial_info } : { annual_revenue: "", monthly_recurring_revenue: "", customer_acquisition_cost: "", average_deal_size: "", burn_rate: "", runway_months: 0 },
        operational_info: stableInitialData.operational_info ? { ...stableInitialData.operational_info } : { countries: [], languages: [], time_zones: [] },
        key_metrics: Array.isArray(stableInitialData.key_metrics) ? [...stableInitialData.key_metrics] : [],
        technologies: Array.isArray(stableInitialData.technologies) ? [...stableInitialData.technologies] : [],
        target_audience: Array.isArray(stableInitialData.target_audience) ? [...stableInitialData.target_audience] : [],
        customer_segments: Array.isArray(stableInitialData.customer_segments) ? [...stableInitialData.customer_segments] : [],
        challenges: Array.isArray(stableInitialData.challenges) ? [...stableInitialData.challenges] : [],
        solution_description: stableInitialData.solution_description || "",
        value_proposition: stableInitialData.value_proposition || "",
        revenue_streams: Array.isArray(stableInitialData.revenue_streams) ? [...stableInitialData.revenue_streams] : [],
        strengths: Array.isArray(stableInitialData.strengths) ? [...stableInitialData.strengths] : [],
        weaknesses: Array.isArray(stableInitialData.weaknesses) ? [...stableInitialData.weaknesses] : [],
        opportunities: Array.isArray(stableInitialData.opportunities) ? [...stableInitialData.opportunities] : [],
        threats: Array.isArray(stableInitialData.threats) ? [...stableInitialData.threats] : [],
        goals: Array.isArray(stableInitialData.goals) ? [...stableInitialData.goals] : [],
        primary_color: stableInitialData.primary_color || "",
        secondary_color: stableInitialData.secondary_color || "",
        text_color: stableInitialData.text_color || "",
        background_color: stableInitialData.background_color || "",
        font_family: stableInitialData.font_family || "",
        brand_personality: Array.isArray(stableInitialData.brand_personality) ? [...stableInitialData.brand_personality] : [],
        brand_voice: stableInitialData.brand_voice || "",
        brand_mission: stableInitialData.brand_mission || "",
        brand_vision: stableInitialData.brand_vision || "",
        brand_values: Array.isArray(stableInitialData.brand_values) ? [...stableInitialData.brand_values] : [],
        brand_story: stableInitialData.brand_story || "",
        positioning_statement: stableInitialData.positioning_statement || "",
        tone_of_voice: stableInitialData.tone_of_voice || "",
        core_messaging: Array.isArray(stableInitialData.core_messaging) ? [...stableInitialData.core_messaging] : [],
        customer_personas: Array.isArray(stableInitialData.customer_personas) ? [...stableInitialData.customer_personas] : [],
        customer_pain_points: Array.isArray(stableInitialData.customer_pain_points) ? [...stableInitialData.customer_pain_points] : [],
        customer_journey_stages: Array.isArray(stableInitialData.customer_journey_stages) ? [...stableInitialData.customer_journey_stages] : [],
        touchpoints: Array.isArray(stableInitialData.touchpoints) ? [...stableInitialData.touchpoints] : [],
        marketing_channels: Array.isArray(stableInitialData.marketing_channels) ? [...stableInitialData.marketing_channels] : [],
        marketing_budget: stableInitialData.marketing_budget || "",
        primary_marketing_goals: Array.isArray(stableInitialData.primary_marketing_goals) ? [...stableInitialData.primary_marketing_goals] : [],
        current_marketing_activities: Array.isArray(stableInitialData.current_marketing_activities) ? [...stableInitialData.current_marketing_activities] : [],
        target_metrics: stableInitialData.target_metrics || [],
        compliance_requirements: Array.isArray(stableInitialData.compliance_requirements) ? [...stableInitialData.compliance_requirements] : [],
        privacy_policy_url: stableInitialData.privacy_policy_url || "",
        terms_of_service_url: stableInitialData.terms_of_service_url || "",
        social_media_facebook: stableInitialData.social_media_facebook || "",
        social_media_twitter: stableInitialData.social_media_twitter || "",
        social_media_linkedin: stableInitialData.social_media_linkedin || "",
        social_media_instagram: stableInitialData.social_media_instagram || "",
        social_media_youtube: stableInitialData.social_media_youtube || "",
        social_media_tiktok: stableInitialData.social_media_tiktok || "",
        social_media_pinterest: stableInitialData.social_media_pinterest || "",
        communication_channels: stableInitialData.communication_channels || [],
        channels: stableInitialData.channels || [],
        team_members: Array.isArray(stableInitialData.team_members) ? [...stableInitialData.team_members] : [],
      });
    }
  }, [stableInitialData, form, siteId, lastSiteId]);

  // Expose form via window for manual save handling
  useEffect(() => {
    (window as any).__debug_form = form;
    return () => {
      delete (window as any).__debug_form;
    };
  }, [form]);

  // Validation with improved error handling
  const validateAndSubmit = useCallback(async (data: SiteFormValues) => {
    try {
      console.log("ContextForm: Starting validation and submit process...");
      console.log("ContextForm: Form data:", data);
      
      // Validate the data
      const validatedData = siteFormSchema.parse(data);
      console.log("ContextForm: Data validated successfully");
      
      // Submit to parent component
      await onSubmit(validatedData);
      console.log("ContextForm: Submit completed successfully");
      
    } catch (error) {
      console.error("ContextForm: Validation or submit failed:", error);
      if (error instanceof Error) {
        console.error("ContextForm: Error message:", error.message);
        toast.error(`Validation failed: ${error.message}`);
      } else {
        toast.error("Validation failed. Please check your inputs.");
      }
      throw error;
    }
  }, [onSubmit]);

  const handleSubmit = useCallback(async (data: SiteFormValues) => {
    try {
      // Use the validated submit function
      await validateAndSubmit(data);
    } catch (error) {
      // Error is already logged and toasted in validateAndSubmit
      console.error("ContextForm: handleSubmit failed:", error);
    }
  }, [validateAndSubmit]);

  // Copy tracking code functionality (not needed for context form but keeping for compatibility)
  const [codeCopied, setCodeCopied] = useState(false)
  
  const copyTrackingCode = async () => {
    if (!siteId) {
      toast.error("Site ID not available");
      return;
    }

    const trackingCode = `<!-- Market Fit Analytics -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${window.location.origin}/api/tracking/track.js';
    script.async = true;
    script.dataset.siteId = '${siteId}';
    document.head.appendChild(script);
  })();
</script>
<!-- End Market Fit Analytics -->`

    try {
      await navigator.clipboard.writeText(trackingCode);
      setCodeCopied(true);
      toast.success("Tracking code copied to clipboard");
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy using Clipboard API:", err);
      
      // Fallback method
      try {
        const textArea = document.createElement("textarea");
        textArea.value = trackingCode;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        
        let success = false;
        try {
          success = document.execCommand('copy');
        } catch (execErr) {
          console.error("Fallback copy method failed:", execErr);
        }
        
        document.body.removeChild(textArea);
        
        if (success) {
          setCodeCopied(true);
          toast.success("Tracking code copied to clipboard");
          setTimeout(() => setCodeCopied(false), 2000);
        } else {
          throw new Error("Copy command failed");
        }
      } catch (fallbackErr) {
        console.error("Error copying tracking code:", fallbackErr);
        toast.error("Failed to copy tracking code. Please try selecting and copying manually.");
      }
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
      <form id={id} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-12">
        <div className="space-y-12">
          {renderCard("general", 
            <GeneralSection active={true} />
          )}

          {renderCard("company",
            <CompanySection active={true} />
          )}

          {renderCard("branding",
            <BrandingSection active={true} />
          )}

          {renderCard("marketing",
            <MarketingSection active={true} />
          )}

          {renderCard("customer-journey",
            <CustomerJourneySection active={true} />
          )}

          {renderCard("social",
            <SocialSection active={true} />
          )}

          {renderCard("general",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Cache Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Clear the cache and rebuild all experiments. This will take a few minutes.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12"
                    onClick={onCacheAndRebuild}
                    disabled={isSaving}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear Cache and Rebuild
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {renderCard("general",
            <Card className="border border-destructive/30 shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Once you delete a site, there is no going back. Please be certain.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full h-12"
                    onClick={onDeleteSite}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Site
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </form>
    </FormProvider>
  )
}