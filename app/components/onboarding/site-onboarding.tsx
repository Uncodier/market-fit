"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { ActionFooter } from "../ui/card-footer"
import { Progress } from "../ui/progress"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { cn } from "@/lib/utils"
import { useDropzone } from "react-dropzone"
import Image from "next/image"
import {
  AppWindow,
  Globe,
  Tag,
  UploadCloud,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
  PlusCircle,
  Link
} from "../ui/icons"
import { useSite } from "../../context/SiteContext"
import { useRouter } from "next/navigation"

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1001+", label: "1001+ employees" }
]

const INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "entertainment", label: "Entertainment" },
  { value: "food", label: "Food & Beverage" },
  { value: "travel", label: "Travel & Hospitality" },
  { value: "real_estate", label: "Real Estate" },
  { value: "professional_services", label: "Professional Services" },
  { value: "other", label: "Other" }
]

const siteOnboardingSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  focusMode: z.number().min(0).max(100),
  competitors: z.array(z.object({
    url: z.string().url("Must be a valid URL"),
    name: z.string().optional()
  })).optional().default([]),
  resource_urls: z.array(z.object({
    key: z.string().min(1, "Name is required"),
    url: z.string().url("Must be a valid URL")
  })).optional().default([]),
  // Company info
  about: z.string().optional(),
  company_size: z.string().optional(),
  industry: z.string().optional(),
  goals: z.object({
    quarterly: z.string().optional(),
    yearly: z.string().optional(),
    fiveYear: z.string().optional(),
    tenYear: z.string().optional(),
  }).optional(),
  // Marketing info
  marketing_budget: z.object({
    total: z.number().optional(),
    available: z.number().optional(),
  }).optional(),
  marketing_channels: z.array(z.object({
    name: z.string(),
  })).optional().default([]),
  products: z.array(z.string()).optional().default([]),
  services: z.array(z.string()).optional().default([]),
})

type SiteOnboardingValues = z.infer<typeof siteOnboardingSchema>

interface SiteOnboardingProps {
  onComplete: (data: SiteOnboardingValues) => void
  isLoading?: boolean
}

const steps = [
  {
    id: 1,
    title: "Basic Information",
    description: "Let's start with the basics about your project"
  },
  {
    id: 2,
    title: "AI Focus Mode",
    description: "Configure how your AI agents should behave"
  },
  {
    id: 3,
    title: "Competitors",
    description: "Add your main competitors for market analysis"
  },
  {
    id: 4,
    title: "Resources",
    description: "Add important resources and documentation"
  },
  {
    id: 5,
    title: "Company Information",
    description: "Tell us about your company and goals (Optional but recommended)"
  },
  {
    id: 6,
    title: "Marketing",
    description: "Set up your marketing budget and channels (Optional but recommended)"
  }
]

export function SiteOnboarding({ onComplete, isLoading }: SiteOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const { sites } = useSite()
  const router = useRouter()
  
  const form = useForm<SiteOnboardingValues>({
    resolver: zodResolver(siteOnboardingSchema),
    defaultValues: {
      name: "",
      url: "",
      description: "",
      logo_url: "",
      focusMode: 50,
      competitors: [],
      resource_urls: [],
      about: "",
      company_size: "",
      industry: "",
      goals: {
        quarterly: "",
        yearly: "",
        fiveYear: "",
        tenYear: "",
      },
      marketing_budget: {
        total: 0,
        available: 0,
      },
      marketing_channels: [],
      products: [],
      services: [],
    }
  })

  const getFocusModeConfig = (value: number) => {
    if (value <= 20) {
      return {
        label: "Revenue Maximizer",
        description: "Agents will aggressively pursue sales opportunities and conversions, prioritizing immediate revenue.",
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200"
      }
    }
    if (value <= 40) {
      return {
        label: "Sales Focus",
        description: "Agents will prioritize conversion opportunities while still providing quality support.",
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200"
      }
    }
    if (value <= 49) {
      return {
        label: "Balanced (Sales Leaning)",
        description: "Agents will balance support with strategic sales opportunities, with a slight focus on conversions.",
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-200"
      }
    }
    if (value === 50) {
      return {
        label: "Perfect Balance",
        description: "Agents will maintain an ideal equilibrium between support, education and commercial opportunities.",
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-200"
      }
    }
    if (value <= 60) {
      return {
        label: "Balanced (Growth Leaning)",
        description: "Agents will focus on helpful support with user growth in mind, with minimal sales emphasis.",
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-200"
      }
    }
    if (value <= 80) {
      return {
        label: "Growth Focus",
        description: "Agents will emphasize user acquisition and retention, with educational content and engagement.",
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-200"
      }
    }
    return {
      label: "Growth Maximizer",
      description: "Agents will exclusively focus on user experience, education, and community building.",
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
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

  const nextStep = () => {
    // If we're on step 1, validate required fields before advancing
    if (currentStep === 1) {
      const formData = form.getValues()
      const nameValid = formData.name && formData.name.trim()
      const urlValid = formData.url && formData.url.trim()
      
      if (!nameValid || !urlValid) {
        if (!nameValid) {
          form.setError("name", { 
            type: "manual", 
            message: "Project name is required" 
          })
        }
        if (!urlValid) {
          form.setError("url", { 
            type: "manual", 
            message: "Site URL is required" 
          })
        }
        return
      }
    }
    
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    const formData = form.getValues()
    const nameValid = formData.name && formData.name.trim()
    const urlValid = formData.url && formData.url.trim()
    
    // Check if required fields are filled
    if (!nameValid || !urlValid) {
      if (!nameValid) {
        form.setError("name", { 
          type: "manual", 
          message: "Project name is required" 
        })
      }
      if (!urlValid) {
        form.setError("url", { 
          type: "manual", 
          message: "Site URL is required" 
        })
      }
      // Scroll back to step 1 if we're not there
      if (currentStep !== 1) {
        setCurrentStep(1)
      }
      return
    }
    
    form.handleSubmit(onComplete)()
  }

  const handleBack = () => {
    router.push("/dashboard")
  }

  const addCompetitor = () => {
    const current = form.getValues("competitors") || []
    form.setValue("competitors", [...current, { url: "", name: "" }])
  }

  const removeCompetitor = (index: number) => {
    const current = form.getValues("competitors") || []
    form.setValue("competitors", current.filter((_, i) => i !== index))
  }

  const addResource = () => {
    const current = form.getValues("resource_urls") || []
    form.setValue("resource_urls", [...current, { key: "", url: "" }])
  }

  const removeResource = (index: number) => {
    const current = form.getValues("resource_urls") || []
    form.setValue("resource_urls", current.filter((_, i) => i !== index))
  }

  const addMarketingChannel = () => {
    const current = form.getValues("marketing_channels") || []
    form.setValue("marketing_channels", [...current, { name: "" }])
  }

  const removeMarketingChannel = (index: number) => {
    const current = form.getValues("marketing_channels") || []
    form.setValue("marketing_channels", current.filter((_, i) => i !== index))
  }

  const addProduct = () => {
    const current = form.getValues("products") || []
    form.setValue("products", [...current, ""])
  }

  const removeProduct = (index: number) => {
    const current = form.getValues("products") || []
    form.setValue("products", current.filter((_, i) => i !== index))
  }

  const addService = () => {
    const current = form.getValues("services") || []
    form.setValue("services", [...current, ""])
  }

  const removeService = (index: number) => {
    const current = form.getValues("services") || []
    form.setValue("services", current.filter((_, i) => i !== index))
  }

  const progress = (currentStep / steps.length) * 100
  const hasExistingSites = sites.length > 0

  // Check if required fields are completed
  const formData = form.watch()
  const isRequiredFieldsComplete = !!(formData.name && formData.name.trim() && formData.url && formData.url.trim())

  // Debug logs
  console.log("🔍 Debug Info:", {
    sitesLength: sites.length,
    hasExistingSites,
    formDataName: formData.name,
    formDataNameTrimmed: formData.name?.trim(),
    formDataUrl: formData.url,
    formDataUrlTrimmed: formData.url?.trim(),
    isRequiredFieldsComplete,
    currentStep,
    nameValid: !!(formData.name && formData.name.trim()),
    urlValid: !!(formData.url && formData.url.trim())
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center p-4">
      <div className="container max-w-6xl mx-auto">
        {/* Header with optional back button */}
        <div className="flex items-center justify-between mb-8">
          {hasExistingSites && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
          )}
          {!hasExistingSites && <div />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Steps Overview */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-3">
                {hasExistingSites ? "Create New Project" : "Welcome! Let's create your first project"}
              </h1>
              <p className="text-muted-foreground text-lg">
                {hasExistingSites 
                  ? "Add another project to your workspace in just a few steps"
                  : "We'll help you get set up with everything you need to start tracking your market fit"
                }
              </p>
            </div>

            {/* Progress indicator */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Progress
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            {/* Steps list */}
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                      step.id < currentStep
                        ? "bg-green-600 text-white"
                        : step.id === currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {step.id < currentStep ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="flex-1">
                    <div
                      className={cn(
                        "font-medium",
                        step.id === currentStep
                          ? "text-foreground"
                          : step.id < currentStep
                          ? "text-muted-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {step.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Form Content */}
          <div className="lg:col-span-2">
            <Form {...form}>
              <Card className="bg-card rounded-xl border shadow-lg overflow-hidden">
                {/* Step Header */}
                <CardHeader className="p-8 pb-6">
                  <div className="mb-2">
                    <CardTitle className="text-2xl font-semibold mb-3">
                      {steps[currentStep - 1].title}
                    </CardTitle>
                    <p className="text-muted-foreground text-lg">
                      {steps[currentStep - 1].description}
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="px-8 pb-12">
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Project Name *</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <AppWindow className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                      className="pl-10" 
                                      placeholder="My Amazing Project"
                                      {...field} 
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="url"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Site URL *</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                      className="pl-10" 
                                      placeholder="https://mysite.com"
                                      {...field} 
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Tag className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Textarea 
                                      className="pl-10 resize-none min-h-[80px]"
                                      placeholder="Tell us about your project..."
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="flex items-center justify-center">
                          <FormField
                            control={form.control}
                            name="logo_url"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Logo (Optional)</FormLabel>
                                <FormControl>
                                  <div className="w-[240px] h-[240px] relative">
                                    {field.value ? (
                                      <div className="w-full h-full relative group">
                                        <Image
                                          src={field.value}
                                          alt="Project logo"
                                          fill
                                          className="object-contain rounded-lg border"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => field.onChange("")}
                                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                                        >
                                          <Trash2 className="h-5 w-5 text-white" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div
                                        {...getRootProps()}
                                        className="w-full h-full rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors"
                                      >
                                        <input {...getInputProps()} />
                                        <UploadCloud className="h-8 w-8 text-muted-foreground" />
                                        <div className="text-center">
                                          <p className="text-sm font-medium text-foreground">Click to upload</p>
                                          <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="focusMode"
                        render={({ field }) => {
                          const config = getFocusModeConfig(field.value)
                          return (
                            <FormItem>
                              <div className="space-y-6">
                                <div>
                                  <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-medium text-blue-600">Sales Focus</span>
                                    <span className="text-sm font-medium text-green-600">Growth Focus</span>
                                  </div>
                                  <FormControl>
                                    <Slider
                                      value={[field.value]}
                                      onValueChange={([value]) => field.onChange(value)}
                                      max={100}
                                      step={1}
                                      className="py-4"
                                    />
                                  </FormControl>
                                </div>
                                
                                <Card className={cn("border-2", config.borderColor, config.bgColor)}>
                                  <CardContent className="p-4">
                                    <h3 className={cn("text-lg font-semibold mb-2", config.color)}>
                                      {config.label}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                      {config.description}
                                    </p>
                                  </CardContent>
                                </Card>
                              </div>
                            </FormItem>
                          )
                        }}
                      />
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div className="text-center mb-4">
                        <p className="text-sm text-muted-foreground">
                          Adding competitors helps our AI understand your market position
                        </p>
                      </div>
                      
                      {form.watch("competitors")?.map((_, index) => (
                        <div key={index} className="grid md:grid-cols-2 gap-4 p-4 border rounded-lg">
                          <FormField
                            control={form.control}
                            name={`competitors.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Competitor Name</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <AppWindow className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                      className="pl-10" 
                                      placeholder="Competitor Inc."
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`competitors.${index}.url`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Website URL</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                      className="pl-10" 
                                      placeholder="https://competitor.com"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="md:col-span-2 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCompetitor(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={addCompetitor}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Competitor
                      </Button>
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="space-y-4">
                      <div className="text-center mb-4">
                        <p className="text-sm text-muted-foreground">
                          Add important resources like documentation, help pages, or product guides
                        </p>
                      </div>
                      
                      {form.watch("resource_urls")?.map((_, index) => (
                        <div key={index} className="grid md:grid-cols-2 gap-4 p-4 border rounded-lg">
                          <FormField
                            control={form.control}
                            name={`resource_urls.${index}.key`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Resource Name</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                      className="pl-10" 
                                      placeholder="Documentation"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`resource_urls.${index}.url`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Resource URL</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                      className="pl-10" 
                                      placeholder="https://docs.mysite.com"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="md:col-span-2 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeResource(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={addResource}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Resource
                      </Button>
                    </div>
                  )}

                  {currentStep === 5 && (
                    <div className="space-y-6">
                      <div className="bg-muted/30 rounded-lg p-4 mb-6">
                        <p className="text-sm text-muted-foreground">
                          <strong>💡 Why this helps:</strong> Company information helps our AI provide more relevant recommendations and better understand your business context.
                        </p>
                      </div>

                      <FormField
                        control={form.control}
                        name="about"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>About Your Company</FormLabel>
                            <FormControl>
                              <Textarea 
                                className="resize-none min-h-[80px]"
                                placeholder="Tell us about your company..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="company_size"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Size</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={(value) => field.onChange(value)}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select company size" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {COMPANY_SIZES.map((size) => (
                                    <SelectItem key={size.value} value={size.value}>
                                      {size.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="industry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Industry</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={(value) => field.onChange(value)}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select industry" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {INDUSTRIES.map((industry) => (
                                    <SelectItem key={industry.value} value={industry.value}>
                                      {industry.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-4">
                        <FormLabel className="text-base font-medium">Business Goals (Optional)</FormLabel>
                        <div className="grid md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="goals.quarterly"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quarterly Goals</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    className="resize-none min-h-[60px]"
                                    placeholder="What do you want to achieve this quarter?"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="goals.yearly"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Yearly Goals</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    className="resize-none min-h-[60px]"
                                    placeholder="What do you want to achieve this year?"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 6 && (
                    <div className="space-y-6">
                      <div className="bg-muted/30 rounded-lg p-4 mb-6">
                        <p className="text-sm text-muted-foreground">
                          <strong>💡 Why this helps:</strong> Marketing information allows our AI to provide better insights and recommendations for your campaigns and budget allocation.
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="marketing_budget.total"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Budget (USD)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="marketing_budget.available"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Available Budget (USD)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div>
                        <FormLabel className="text-base font-medium mb-4 block">Marketing Channels (Optional)</FormLabel>
                        <div className="space-y-3">
                          {form.watch("marketing_channels")?.map((_, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <FormField
                                control={form.control}
                                name={`marketing_channels.${index}.name`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                      <div className="relative">
                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                          className="pl-10"
                                          placeholder="e.g. Google Ads, Email Marketing"
                                          {...field}
                                        />
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMarketingChannel(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={addMarketingChannel}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Marketing Channel
                          </Button>
                        </div>
                      </div>

                      <div>
                        <FormLabel className="text-base font-medium mb-4 block">Products (Optional)</FormLabel>
                        <div className="space-y-3">
                          {form.watch("products")?.map((_, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <FormField
                                control={form.control}
                                name={`products.${index}`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                      <div className="relative">
                                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                          className="pl-10"
                                          placeholder="Product name"
                                          {...field}
                                        />
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeProduct(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={addProduct}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Product
                          </Button>
                        </div>
                      </div>

                      <div>
                        <FormLabel className="text-base font-medium mb-4 block">Services (Optional)</FormLabel>
                        <div className="space-y-3">
                          {form.watch("services")?.map((_, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <FormField
                                control={form.control}
                                name={`services.${index}`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                      <div className="relative">
                                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                          className="pl-10"
                                          placeholder="Service name"
                                          {...field}
                                        />
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeService(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={addService}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Add Service
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>

                <ActionFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    size="lg"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>

                  {currentStep < steps.length ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      disabled={currentStep === 1 && !isRequiredFieldsComplete}
                      size="lg"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleComplete}
                      disabled={isLoading || !isRequiredFieldsComplete}
                      size="lg"
                      className="min-w-[140px]"
                    >
                      {isLoading 
                        ? "Creating..." 
                        : !isRequiredFieldsComplete 
                        ? "Complete Required Fields"
                        : "Create Project"
                      }
                      <Check className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </ActionFooter>
              </Card>
            </Form>
          </div>
        </div>
      </div>
    </div>
  )
} 