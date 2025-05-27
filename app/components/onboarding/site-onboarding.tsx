"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { ActionFooter } from "../ui/card-footer"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Slider } from "../ui/slider"
import { Switch } from "../ui/switch"
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
  Link,
  Clock,
  Home,
  ChevronDown,
  ChevronUp,
  X
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
  business_hours: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    timezone: z.string().min(1, "Timezone is required"),
    respectHolidays: z.boolean().optional().default(true),
    days: z.object({
      monday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      tuesday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      wednesday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      thursday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      friday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      saturday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      }),
      sunday: z.object({
        enabled: z.boolean(),
        start: z.string().optional(),
        end: z.string().optional()
      })
    })
  })).optional().default([]),
  locations: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    address: z.string().optional(),
    country: z.string().optional()
  })).optional().default([]),
  // Company info
  about: z.string().optional(),
  company_size: z.string().optional(),
  industry: z.string().optional(),
  swot: z.object({
    strengths: z.string().optional(),
    weaknesses: z.string().optional(),
    opportunities: z.string().optional(),
    threats: z.string().optional(),
  }).optional().default({
    strengths: "",
    weaknesses: "",
    opportunities: "",
    threats: ""
  }),
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
  products: z.array(z.object({
    name: z.string().min(1, "Product name is required"),
    description: z.string().optional(),
    cost: z.number().min(0, "Cost must be positive").optional(),
    lowest_sale_price: z.number().min(0, "Lowest sale price must be positive").optional(),
    target_sale_price: z.number().min(0, "Target sale price must be positive").optional()
  })).optional().default([]),
  services: z.array(z.object({
    name: z.string().min(1, "Service name is required"),
    description: z.string().optional(),
    cost: z.number().min(0, "Cost must be positive").optional(),
    lowest_sale_price: z.number().min(0, "Lowest sale price must be positive").optional(),
    target_sale_price: z.number().min(0, "Target sale price must be positive").optional()
  })).optional().default([]),
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
    description: "Name, URL & logo"
  },
  {
    id: 2,
    title: "AI Focus Mode",
    description: "Sales vs Growth balance"
  },
  {
    id: 3,
    title: "Business Hours",
    description: "Schedules & timezones"
  },
  {
    id: 4,
    title: "Locations",
    description: "Physical presence"
  },
  {
    id: 5,
    title: "Company Information",
    description: "About, goals & SWOT"
  },
  {
    id: 6,
    title: "Marketing",
    description: "Budget & channels"
  },
  {
    id: 7,
    title: "Products & Services",
    description: "Offerings & pricing"
  }
]

export function SiteOnboarding({ onComplete, isLoading }: SiteOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())
  const [expandedBusinessHours, setExpandedBusinessHours] = useState<Set<number>>(new Set())
  const [stepErrors, setStepErrors] = useState<Set<number>>(new Set())
  const [hasValidated, setHasValidated] = useState(false)
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
      business_hours: [],
      locations: [],
      about: "",
      company_size: "",
      industry: "",
      swot: {
        strengths: "",
        weaknesses: "",
        opportunities: "",
        threats: "",
      },
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

  // Function to validate each step
  const validateStep = (stepId: number): boolean => {
    const formData = form.getValues()
    
    switch (stepId) {
      case 1:
        // Basic Information - name and url are required
        const nameValid = formData.name && formData.name.trim()
        const urlValid = formData.url && formData.url.trim()
        let urlFormatValid = true
        
        if (urlValid) {
          try {
            new URL(formData.url)
          } catch {
            urlFormatValid = false
          }
        }
        
        return !!(nameValid && urlValid && urlFormatValid)
      
      case 2:
        // AI Focus Mode - always valid (has default value)
        return true
      
      case 3:
        // Business Hours - validate that if there are hours, they have names and valid times
        const businessHours = formData.business_hours || []
        if (businessHours.length === 0) return true // Optional
        
        return businessHours.every(hours => {
          if (!hours.name || !hours.name.trim()) return false
          if (!hours.timezone) return false
          
          // Check that enabled days have valid start/end times
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
          return days.every(day => {
            const dayConfig = hours.days[day as keyof typeof hours.days]
            if (!dayConfig.enabled) return true
            return dayConfig.start && dayConfig.end && dayConfig.start < dayConfig.end
          })
        })
      
      case 4:
        // Locations - validate that if there are locations, they have names
        const locations = formData.locations || []
        if (locations.length === 0) return true // Optional
        return locations.every(location => location.name && location.name.trim())
      
      case 5:
        // Company Information - all optional, always valid
        return true
      
      case 6:
        // Marketing - validate marketing channels have names if present
        const channels = formData.marketing_channels || []
        if (channels.length === 0) return true // Optional
        return channels.every(channel => channel.name && channel.name.trim())
      
      case 7:
        // Products & Services - validate names if present
        const products = formData.products || []
        const services = formData.services || []
        
        const productsValid = products.length === 0 || products.every(product => product.name && product.name.trim())
        const servicesValid = services.length === 0 || services.every(service => service.name && service.name.trim())
        
        return productsValid && servicesValid
      
      default:
        return true
    }
  }

  // Function to update step errors
  const updateStepErrors = () => {
    const newErrors = new Set<number>()
    
    for (let i = 1; i <= steps.length; i++) {
      if (!validateStep(i)) {
        newErrors.add(i)
      }
    }
    
    setStepErrors(newErrors)
  }

  const nextStep = () => {
    setHasValidated(true)
    updateStepErrors()
    
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
    setHasValidated(true)
    updateStepErrors()
    
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

  const addBusinessHour = () => {
    const current = form.getValues("business_hours") || []
    const newHours = { 
      name: "", 
      timezone: "America/Mexico_City", 
      respectHolidays: true, 
      days: { 
        monday: { enabled: true, start: "09:00", end: "18:00" }, 
        tuesday: { enabled: true, start: "09:00", end: "18:00" }, 
        wednesday: { enabled: true, start: "09:00", end: "18:00" }, 
        thursday: { enabled: true, start: "09:00", end: "18:00" }, 
        friday: { enabled: true, start: "09:00", end: "18:00" }, 
        saturday: { enabled: false, start: "09:00", end: "14:00" }, 
        sunday: { enabled: false, start: "09:00", end: "14:00" } 
      } 
    }
    const newList = [...current, newHours]
    form.setValue("business_hours", newList)
    
    // Expand the newly added item
    const newExpanded = new Set(expandedBusinessHours)
    newExpanded.add(newList.length - 1)
    setExpandedBusinessHours(newExpanded)
  }

  const removeBusinessHour = (index: number) => {
    const current = form.getValues("business_hours") || []
    form.setValue("business_hours", current.filter((_, i) => i !== index))
  }

  const updateBusinessHour = (index: number, field: string, value: any) => {
    const current = form.getValues("business_hours") || []
    const newList = [...current]
    if (field.includes('.')) {
      // Handle nested fields like days.monday.enabled
      const parts = field.split('.')
      let currentObj = newList[index] as any
      for (let i = 0; i < parts.length - 1; i++) {
        currentObj = currentObj[parts[i]]
      }
      currentObj[parts[parts.length - 1]] = value
    } else {
      (newList[index] as any)[field] = value
    }
    form.setValue("business_hours", newList)
  }

  const toggleBusinessHourExpanded = (index: number) => {
    const newExpanded = new Set(expandedBusinessHours)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedBusinessHours(newExpanded)
  }

  const addLocation = () => {
    const current = form.getValues("locations") || []
    form.setValue("locations", [...current, { name: "", address: "", country: "" }])
  }

  const removeLocation = (index: number) => {
    const current = form.getValues("locations") || []
    form.setValue("locations", current.filter((_, i) => i !== index))
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
    form.setValue("products", [...current, { name: "", description: "", cost: 0, lowest_sale_price: 0, target_sale_price: 0 }])
    // Expand the newly added item
    const newExpanded = new Set(expandedProducts)
    newExpanded.add(current.length)
    setExpandedProducts(newExpanded)
  }

  const removeProduct = (index: number) => {
    const current = form.getValues("products") || []
    form.setValue("products", current.filter((_, i) => i !== index))
  }

  const addService = () => {
    const current = form.getValues("services") || []
    form.setValue("services", [...current, { name: "", description: "", cost: 0, lowest_sale_price: 0, target_sale_price: 0 }])
    // Expand the newly added item
    const newExpanded = new Set(expandedServices)
    newExpanded.add(current.length)
    setExpandedServices(newExpanded)
  }

  const removeService = (index: number) => {
    const current = form.getValues("services") || []
    form.setValue("services", current.filter((_, i) => i !== index))
  }

  const toggleProductExpanded = (index: number) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedProducts(newExpanded)
  }

  const toggleServiceExpanded = (index: number) => {
    const newExpanded = new Set(expandedServices)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedServices(newExpanded)
  }

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

  const TIMEZONES = [
    { value: "America/Mexico_City", label: "Mexico City (GMT-6)" },
    { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
    { value: "America/Chicago", label: "Chicago (GMT-6)" },
    { value: "America/New_York", label: "New York (GMT-5)" },
    { value: "America/Toronto", label: "Toronto (GMT-5)" },
    { value: "America/Vancouver", label: "Vancouver (GMT-8)" },
    { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
    { value: "America/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
    { value: "Europe/London", label: "London (GMT+0)" },
    { value: "Europe/Paris", label: "Paris (GMT+1)" },
    { value: "Europe/Madrid", label: "Madrid (GMT+1)" },
    { value: "Europe/Berlin", label: "Berlin (GMT+1)" },
    { value: "Europe/Moscow", label: "Moscow (GMT+3)" },
    { value: "Asia/Dubai", label: "Dubai (GMT+4)" },
    { value: "Asia/Mumbai", label: "Mumbai (GMT+5:30)" },
    { value: "Asia/Singapore", label: "Singapore (GMT+8)" },
    { value: "Asia/Hong_Kong", label: "Hong Kong (GMT+8)" },
    { value: "Asia/Tokyo", label: "Tokyo (GMT+9)" },
    { value: "Asia/Shanghai", label: "Shanghai (GMT+8)" },
    { value: "Australia/Sydney", label: "Sydney (GMT+11)" },
    { value: "Pacific/Auckland", label: "Auckland (GMT+13)" }
  ]

  const DAYS_OF_WEEK = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" }
  ]

  const TIME_OPTIONS = (() => {
    const times = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        times.push({ value: time, label: time })
      }
    }
    return times
  })()

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

            {/* Steps list */}
            <div className="space-y-4">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => {
                    setHasValidated(true)
                    updateStepErrors()
                    setCurrentStep(step.id)
                  }}
                  className="flex items-center gap-4 w-full text-left hover:bg-muted/30 rounded-lg p-2 transition-colors"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                      hasValidated && stepErrors.has(step.id)
                        ? "bg-red-600 text-white"
                        : step.id < currentStep
                        ? "bg-green-600 text-white"
                        : step.id === currentStep
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {hasValidated && stepErrors.has(step.id) ? (
                      <X className="h-4 w-4" />
                    ) : step.id < currentStep ? (
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
                </button>
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
                          Define your business hours for different regions. Most agent activities will start on those time ranges.
                        </p>
                      </div>
                      
                      {form.watch("business_hours")?.map((hours, index) => {
                        const isExpanded = expandedBusinessHours.has(index)
                        
                        return (
                          <div key={index} className="border border-border rounded-lg overflow-hidden">
                            <div className="p-4 bg-muted/30">
                              <div className="flex items-center gap-4">
                                <button
                                  type="button"
                                  onClick={() => toggleBusinessHourExpanded(index)}
                                  className="p-1 hover:bg-muted/50 rounded transition-colors h-10 w-10 flex items-center justify-center"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                                
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                                    name={`business_hours.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                    <Input 
                                            placeholder="e.g., Main Office, Europe Branch"
                                            value={hours.name}
                                            onChange={(e) => {
                                              field.onChange(e)
                                              updateBusinessHour(index, 'name', e.target.value)
                                            }}
                                            className="bg-background"
                                          />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                                    name={`business_hours.${index}.timezone`}
                            render={({ field }) => (
                              <FormItem>
                                        <Select
                                          value={hours.timezone}
                                          onValueChange={(value) => {
                                            field.onChange(value)
                                            updateBusinessHour(index, 'timezone', value)
                                          }}
                                        >
                                <FormControl>
                                            <SelectTrigger className="bg-background">
                                              <SelectValue placeholder="Select timezone" />
                                            </SelectTrigger>
                                </FormControl>
                                          <SelectContent>
                                            {TIMEZONES.map((tz) => (
                                              <SelectItem key={tz.value} value={tz.value}>
                                                {tz.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                                </div>

                            <Button
                                  size="icon"
                              variant="ghost"
                                  type="button"
                                  onClick={() => removeBusinessHour(index)}
                                  className="h-10 w-10"
                            >
                                  <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                            {isExpanded && (
                              <div className="p-6 space-y-4 border-t border-border">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                    <label className="text-sm font-medium">Respect Holidays</label>
                                    <p className="text-xs text-muted-foreground">
                                      Agents will not work on regional holidays when enabled
                                    </p>
                                  </div>
                                  <Switch
                                    checked={hours.respectHolidays || false}
                                    onCheckedChange={(checked) => {
                                      updateBusinessHour(index, 'respectHolidays', checked)
                                    }}
                                  />
                                </div>

                                <div className="space-y-3">
                                  {DAYS_OF_WEEK.map((day) => (
                                    <div key={day.key} className="flex items-center gap-4">
                                      <div className="w-32">
                                        <div className="flex items-center space-x-2">
                                          <Switch
                                            checked={hours.days[day.key as keyof typeof hours.days].enabled}
                                            onCheckedChange={(checked) => {
                                              updateBusinessHour(index, `days.${day.key}.enabled`, checked)
                                            }}
                                          />
                                          <label className="text-sm font-medium">
                                            {day.label}
                                          </label>
                                        </div>
                                      </div>

                                      {hours.days[day.key as keyof typeof hours.days].enabled && (
                                        <div className="flex items-center gap-2 flex-1">
                                          <Select
                                            value={hours.days[day.key as keyof typeof hours.days].start}
                                            onValueChange={(value) => {
                                              updateBusinessHour(index, `days.${day.key}.start`, value)
                                            }}
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Start time" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {TIME_OPTIONS.map((time) => (
                                                <SelectItem key={time.value} value={time.value}>
                                                  {time.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>

                                          <span className="text-muted-foreground">to</span>

                                          <Select
                                            value={hours.days[day.key as keyof typeof hours.days].end}
                                            onValueChange={(value) => {
                                              updateBusinessHour(index, `days.${day.key}.end`, value)
                                            }}
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="End time" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {TIME_OPTIONS.map((time) => (
                                                <SelectItem key={time.value} value={time.value}>
                                                  {time.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}

                                      {!hours.days[day.key as keyof typeof hours.days].enabled && (
                                        <div className="flex-1 text-sm text-muted-foreground">
                                          Closed
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={addBusinessHour}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Business Hours Schedule
                      </Button>
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="space-y-4">
                      <div className="text-center mb-4">
                        <p className="text-sm text-muted-foreground">
                          Add your company's physical locations. Commercial efforts will be prioritized in these areas.
                        </p>
                      </div>
                      
                      {form.watch("locations")?.map((_, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="grid grid-cols-1 gap-4">
                          <FormField
                            control={form.control}
                              name={`locations.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Location Name</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                      <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                      className="pl-10" 
                                        placeholder="e.g., HQ, Branch Office"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                            <div className="grid md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                                name={`locations.${index}.address`}
                            render={({ field }) => (
                              <FormItem>
                                    <FormLabel>Address</FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="Street address"
                                      {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                              <FormField
                                control={form.control}
                                name={`locations.${index}.country`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Country</FormLabel>
                                    <FormControl>
                                      <Input 
                                        placeholder="Country"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end mt-4">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLocation(index)}
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
                        onClick={addLocation}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Location
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

                      <div className="space-y-4">
                        <FormLabel className="text-base font-medium">SWOT Analysis (Optional but recommended)</FormLabel>
                        <p className="text-sm text-muted-foreground mb-4">
                          This helps our AI agents better understand your business context for more creative and strategic recommendations.
                        </p>
                        <div className="grid grid-cols-1 gap-4">
                          <FormField
                            control={form.control}
                            name="swot.strengths"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Strengths</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    className="resize-none min-h-[80px]"
                                    placeholder="What does your company do well?"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="swot.weaknesses"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Weaknesses</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    className="resize-none min-h-[80px]"
                                    placeholder="Where could your company improve?"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="swot.opportunities"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Opportunities</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    className="resize-none min-h-[80px]"
                                    placeholder="What opportunities exist for your company?"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="swot.threats"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Threats</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    className="resize-none min-h-[80px]"
                                    placeholder="What threats does your company face?"
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
                    </div>
                  )}

                  {currentStep === 7 && (
                    <div className="space-y-6">
                      <div className="bg-muted/30 rounded-lg p-4 mb-6">
                        <p className="text-sm text-muted-foreground">
                          <strong>💡 Why this helps:</strong> Products and services information allows our AI to provide better insights and recommendations for your business offerings.
                        </p>
                      </div>

                      {/* Products Section */}
                      <div className="space-y-4">
                        <FormLabel className="text-base font-medium">Products (Optional)</FormLabel>
                        <div className="space-y-3">
                          {form.watch("products")?.map((product, index) => {
                            const isExpanded = expandedProducts.has(index)
                            
                            return (
                              <div key={index} className="border border-border rounded-lg overflow-hidden">
                                <div className="p-4 bg-muted/5 flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleProductExpanded(index)}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </button>
                              <FormField
                                control={form.control}
                                      name={`products.${index}.name`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                        <Input 
                                          placeholder="Product name"
                                              className="bg-background"
                                          {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                                  </div>
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
                                
                                {isExpanded && (
                                  <div className="p-4 border-t space-y-4">
                                    <FormField
                                      control={form.control}
                                      name={`products.${index}.description`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Description</FormLabel>
                                          <FormControl>
                                            <Textarea 
                                              placeholder="Describe this product..."
                                              className="resize-none"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <div className="grid grid-cols-3 gap-4">
                                      <FormField
                                        control={form.control}
                                        name={`products.${index}.cost`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Cost ($)</FormLabel>
                                            <FormControl>
                                              <Input 
                                                type="number"
                                                placeholder="0"
                                                {...field}
                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      
                                      <FormField
                                        control={form.control}
                                        name={`products.${index}.lowest_sale_price`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Lowest Sale Price ($)</FormLabel>
                                            <FormControl>
                                              <Input 
                                                type="number"
                                                placeholder="0"
                                                {...field}
                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      
                                      <FormField
                                        control={form.control}
                                        name={`products.${index}.target_sale_price`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Target Sale Price ($)</FormLabel>
                                            <FormControl>
                                              <Input 
                                                type="number"
                                                placeholder="0"
                                                {...field}
                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
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

                      {/* Services Section */}
                      <div className="space-y-4">
                        <FormLabel className="text-base font-medium">Services (Optional)</FormLabel>
                        <div className="space-y-3">
                          {form.watch("services")?.map((service, index) => {
                            const isExpanded = expandedServices.has(index)
                            
                            return (
                              <div key={index} className="border border-border rounded-lg overflow-hidden">
                                <div className="p-4 bg-muted/5 flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleServiceExpanded(index)}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </button>
                              <FormField
                                control={form.control}
                                      name={`services.${index}.name`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                        <Input 
                                          placeholder="Service name"
                                              className="bg-background"
                                          {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                                  </div>
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
                                
                                {isExpanded && (
                                  <div className="p-4 border-t space-y-4">
                                    <FormField
                                      control={form.control}
                                      name={`services.${index}.description`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Description</FormLabel>
                                          <FormControl>
                                            <Textarea 
                                              placeholder="Describe this service..."
                                              className="resize-none"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    
                                    <div className="grid grid-cols-3 gap-4">
                                      <FormField
                                        control={form.control}
                                        name={`services.${index}.cost`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Cost ($)</FormLabel>
                                            <FormControl>
                                              <Input 
                                                type="number"
                                                placeholder="0"
                                                {...field}
                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      
                                      <FormField
                                        control={form.control}
                                        name={`services.${index}.lowest_sale_price`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Lowest Sale Price ($)</FormLabel>
                                            <FormControl>
                                              <Input 
                                                type="number"
                                                placeholder="0"
                                                {...field}
                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      
                                      <FormField
                                        control={form.control}
                                        name={`services.${index}.target_sale_price`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Target Sale Price ($)</FormLabel>
                                            <FormControl>
                                              <Input 
                                                type="number"
                                                placeholder="0"
                                                {...field}
                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
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