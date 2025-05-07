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
import { MarketingSection } from "./MarketingSection"
import { SocialSection } from "./SocialSection"
import { ChannelsSection } from "./ChannelsSection"
import { TeamSection } from "./TeamSection"
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

interface SiteFormProps {
  id?: string
  initialData?: Partial<SiteFormValues>
  onSubmit: (data: SiteFormValues) => void
  onDeleteSite?: () => void
  onCacheAndRebuild?: () => void
  isSaving?: boolean
  activeSegment: string
  siteId?: string
}

export function SiteForm({ 
  id, 
  initialData, 
  onSubmit, 
  onDeleteSite, 
  onCacheAndRebuild, 
  isSaving, 
  activeSegment,
  siteId 
}: SiteFormProps) {
  
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
          outgoingPort: ""
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
      analytics_provider: initialData?.analytics_provider || "",
      analytics_id: initialData?.analytics_id || "",
      tracking_code: initialData?.tracking_code || "",
      whatsapp_token: initialData?.whatsapp_token || "",
      billing: initialData?.billing || {
        plan: "free",
        auto_renew: true
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

  // Actualizar explícitamente el formulario cuando cambien los initialData
  useEffect(() => {
    if (initialData) {
      console.log("SiteForm: initialData changed, updating form values");
      
      // Asegurar que los valores de goals se establecen correctamente
      if (initialData.goals) {
        console.log("SiteForm: Updating goals fields:", initialData.goals);
        form.setValue("goals", {
          quarterly: initialData.goals.quarterly || "",
          yearly: initialData.goals.yearly || "",
          fiveYear: initialData.goals.fiveYear || "",
          tenYear: initialData.goals.tenYear || ""
        });
      }
      
      // Puedes hacer lo mismo con otros campos si es necesario
    }
  }, [initialData, form]);

  const handleSubmit = async (data: SiteFormValues) => {
    console.log("Form data in site-form component:", data);
    
    try {
      // Basic client-side validation
      if (!data.name?.trim()) {
        throw new Error("Site name is required");
      }
      
      if (!data.url?.trim()) {
        throw new Error("Site URL is required");
      }
      
      // Check URL format for required fields
      if (data.url && !data.url.match(/^https?:\/\/.+/)) {
        throw new Error("Site URL must be a valid URL starting with http:// or https://");
      }
      
      // Ensure goals fields are always strings
      if (data.goals) {
        data.goals = {
          quarterly: data.goals.quarterly || "",
          yearly: data.goals.yearly || "",
          fiveYear: data.goals.fiveYear || "",
          tenYear: data.goals.tenYear || ""
        };
      }
      
      // Filter social media to only include entries with valid URLs
      if (data.social_media) {
        data.social_media = data.social_media.filter(sm => {
          if (!sm.platform) return false;
          
          // Platform-specific validations
          switch (sm.platform) {
            case 'whatsapp':
              // WhatsApp requires phone number
              if (!sm.phone || sm.phone.trim() === '') {
                return false;
              }
              return true;
            
            case 'telegram':
              // Telegram requires either a handle or a URL
              if ((!sm.handle || sm.handle.trim() === '') && (!sm.url || sm.url.trim() === '')) {
                return false;
              }
              
              // Validate URL format if provided
              if (sm.url && sm.url.trim() !== '' && !sm.url.match(/^https?:\/\/.+/)) {
                return false;
              }
              return true;
              
            case 'discord':
              // Discord requires either an invite code or a URL
              if ((!sm.inviteCode || sm.inviteCode.trim() === '') && (!sm.url || sm.url.trim() === '')) {
                return false;
              }
              
              // Validate URL format if provided
              if (sm.url && sm.url.trim() !== '' && !sm.url.match(/^https?:\/\/.+/)) {
                return false;
              }
              return true;
              
            default:
              // For standard platforms, URL is not required - we can just have a handle
              // But if URL is provided, validate its format
              if (sm.url && sm.url.trim() !== '') {
                const hasValidUrl = sm.url.match(/^https?:\/\/.+/);
                if (!hasValidUrl) {
                  return false;
                }
              }
              return true;
          }
        });
      }
      
      // Ensure focusMode is within bounds
      if (typeof data.focusMode === 'number') {
        // Clamp value between 0 and 100
        data.focusMode = Math.max(0, Math.min(100, data.focusMode));
        
        // Final save of the focus mode value before submission (no debounce needed here)
        if (siteId) {
          saveFocusMode(data.focusMode);
        }
      }
      
      // Pass the entire form data to the parent component
      onSubmit(data);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Validation error:", error.message);
        toast.error(error.message);
      }
    }
  }

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
  // Market Fit Tracking Code
  (function() {
    window.MarketFit = window.MarketFit || {};
    MarketFit.siteId = "${initialData ? initialData.name : 'YOUR_SITE_NAME'}";
    MarketFit.trackVisitors = ${form.watch("tracking.track_visitors")};
    MarketFit.trackActions = ${form.watch("tracking.track_actions")};
    MarketFit.recordScreen = ${form.watch("tracking.record_screen")};
    MarketFit.enableChat = ${form.watch("tracking.enable_chat")};
    MarketFit.chatAccentColor = "${form.watch("tracking.chat_accent_color") || "#e0ff17"}";
    MarketFit.allowAnonymousMessages = ${form.watch("tracking.allow_anonymous_messages")};
    MarketFit.chatPosition = "${form.watch("tracking.chat_position") || "bottom-right"}";
    MarketFit.chatTitle = "${form.watch("tracking.chat_title") || "Chat with us"}";
    MarketFit.welcomeMessage = "${form.watch("tracking.welcome_message") || "Welcome to our website! How can we assist you today?"}";
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://api.market-fit.ai/tracking.js';
    var firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  })();
</script>`

    try {
      await navigator.clipboard.writeText(trackingCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch (err) {
      console.error("Error copying tracking code:", err)
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
      <form id={id} onSubmit={(e) => {
        console.log("Form Submit Event Triggered", e);
        form.handleSubmit(handleSubmit)(e);
      }} className="space-y-12">
        <div className="space-y-12">
          {renderCard("general", 
            <GeneralSection active={true} />
          )}

          {renderCard("company",
            <CompanySection active={true} />
          )}

          {renderCard("marketing",
            <MarketingSection active={true} />
          )}

          {renderCard("social",
            <SocialSection active={true} />
          )}

          {renderCard("channels",
            <ChannelsSection 
              active={true} 
              copyTrackingCode={copyTrackingCode} 
              codeCopied={codeCopied} 
              siteName={initialData?.name || ''}
              siteId={siteId}
            />
          )}

          {renderCard("team",
            <TeamSection active={true} siteId={siteId} />
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

          {renderCard("billing",
            <div className="space-y-8">
              <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Credits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="text-3xl font-bold">25 <span className="text-sm font-medium text-muted-foreground">credits available</span></div>
                      <div className="text-sm text-muted-foreground mt-1">Your credits will reset on the first day of each month</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button variant="outline" className="h-10">
                        View usage history
                      </Button>
                      <Button className="h-10">
                        Buy more credits
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div 
                      className="border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-300 flex flex-col items-center justify-center text-center"
                    >
                      <div className="font-medium mb-2">50 Credits</div>
                      <div className="text-2xl font-bold mb-2">$19</div>
                      <div className="text-sm text-muted-foreground">One-time purchase</div>
                    </div>
                    
                    <div 
                      className="border border-blue-500 rounded-lg p-4 transition-all flex flex-col items-center justify-center text-center relative bg-blue-50/30 dark:bg-blue-900/20"
                    >
                      <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs py-0.5 px-2 rounded-full">Most popular</div>
                      <div className="font-medium mb-2">100 Credits</div>
                      <div className="text-2xl font-bold mb-2">$29</div>
                      <div className="text-sm text-muted-foreground">One-time purchase</div>
                    </div>
                    
                    <div 
                      className="border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-300 flex flex-col items-center justify-center text-center"
                    >
                      <div className="font-medium mb-2">200 Credits</div>
                      <div className="text-2xl font-bold mb-2">$49</div>
                      <div className="text-sm text-muted-foreground">One-time purchase</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Subscription Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <FormField
                    control={form.control}
                    name="billing.plan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Current Plan</FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div 
                              className={cn(
                                "border rounded-lg p-4 cursor-pointer transition-all",
                                field.value === "free" 
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                                  : "border-border hover:border-blue-300"
                              )}
                              onClick={() => field.onChange("free")}
                            >
                              <div className="font-medium mb-2">Free</div>
                              <div className="text-2xl font-bold mb-2">$0</div>
                              <div className="text-sm text-muted-foreground">Basic features</div>
                            </div>
                            
                            <div 
                              className={cn(
                                "border rounded-lg p-4 cursor-pointer transition-all",
                                field.value === "starter" 
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                                  : "border-border hover:border-blue-300"
                              )}
                              onClick={() => field.onChange("starter")}
                            >
                              <div className="font-medium mb-2">Starter</div>
                              <div className="text-2xl font-bold mb-2">$29</div>
                              <div className="text-sm text-muted-foreground">100 credits/mo</div>
                            </div>
                            
                            <div 
                              className={cn(
                                "border rounded-lg p-4 cursor-pointer transition-all",
                                field.value === "professional" 
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                                  : "border-border hover:border-blue-300"
                              )}
                              onClick={() => field.onChange("professional")}
                            >
                              <div className="font-medium mb-2">Professional</div>
                              <div className="text-2xl font-bold mb-2">$79</div>
                              <div className="text-sm text-muted-foreground">500 credits/mo</div>
                            </div>
                            
                            <div 
                              className={cn(
                                "border rounded-lg p-4 cursor-pointer transition-all",
                                field.value === "enterprise" 
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                                  : "border-border hover:border-blue-300"
                              )}
                              onClick={() => field.onChange("enterprise")}
                            >
                              <div className="font-medium mb-2">Enterprise</div>
                              <div className="text-2xl font-bold mb-2">$199</div>
                              <div className="text-sm text-muted-foreground">Unlimited credits</div>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="billing.auto_renew"
                    render={({ field }) => (
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-medium flex items-center">
                            <RotateCcw className="mr-2 h-4 w-4 text-muted-foreground" />
                            Auto-renew subscription
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Automatically renew your subscription when it expires
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                    )}
                  />
                </CardContent>
              </Card>
              
              <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Payment Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <FormField
                    control={form.control}
                    name="billing.card_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Cardholder Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base" 
                              placeholder="John Doe"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="billing.card_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Card Number</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base" 
                              placeholder="•••• •••• •••• ••••"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="billing.card_expiry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Expiration Date</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="MM/YY"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="billing.card_cvc"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">CVC</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="123"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Billing Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <FormField
                    control={form.control}
                    name="billing.billing_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Street Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base" 
                              placeholder="123 Main St"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="billing.billing_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">City</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="New York"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="billing.billing_postal_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Postal Code</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="10001"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="billing.billing_country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Country</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="United States"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </form>
    </FormProvider>
  )
} 