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
import { CopywritingSection } from "./CopywritingSection"
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
  onSaveGeneral?: (data: SiteFormValues) => void
  onSaveCompany?: (data: SiteFormValues) => void
  onSaveBranding?: (data: SiteFormValues) => void
  onSaveMarketing?: (data: SiteFormValues) => void
  onSaveCustomerJourney?: (data: SiteFormValues) => void
  onSaveSocial?: (data: SiteFormValues) => void
  onDeleteSite?: () => void
  onCacheAndRebuild?: () => void
  isSaving?: boolean
  activeSegment: string
  siteId?: string
}

export function ContextForm({ 
  id, 
  initialData, 
  onSaveGeneral,
  onSaveCompany,
  onSaveBranding,
  onSaveMarketing,
  onSaveCustomerJourney,
  onSaveSocial,
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
      // Use initial data businessModel if available, otherwise default to false values
      businessModel: stableInitialData?.businessModel || {
        b2b: false,
        b2c: false,
        b2b2c: false
      },
      focusMode: 50,
      // Copywriting is loaded separately by CopywritingSection, don't initialize as empty array
      copywriting: stableInitialData?.copywriting || [],
      ...stableInitialData
    }
  });

  // Don't reset the form if it's the same site
  useEffect(() => {
    if (siteId === lastSiteId) {
      console.log("ContextForm: Same site ID, skipping form reset:", siteId);
      return;
    }
    
    console.log("ContextForm: Resetting form for site ID:", siteId);
    console.log("ContextForm: stableInitialData:", stableInitialData);
    console.log("ContextForm: businessModel from data:", stableInitialData?.businessModel);
    setLastSiteId(siteId);
    
    // Preserve current copywriting data if it exists (it's loaded separately by CopywritingSection)
    const currentCopywriting = form.getValues('copywriting') || [];
    const hasExistingCopywriting = Array.isArray(currentCopywriting) && currentCopywriting.length > 0;
    
    // Preserve current team_members data if it exists (it's loaded separately by TeamSection)
    const currentTeamMembers = form.getValues('team_members') || [];
    const hasExistingTeamMembers = Array.isArray(currentTeamMembers) && currentTeamMembers.length > 0;
    
    // Preserve current businessModel data if it exists (to prevent accidental reset)
    const currentBusinessModel = form.getValues('businessModel');
    const hasBusinessModelValues = currentBusinessModel && (
      currentBusinessModel.b2b === true || 
      currentBusinessModel.b2c === true || 
      currentBusinessModel.b2b2c === true
    );
    
    // Preserve current focusMode if it exists (to prevent accidental reset to default)
    const currentFocusMode = form.getValues('focusMode');
    const hasCustomFocusMode = currentFocusMode !== undefined && currentFocusMode !== 50;
    
    // Reset the form with new data
    const formData = {
      // Preserve copywriting data if it exists, otherwise use initial data or empty array
      // Copywriting is managed separately by CopywritingSection, so we don't want to clear it
      copywriting: hasExistingCopywriting ? currentCopywriting : (stableInitialData?.copywriting || []),
      // Spread initial data first
      ...stableInitialData,
      // Override focusMode after spread to ensure preserved values take precedence
      focusMode: hasCustomFocusMode 
        ? currentFocusMode 
        : (stableInitialData?.focusMode || 50),
      // Override businessModel after spread to ensure preserved values take precedence
      businessModel: hasBusinessModelValues 
        ? currentBusinessModel 
        : (stableInitialData?.businessModel || {
            b2b: false,
            b2c: false,
            b2b2c: false
          }),
      // Preserve team_members data if it exists, otherwise use initial data or empty array
      // Team_members is managed separately by TeamSection, so we don't want to clear it
      team_members: hasExistingTeamMembers ? currentTeamMembers : (stableInitialData?.team_members || [])
    };
    
    console.log("ContextForm: Final formData.businessModel:", formData.businessModel);
    console.log("ContextForm: Final formData.focusMode:", formData.focusMode);
    console.log("ContextForm: Preserving copywriting data:", hasExistingCopywriting ? `${currentCopywriting.length} items` : 'none');
    console.log("ContextForm: Preserving team_members data:", hasExistingTeamMembers ? `${currentTeamMembers.length} members` : 'none');
    console.log("ContextForm: Preserving businessModel:", hasBusinessModelValues ? JSON.stringify(currentBusinessModel) : (stableInitialData?.businessModel ? 'using initial data' : 'using defaults'));
    console.log("ContextForm: Preserving focusMode:", hasCustomFocusMode ? currentFocusMode : (stableInitialData?.focusMode ? `using initial data (${stableInitialData.focusMode})` : 'using default (50)'));
    form.reset(formData);
  }, [stableInitialData, form, siteId, lastSiteId]);


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
      <form id={id} className="space-y-12">
        <div className="space-y-12">
          {renderCard("general", 
            <GeneralSection active={true} onSave={onSaveGeneral} />
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

          {renderCard("copywriting",
            <CopywritingSection 
              active={true} 
              onSave={async () => {
                const formData = form.getValues()
                // Copywriting is saved separately through copywritingService,
                // but we call onSaveGeneral to trigger a refresh
                if (onSaveGeneral) {
                  await onSaveGeneral(formData)
                }
              }}
              isSaving={isSaving}
            />
          )}

          {renderCard("customer-journey",
            <CustomerJourneySection active={true} onSave={onSaveCustomerJourney} />
          )}

          {renderCard("social",
            <SocialSection active={true} onSave={onSaveSocial} />
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