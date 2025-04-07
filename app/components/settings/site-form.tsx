"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Slider } from "../ui/slider"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useDropzone } from "react-dropzone"
import { UploadCloud, Trash2, PlusCircle, AppWindow, Globe, FileText, Link, Tag, RotateCcw, Copy, Code, Check, User } from "@/app/components/ui/icons"
import { Button } from "../ui/button"
import type { TablesUpdate, ResourceUrl, CompetitorUrl } from "@/lib/types/database.types"
import type { Site } from "@/app/context/SiteContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Switch } from "../ui/switch"
import { useState } from "react"

const siteFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  resource_urls: z.array(z.object({
    key: z.string().min(1, "Name is required"),
    url: z.string().url("Must be a valid URL")
  })).optional().default([]),
  competitors: z.array(z.object({
    url: z.string().url("Must be a valid URL"),
    name: z.string().optional()
  })).optional().default([]),
  focusMode: z.number().min(0).max(100),
  about: z.string().optional(),
  company_size: z.string().optional(),
  products: z.array(z.string()).optional().default([]),
  services: z.array(z.string()).optional().default([]),
  industry: z.string().optional(),
  locations: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    address: z.string().optional(),
    country: z.string().optional()
  })).optional().default([]),
  swot: z.object({
    strengths: z.string().optional(),
    weaknesses: z.string().optional(),
    opportunities: z.string().optional(),
    threats: z.string().optional()
  }).optional().default({
    strengths: "",
    weaknesses: "",
    opportunities: "",
    threats: ""
  }),
  marketing_budget: z.object({
    total: z.number().min(0).optional(),
    available: z.number().min(0).optional()
  }).optional().default({
    total: 0,
    available: 0
  }),
  team_members: z.array(z.object({
    email: z.string().email("Must be a valid email"),
    role: z.enum(["view", "create", "delete", "admin"], {
      required_error: "Role is required",
    }),
    name: z.string().optional()
  })).optional().default([]),
  tracking: z.object({
    track_visitors: z.boolean().optional().default(false),
    track_actions: z.boolean().optional().default(false),
    record_screen: z.boolean().optional().default(false)
  }).optional().default({
    track_visitors: false,
    track_actions: false,
    record_screen: false
  }),
  billing: z.object({
    plan: z.enum(["free", "starter", "professional", "enterprise"]).default("free"),
    card_number: z.string().optional(),
    card_expiry: z.string().optional(),
    card_cvc: z.string().optional(),
    card_name: z.string().optional(),
    billing_address: z.string().optional(),
    billing_city: z.string().optional(),
    billing_postal_code: z.string().optional(),
    billing_country: z.string().optional(),
    auto_renew: z.boolean().default(true)
  }).optional().default({
    plan: "free",
    auto_renew: true
  })
})

type SiteFormValues = z.infer<typeof siteFormSchema>

interface SiteFormProps {
  id?: string
  initialData?: Partial<SiteFormValues>
  onSubmit: (data: Partial<Site>) => void
  onDeleteSite?: () => void
  onCacheAndRebuild?: () => void
  isSaving?: boolean
  activeSegment: string
}

export function SiteForm({ id, initialData, onSubmit, onDeleteSite, onCacheAndRebuild, isSaving, activeSegment }: SiteFormProps) {
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
      products: initialData?.products || [],
      services: initialData?.services || [],
      industry: initialData?.industry || "",
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
      team_members: initialData?.team_members || [],
      tracking: initialData?.tracking || {
        track_visitors: false,
        track_actions: false,
        record_screen: false
      },
      billing: initialData?.billing || {
        plan: "free",
        auto_renew: true
      }
    }
  })

  const [codeCopied, setCodeCopied] = useState(false)

  const handleSubmit = async (data: SiteFormValues) => {
    const siteData: Partial<Site> = {
      ...initialData,
      name: data.name,
      url: data.url,
      description: data.description || null,
      logo_url: data.logo_url || null,
      resource_urls: data.resource_urls as ResourceUrl[] || null,
      competitors: data.competitors as CompetitorUrl[] || null,
      focus_mode: data.focusMode,
      focusMode: data.focusMode,
      tracking: data.tracking || {
        track_visitors: false,
        track_actions: false,
        record_screen: false
      },
      billing: data.billing
    }
    onSubmit(siteData)
  }

  const getFocusModeConfig = (value: number) => {
    // Strong sales focus (0-20)
    if (value <= 20) {
      return {
        label: "Revenue Maximizer",
        description: "Agents will aggressively pursue sales opportunities and conversions, prioritizing immediate revenue.",
        features: [
          "Agents will proactively suggest premium upgrades in every interaction",
          "Responses focus heavily on ROI and business impact",
          "Strong emphasis on exclusive paid features",
          "Enterprise client queries receive highest priority",
          "Messaging optimized for direct purchase decisions"
        ],
        color: "text-blue-600",
        sliderClass: "bg-blue-600"
      }
    }
    
    // Moderate sales focus (21-40)
    if (value <= 40) {
      return {
        label: "Sales Focus",
        description: "Agents will prioritize conversion opportunities while still providing quality support.",
        features: [
          "Agents regularly suggest premium plans when relevant",
          "Responses emphasize value proposition and business benefits",
          "Most examples demonstrate premium features",
          "High-value customer queries are prioritized",
          "Messaging includes clear calls-to-action for upgrades"
        ],
        color: "text-blue-600",
        sliderClass: "bg-blue-600"
      }
    }
    
    // Slight sales tilt (41-49)
    if (value <= 49) {
      return {
        label: "Balanced (Sales Leaning)",
        description: "Agents will balance support with strategic sales opportunities, with a slight focus on conversions.",
        features: [
          "Agents provide thorough support with occasional upgrade suggestions",
          "Responses blend educational content with commercial benefits",
          "Examples include both free and premium capabilities",
          "Equal attention to all users with slight prioritization of paying customers",
          "Messaging subtly highlights premium value"
        ],
        color: "text-purple-600",
        sliderClass: "bg-purple-600"
      }
    }
    
    // Perfect balance (50)
    if (value === 50) {
      return {
        label: "Perfect Balance",
        description: "Agents will maintain an ideal equilibrium between support, education and commercial opportunities.",
        features: [
          "Agents perfectly balance helpfulness and business objectives",
          "Responses give equal weight to educational and commercial content",
          "Examples show balanced use cases for all user tiers",
          "All users receive identical priority and attention",
          "Messaging combines educational value with subtle commercial elements"
        ],
        color: "text-purple-600",
        sliderClass: "bg-purple-600"
      }
    }
    
    // Slight growth tilt (51-60)
    if (value <= 60) {
      return {
        label: "Balanced (Growth Leaning)",
        description: "Agents will focus on helpful support with user growth in mind, with minimal sales emphasis.",
        features: [
          "Agents prioritize being helpful with minimal sales messaging",
          "Responses focus on user education with rare premium mentions",
          "Examples primarily showcase free features with some premium options",
          "New users receive slightly higher priority",
          "Messaging emphasizes user success with subtle premium references"
        ],
        color: "text-purple-600",
        sliderClass: "bg-purple-600"
      }
    }
    
    // Moderate growth focus (61-80)
    if (value <= 80) {
      return {
        label: "Growth Focus",
        description: "Agents will emphasize user acquisition and retention, with educational content and engagement.",
        features: [
          "Agents focus primarily on user satisfaction and education",
          "Responses provide in-depth guidance without sales pressure",
          "Examples highlight free features and community benefits",
          "New user onboarding is highly prioritized",
          "Messaging centered on long-term user success"
        ],
        color: "text-green-600",
        sliderClass: "bg-green-600"
      }
    }
    
    // Strong growth focus (81-100)
    return {
      label: "Growth Maximizer",
      description: "Agents will exclusively focus on user experience, education, and community building.",
      features: [
        "Agents exclusively provide helpful support with no sales messaging",
        "Responses offer comprehensive educational content and resources",
        "Examples exclusively demonstrate free and community features",
        "New users receive the highest level of attention and care",
        "Messaging entirely focused on user empowerment and success"
      ],
      color: "text-green-600",
      sliderClass: "bg-green-600"
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
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-12">
        <div className="space-y-12">
          {renderCard("general", 
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Site Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
                  <div className="min-w-[240px] flex-shrink-0">
                    <FormField
                      control={form.control}
                      name="logo_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Logo</FormLabel>
                          <FormControl>
                            <div className="w-[240px] h-[240px] relative">
                              {field.value ? (
                                <div className="w-full h-full relative group">
                                  <Image
                                    src={field.value}
                                    alt="Site logo"
                                    fill
                                    className="object-contain rounded-lg"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => field.onChange("")}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                                  >
                                    <Trash2 className="h-4 w-4 text-white" />
                                  </button>
                                </div>
                              ) : (
                                <div
                                  {...getRootProps()}
                                  className="w-full h-full rounded-lg border-2 border-dashed border-input bg-muted flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-input/80 hover:bg-muted/80 transition-colors"
                                >
                                  <input {...getInputProps()} />
                                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                                  <div className="text-sm text-center">
                                    <p className="font-medium text-foreground">Click to upload</p>
                                    <p className="text-muted-foreground">or drag and drop</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex-1 space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Site Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="Enter your site name"
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
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Site URL</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="https://example.com"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Description</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Tag className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                          <Textarea 
                            className="pl-12 resize-none min-h-[120px] text-base"
                            placeholder="Describe your site..."
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs mt-2" />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {renderCard("company",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                <FormField
                  control={form.control}
                  name="about"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">About</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <FileText className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                          <Textarea 
                            className="pl-12 resize-none min-h-[120px] text-base"
                            placeholder="Tell us about your company..."
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
                  name="company_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Company Size</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            className="pl-12 h-12 text-base" 
                            placeholder="e.g. 50-100 employees"
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
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Industry</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            className="pl-12 h-12 text-base" 
                            placeholder="e.g. Technology, Healthcare"
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs mt-2" />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {renderCard("company",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">SWOT Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="swot.strengths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-green-600">Strengths</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                              <Textarea 
                                className="pl-12 resize-none min-h-[120px] text-base"
                                placeholder="What are your company's strengths?"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="swot.weaknesses"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-red-600">Weaknesses</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                              <Textarea 
                                className="pl-12 resize-none min-h-[120px] text-base"
                                placeholder="What are your company's weaknesses?"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="swot.opportunities"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-blue-600">Opportunities</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                              <Textarea 
                                className="pl-12 resize-none min-h-[120px] text-base"
                                placeholder="What opportunities are available to your company?"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="swot.threats"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-orange-600">Threats</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                              <Textarea 
                                className="pl-12 resize-none min-h-[120px] text-base"
                                placeholder="What threats could affect your company?"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {renderCard("company",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                {form.watch("products")?.map((_, index) => (
                  <FormField
                    key={index}
                    control={form.control}
                    name={`products.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base" 
                              placeholder="Product name"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => {
                    const current = form.getValues("products") || []
                    form.setValue("products", [...current, ""])
                  }}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </CardContent>
            </Card>
          )}

          {renderCard("company",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                {form.watch("services")?.map((_, index) => (
                  <FormField
                    key={index}
                    control={form.control}
                    name={`services.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative">
                            <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base" 
                              placeholder="Service name"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => {
                    const current = form.getValues("services") || []
                    form.setValue("services", [...current, ""])
                  }}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </CardContent>
            </Card>
          )}

          {renderCard("company",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Locations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                {form.watch("locations")?.map((_, index) => (
                  <div key={index} className="space-y-4">
                    <FormField
                      control={form.control}
                      name={`locations.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Location Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="e.g. Headquarters, Branch Office"
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
                      name={`locations.${index}.address`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="Full address"
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
                      name={`locations.${index}.country`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Country</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="Country name"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => {
                    const current = form.getValues("locations") || []
                    form.setValue("locations", [...current, { name: "", address: "", country: "" }])
                  }}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Location
                </Button>
              </CardContent>
            </Card>
          )}

          {renderCard("marketing",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Marketing Budget</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <FormField
                    control={form.control}
                    name="marketing_budget.total"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Total Budget</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="number"
                              className="pl-12 h-12 text-base" 
                              placeholder="Enter total budget"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="marketing_budget.available"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Available Budget</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="number"
                              className="pl-12 h-12 text-base" 
                              placeholder="Enter available budget"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
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
          )}

          {renderCard("marketing",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Focus Mode</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                <FormField
                  control={form.control}
                  name="focusMode"
                  render={({ field }) => (
                    <FormItem className="space-y-6">
                      <FormControl>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="grid grid-cols-3 w-full gap-2">
                              <div className="text-center">
                                <div className="text-sm font-medium text-blue-600">Sales</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-medium text-purple-600">Balanced</div>
                              </div>
                              <div className="text-center">
                                <div className="text-sm font-medium text-green-600">Growth</div>
                              </div>
                            </div>
                          </div>
                          <Slider
                            value={[field.value]}
                            onValueChange={([value]) => field.onChange(value)}
                            max={100}
                            step={1}
                            className={cn(
                              "py-6 px-6",
                              "[&_[role=slider]]:h-6",
                              "[&_[role=slider]]:w-6",
                              "[&_[role=slider]]:border-2",
                              "[&_[role=slider]]:border-white",
                              "[&_[role=slider]]:shadow-md",
                              "[&_[role=slider]]:transition-colors",
                              "[&_[role=slider]]:duration-200",
                              "[&_[role=slider]]:rounded-full",
                              "[&_.range]:transition-colors",
                              "[&_.range]:duration-200",
                              "[&]:h-4",
                              "[&]:bg-gray-100",
                              "[&]:dark:bg-gray-800",
                              "[&]:rounded-full",
                            )}
                          />

                          <div className="mt-4">
                            <h3 className={cn("text-lg font-semibold", getFocusModeConfig(field.value).color)}>
                              {getFocusModeConfig(field.value).label}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {getFocusModeConfig(field.value).description}
                            </p>
                            <ul className="mt-4 space-y-2">
                              {getFocusModeConfig(field.value).features.map((feature, index) => (
                                <li key={index} className="text-sm text-gray-600 flex items-start">
                                  <span className="mr-2">•</span>
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {renderCard("marketing",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Competitors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                {form.watch("competitors")?.map((_, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`competitors.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Competitor Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="Competitor Inc."
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
                      name={`competitors.${index}.url`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Competitor URL</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Link className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="https://competitor.com"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => {
                    const current = form.getValues("competitors") || []
                    form.setValue("competitors", [...current, { url: "", name: "" }])
                  }}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Competitor
                </Button>
              </CardContent>
            </Card>
          )}

          {renderCard("marketing",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                {form.watch("resource_urls")?.map((_, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`resource_urls.${index}.key`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Resource Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="Documentation"
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
                      name={`resource_urls.${index}.url`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Resource URL</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Link className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input 
                                className="pl-12 h-12 text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200" 
                                placeholder="https://docs.example.com"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => {
                    const current = form.getValues("resource_urls") || []
                    form.setValue("resource_urls", [...current, { key: "", url: "" }])
                  }}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Resource
                </Button>
              </CardContent>
            </Card>
          )}

          {renderCard("tracking",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Tracking Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="tracking.track_visitors"
                    render={({ field }) => (
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-medium flex items-center">
                            <User className="mr-2 h-4 w-4 text-muted-foreground" />
                            Track Visitors
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Track users who visit your site
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
                  
                  <FormField
                    control={form.control}
                    name="tracking.track_actions"
                    render={({ field }) => (
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-medium flex items-center">
                            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                            Track Actions
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Record clicks, form submissions and other interactions
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
                  
                  <FormField
                    control={form.control}
                    name="tracking.record_screen"
                    render={({ field }) => (
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-medium flex items-center">
                            <AppWindow className="mr-2 h-4 w-4 text-muted-foreground" />
                            Record Screen
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Record screen sessions of your visitors
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
                </div>

                <Card className="bg-muted border-none">
                  <CardHeader className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Tracking Code</CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={copyTrackingCode}
                        className="flex items-center h-8"
                      >
                        {codeCopied ? (
                          <>
                            <Check className="mr-2 h-3 w-3" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-3 w-3" />
                            Copy Code
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-border/30">
                      <p className="text-sm text-muted-foreground mb-1">
                        Paste this code in the <span className="font-mono bg-background/80 rounded px-1">&lt;head&gt;</span> section of your website.
                      </p>
                    </div>
                    <div className="bg-black text-green-400 text-sm p-4 rounded-b-lg overflow-x-auto font-mono">
                      <pre className="whitespace-pre-wrap break-words">
                        <code>{`<script>
  // Market Fit Tracking Code
  (function() {
    window.MarketFit = window.MarketFit || {};
    MarketFit.siteId = "${initialData ? initialData.name : 'YOUR_SITE_NAME'}";
    MarketFit.trackVisitors = ${form.watch("tracking.track_visitors")};
    MarketFit.trackActions = ${form.watch("tracking.track_actions")};
    MarketFit.recordScreen = ${form.watch("tracking.record_screen")};
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://api.market-fit.ai/tracking.js';
    var firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  })();
</script>`}</code>
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          )}

          {renderCard("team",
            <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Team Members</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Invite team members to collaborate on your site. They will receive an email invitation.
                  </p>
                </div>

                {form.watch("team_members")?.map((_, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`team_members.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-12 h-12 text-base" 
                                placeholder="Full name"
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
                      name={`team_members.${index}.email`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type="email"
                                className="pl-12 h-12 text-base" 
                                placeholder="team@example.com"
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
                      name={`team_members.${index}.role`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-foreground">Role</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger className="h-12">
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="view">View</SelectItem>
                                <SelectItem value="create">Create</SelectItem>
                                <SelectItem value="delete">Delete</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage className="text-xs mt-2" />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => {
                    const current = form.getValues("team_members") || []
                    form.setValue("team_members", [...current, { email: "", role: "view", name: "" }])
                  }}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Team Member
                </Button>
              </CardContent>
            </Card>
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
    </Form>
  )
} 