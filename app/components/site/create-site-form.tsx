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
import { UploadCloud, Trash2, PlusCircle, AppWindow, Globe, FileText, Link, Tag } from "@/app/components/ui/icons"
import { Button } from "../ui/button"
import type { TablesInsert, ResourceUrl, CompetitorUrl } from "@/lib/types/database.types"
import type { Site } from "@/app/context/SiteContext"

const createSiteFormSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  url: z.string().url("Debe ser una URL válida"),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  competitors: z.array(z.object({
    url: z.string().url("Debe ser una URL válida"),
    name: z.string().optional()
  })).optional().default([]),
  focusMode: z.number().min(0).max(100),
  resource_urls: z.array(z.object({
    key: z.string().min(1, "El nombre es requerido"),
    url: z.string().url("Debe ser una URL válida")
  })).optional().default([])
})

type CreateSiteFormValues = z.infer<typeof createSiteFormSchema>

interface CreateSiteFormProps {
  onSubmit: (data: Omit<Site, 'id' | 'created_at' | 'updated_at'>) => void
  isSaving?: boolean
}

export function CreateSiteForm({ onSubmit, isSaving }: CreateSiteFormProps) {
  const form = useForm<CreateSiteFormValues>({
    resolver: zodResolver(createSiteFormSchema),
    defaultValues: {
      name: "",
      url: "",
      description: "",
      logo_url: "",
      competitors: [],
      focusMode: 50,
      resource_urls: []
    }
  })

  const handleSubmit = async (data: CreateSiteFormValues) => {
    const siteData: Omit<Site, 'id' | 'created_at' | 'updated_at'> = {
      name: data.name,
      url: data.url,
      description: data.description || null,
      logo_url: data.logo_url || null,
      resource_urls: data.resource_urls as ResourceUrl[] || null,
      competitors: data.competitors as CompetitorUrl[] || null,
      focusMode: data.focusMode,
      focus_mode: data.focusMode,
      user_id: '' // Este valor será sobrescrito por el componente padre
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

  return (
    <Form {...form}>
      <form id="create-site-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-12">
        <div className="space-y-12">
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
                            {
                              "slider-sales-strong [&_[role=slider]]:bg-blue-700 [&_.range]:bg-blue-700 [&]:bg-blue-100 dark:[&]:bg-blue-950/50": field.value <= 20,
                              "slider-sales-moderate [&_[role=slider]]:bg-blue-600 [&_.range]:bg-blue-600 [&]:bg-blue-50 dark:[&]:bg-blue-900/40": field.value > 20 && field.value <= 40,
                              "slider-balanced-sales [&_[role=slider]]:bg-purple-600 [&_.range]:bg-purple-500 [&]:bg-purple-50 dark:[&]:bg-purple-900/40": field.value > 40 && field.value <= 49,
                              "slider-balanced-perfect [&_[role=slider]]:bg-purple-600 [&_.range]:bg-purple-600 [&]:bg-purple-100 dark:[&]:bg-purple-950/50": field.value === 50,
                              "slider-balanced-growth [&_[role=slider]]:bg-purple-600 [&_.range]:bg-purple-500 [&]:bg-purple-50 dark:[&]:bg-purple-900/40": field.value > 50 && field.value <= 60,
                              "slider-growth-moderate [&_[role=slider]]:bg-green-600 [&_.range]:bg-green-500 [&]:bg-green-50 dark:[&]:bg-green-900/40": field.value > 60 && field.value <= 80,
                              "slider-growth-strong [&_[role=slider]]:bg-green-600 [&_.range]:bg-green-600 [&]:bg-green-100 dark:[&]:bg-green-950/50": field.value > 80
                            }
                          )}
                        />
                        <div className="mt-4">
                          <h3 className={cn("text-lg font-semibold", getFocusModeConfig(field.value).color)}>
                            {getFocusModeConfig(field.value).label}
                          </h3>
                          <p className="text-sm text-foreground mt-1">
                            {getFocusModeConfig(field.value).description}
                          </p>
                          <ul className="mt-4 space-y-2">
                            {getFocusModeConfig(field.value).features.map((feature, index) => (
                              <li key={index} className="text-sm text-foreground flex items-start">
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
                                className={cn(
                                  "w-full h-full rounded-lg border-2 border-dashed border-input",
                                  "bg-muted flex flex-col items-center justify-center gap-2 cursor-pointer",
                                  "hover:border-input/80 hover:bg-muted/80 transition-colors"
                                )}
                              >
                                <input {...getInputProps()} />
                                <div className="flex flex-col items-center justify-center">
                                  <UploadCloud className="h-8 w-8 text-gray-400 flex-shrink-0 mb-2" />
                                  <div className="text-sm text-center flex flex-col items-center">
                                    <p className="font-medium text-foreground">Click to upload</p>
                                    <p className="text-muted-foreground">or drag and drop</p>
                                  </div>
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

          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Resource URLs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              {form.watch("resource_urls").map((_, index) => (
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
                        <FormLabel className="text-sm font-medium text-foreground">Resource URL</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Link className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base" 
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
                  const current = form.getValues("resource_urls")
                  form.setValue("resource_urls", [...current, { key: "", url: "" }])
                }}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Resource
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  )
} 