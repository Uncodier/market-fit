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
      // Ensure business model has default values
      businessModel: {
        b2b: false,
        b2c: false,
        b2b2c: false
      },
      focusMode: 50,
      copywriting: [],
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
    
    // Reset the form with new data
    const formData = {
      // Ensure business model has default values
      businessModel: {
        b2b: false,
        b2c: false,
        b2b2c: false
      },
      focusMode: 50,
      copywriting: [],
      ...stableInitialData
    };
    
    console.log("ContextForm: Final formData.businessModel:", formData.businessModel);
    form.reset(formData);
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

          {renderCard("copywriting",
            <CopywritingSection 
              active={true} 
              onSave={async () => {
                const formData = form.getValues()
                await onSubmit(formData)
              }}
              isSaving={isSaving}
            />
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