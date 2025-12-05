"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useDropzone } from "react-dropzone"
import Image from "next/image"
import { useRouter } from "next/navigation"

// UI Components
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
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
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
  Clock,
  Home,
  ChevronDown,
  X
} from "../ui/icons"

// Extracted modules
import { siteOnboardingSchema, SiteOnboardingValues } from "./schemas/onboarding-schema"
import { 
  COMPANY_SIZES, 
  INDUSTRIES, 
  TIMEZONES, 
  DAYS_OF_WEEK, 
  TIME_OPTIONS, 
  steps 
} from "./constants/onboarding-constants"
import { getFocusModeConfig } from "./utils/focus-mode-config"
import { SuccessStep } from "./steps/success-step"
import { BasicInfoStep } from "./steps/basic-info-step"
import { FocusModeStep } from "./steps/focus-mode-step"
import { CompanyInfoStep } from "./steps/company-info-step"
import { MarketingStep } from "./steps/marketing-step"
import { ProductsServicesStep } from "./steps/products-services-step"
import { LocationsOnboardingStep } from "./LocationsOnboardingStep"

// Context
import { useSite } from "../../context/SiteContext"
import { cn } from "@/lib/utils"

interface SiteOnboardingProps {
  onComplete: (data: SiteOnboardingValues) => void
  isLoading?: boolean
  isSuccess?: boolean
  createdSiteId?: string
  onGoToDashboard?: () => Promise<void>
  onGoToSettings?: () => Promise<void>
}

export function SiteOnboarding({ 
  onComplete, 
  isLoading, 
  isSuccess, 
  createdSiteId,
  onGoToDashboard,
  onGoToSettings
}: SiteOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())
  const [expandedBusinessHours, setExpandedBusinessHours] = useState<Set<number>>(new Set())
  const [stepErrors, setStepErrors] = useState<Set<number>>(new Set())
  const [hasValidated, setHasValidated] = useState(false)
  const { sites, isLoading: sitesLoading } = useSite()
  const router = useRouter()

  // Move to step 8 when project is successfully created
  useEffect(() => {
    if (isSuccess) {
      setCurrentStep(8)
    }
  }, [isSuccess])

  const navigateToSiteSettings = () => {
    if (onGoToSettings) {
      onGoToSettings()
    } else if (createdSiteId) {
      router.push(`/settings?site=${createdSiteId}`)
    } else {
      router.push("/settings")
    }
  }

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

  // Validation and step management
  const validateStep = (stepId: number): boolean => {
    const formData = form.getValues()
    
    switch (stepId) {
      case 1:
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
        return true
      
      case 3:
        const businessHours = formData.business_hours || []
        if (businessHours.length === 0) return true
        
        return businessHours.every(hours => {
          if (!hours.name || !hours.name.trim()) return false
          if (!hours.timezone) return false
          
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
          return days.every(day => {
            const dayConfig = hours.days[day as keyof typeof hours.days]
            if (!dayConfig.enabled) return true
            return dayConfig.start && dayConfig.end && dayConfig.start < dayConfig.end
          })
        })
      
      case 4:
        const locations = formData.locations || []
        if (locations.length === 0) return true
        return locations.every(location => location.name && location.name.trim())
      
      case 5:
        return true
      
      case 6:
        const channels = formData.marketing_channels || []
        if (channels.length === 0) return true
        return channels.every(channel => channel.name && channel.name.trim())
      
      case 7:
        const products = formData.products || []
        const services = formData.services || []
        
        const productsValid = products.length === 0 || products.every(product => product.name && product.name.trim())
        const servicesValid = services.length === 0 || services.every(service => service.name && service.name.trim())
        
        return productsValid && servicesValid
      
      default:
        return true
    }
  }

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
    
    // Check if current step is valid before proceeding
    if (!validateStep(currentStep)) {
      // Specific validation for step 1
      if (currentStep === 1) {
        const formData = form.getValues()
        const nameValid = formData.name && formData.name.trim()
        const urlValid = formData.url && formData.url.trim()
        
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
      }
      return
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
    
    // If we're in step 7, proceed with creating the project even if basic validation fails
    // The user has already progressed through previous steps
    if (currentStep === 7) {
      console.log("Step 7: Proceeding with project creation", { formData })
      form.handleSubmit(onComplete)()
      return
    }
    
    // For other steps, validate required fields
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
      if (currentStep !== 1) {
        setCurrentStep(1)
      }
      return
    }
    
    form.handleSubmit(onComplete)()
  }

  // Helper functions for managing arrays
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

  // Helper function to ensure proper location structure
  const normalizeLocation = (location: any) => ({
    name: location.name || "",
    address: location.address || "",
    city: location.city || "",
    state: location.state || "",
    zip: location.zip || "",
    country: location.country || "",
    restrictions: {
      enabled: location.restrictions?.enabled || false,
      included_addresses: location.restrictions?.included_addresses || [],
      excluded_addresses: location.restrictions?.excluded_addresses || []
    }
  })

  const addLocation = () => {
    const current = form.getValues("locations") || []
    const newLocation = normalizeLocation({ name: "" })
    form.setValue("locations", [...current, newLocation])
  }

  const removeLocation = (index: number) => {
    const current = form.getValues("locations") || []
    form.setValue("locations", current.filter((_, i) => i !== index))
  }

  // Regional restrictions handlers
  const addIncludedAddress = (locationIndex: number) => {
    const current = form.getValues("locations") || []
    const newAddress = {
      name: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      country: ""
    }
    const updatedLocations = [...current]
    
    // Ensure restrictions object exists and enable restrictions when adding addresses
    if (!updatedLocations[locationIndex].restrictions) {
      updatedLocations[locationIndex].restrictions = {
        enabled: true, // Enable restrictions when adding addresses
        included_addresses: [],
        excluded_addresses: []
      }
    } else {
      // Update existing restrictions to enabled when adding addresses
      updatedLocations[locationIndex].restrictions.enabled = true
    }
    
    updatedLocations[locationIndex] = {
      ...updatedLocations[locationIndex],
      restrictions: {
        ...updatedLocations[locationIndex].restrictions,
        included_addresses: [...(updatedLocations[locationIndex].restrictions?.included_addresses || []), newAddress]
      }
    }
    form.setValue("locations", updatedLocations)
  }

  const addExcludedAddress = (locationIndex: number) => {
    const current = form.getValues("locations") || []
    const newAddress = {
      name: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      country: ""
    }
    const updatedLocations = [...current]
    
    // Ensure restrictions object exists and enable restrictions when adding addresses
    if (!updatedLocations[locationIndex].restrictions) {
      updatedLocations[locationIndex].restrictions = {
        enabled: true, // Enable restrictions when adding addresses
        included_addresses: [],
        excluded_addresses: []
      }
    } else {
      // Update existing restrictions to enabled when adding addresses
      updatedLocations[locationIndex].restrictions.enabled = true
    }
    
    updatedLocations[locationIndex] = {
      ...updatedLocations[locationIndex],
      restrictions: {
        ...updatedLocations[locationIndex].restrictions,
        excluded_addresses: [...(updatedLocations[locationIndex].restrictions?.excluded_addresses || []), newAddress]
      }
    }
    form.setValue("locations", updatedLocations)
  }

  const removeIncludedAddress = (locationIndex: number, addressIndex: number) => {
    const current = form.getValues("locations") || []
    const updatedLocations = [...current]
    updatedLocations[locationIndex] = {
      ...updatedLocations[locationIndex],
      restrictions: {
        ...updatedLocations[locationIndex].restrictions,
        included_addresses: (updatedLocations[locationIndex].restrictions?.included_addresses || []).filter((_: any, i: number) => i !== addressIndex)
      }
    }
    form.setValue("locations", updatedLocations)
  }

  const removeExcludedAddress = (locationIndex: number, addressIndex: number) => {
    const current = form.getValues("locations") || []
    const updatedLocations = [...current]
    updatedLocations[locationIndex] = {
      ...updatedLocations[locationIndex],
      restrictions: {
        ...updatedLocations[locationIndex].restrictions,
        excluded_addresses: (updatedLocations[locationIndex].restrictions?.excluded_addresses || []).filter((_: any, i: number) => i !== addressIndex)
      }
    }
    form.setValue("locations", updatedLocations)
  }

  const handleIncludedAddressUpdate = (locationIndex: number, addressIndex: number, field: string, value: string) => {
    const current = form.getValues("locations") || []
    const updatedLocations = [...current]
    
    // Ensure restrictions object exists
    if (!updatedLocations[locationIndex].restrictions) {
      updatedLocations[locationIndex].restrictions = {
        enabled: true, // Enable when updating addresses
        included_addresses: [],
        excluded_addresses: []
      }
    }
    
    const updatedAddresses = [...(updatedLocations[locationIndex].restrictions?.included_addresses || [])]
    updatedAddresses[addressIndex] = {
      ...updatedAddresses[addressIndex],
      [field]: value
    }
    updatedLocations[locationIndex] = {
      ...updatedLocations[locationIndex],
      restrictions: {
        ...updatedLocations[locationIndex].restrictions,
        included_addresses: updatedAddresses
      }
    }
    form.setValue("locations", updatedLocations)
  }

  const handleExcludedAddressUpdate = (locationIndex: number, addressIndex: number, field: string, value: string) => {
    const current = form.getValues("locations") || []
    const updatedLocations = [...current]
    
    // Ensure restrictions object exists
    if (!updatedLocations[locationIndex].restrictions) {
      updatedLocations[locationIndex].restrictions = {
        enabled: true, // Enable when updating addresses
        included_addresses: [],
        excluded_addresses: []
      }
    }
    
    const updatedAddresses = [...(updatedLocations[locationIndex].restrictions?.excluded_addresses || [])]
    updatedAddresses[addressIndex] = {
      ...updatedAddresses[addressIndex],
      [field]: value
    }
    updatedLocations[locationIndex] = {
      ...updatedLocations[locationIndex],
      restrictions: {
        ...updatedLocations[locationIndex].restrictions,
        excluded_addresses: updatedAddresses
      }
    }
    form.setValue("locations", updatedLocations)
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
  const formData = form.watch()
  const isRequiredFieldsComplete = !!(formData.name && formData.name.trim() && formData.url && formData.url.trim())
  
  // Check if there are any validation errors that should prevent project creation
  const hasValidationErrors = () => {
    // Update step errors before checking
    const newErrors = new Set<number>()
    for (let i = 1; i <= 7; i++) { // Only check steps 1-7 for project creation
      if (!validateStep(i)) {
        newErrors.add(i)
      }
    }
    return newErrors.size > 0
  }

  // Show loading skeleton while creating site
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center p-4">
        <div className="container max-w-6xl mx-auto">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-8">
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            <div />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Steps skeleton */}
            <div className="space-y-6">
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-1" />
                      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content skeleton */}
            <div className="lg:col-span-2">
              <Card className="h-[600px]">
                <CardHeader>
                  <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-2" />
                  <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                  </div>
                  <div className="space-y-4">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                  </div>
                  <div className="space-y-4">
                    <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    <div className="h-24 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                  </div>
                </CardContent>
                <ActionFooter>
                  <div className="flex justify-between">
                    <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                    <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                  </div>
                </ActionFooter>
              </Card>
            </div>
          </div>

          {/* Loading indicator */}
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg shadow-lg p-6 text-center">
              <LoadingSkeleton variant="fullscreen" size="lg" />
              <h3 className="text-lg font-semibold mb-2">Creating Your Project</h3>
              <p className="text-sm text-muted-foreground">
                Setting up your workspace and configuring everything...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center p-4 relative z-[9999]">
      <div className="container max-w-6xl mx-auto relative z-[9999]">
        {/* Header with optional back button */}
        <div className="flex items-center justify-between mb-8">
          {hasExistingSites && (
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
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
              {steps.map((step, index) => {
                // Check if this step should be disabled
                const isStepDisabled = () => {
                  // Always allow going to completed steps or current step
                  if (step.id <= currentStep) return false
                  
                  // If site is not created (currentStep < 8), don't allow jumping to success step
                  if (step.id === 8 && currentStep < 8) return true
                  
                  // Don't allow jumping ahead if there are validation errors in previous steps
                  for (let i = 1; i < step.id; i++) {
                    if (hasValidated && stepErrors.has(i)) return true
                  }
                  
                  return false
                }
                
                const disabled = isStepDisabled()
                
                return (
                  <button
                    key={step.id}
                    onClick={() => {
                      if (disabled) return
                      setHasValidated(true)
                      updateStepErrors()
                      setCurrentStep(step.id)
                    }}
                    disabled={disabled}
                    className={cn(
                      "flex items-center gap-4 w-full text-left rounded-lg p-2 transition-colors",
                      disabled 
                        ? "cursor-not-allowed opacity-50" 
                        : "hover:bg-muted/30"
                    )}
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
                )
              })}
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
                    <BasicInfoStep form={form} />
                  )}

                  {currentStep === 2 && (
                    <FocusModeStep form={form} />
                  )}

                  {currentStep === 8 ? (
                    <SuccessStep 
                      projectName={form.watch("name")}
                      onNavigateToSettings={navigateToSiteSettings}
                      onNavigateToDashboard={onGoToDashboard}
                    />
                  ) : (
                    <>
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
                        <LocationsOnboardingStep
                          locations={form.watch("locations") || []}
                          onAddLocation={addLocation}
                          onRemoveLocation={removeLocation}
                          onAddIncludedAddress={addIncludedAddress}
                          onAddExcludedAddress={addExcludedAddress}
                          onRemoveIncludedAddress={removeIncludedAddress}
                          onRemoveExcludedAddress={removeExcludedAddress}
                          onIncludedAddressUpdate={handleIncludedAddressUpdate}
                          onExcludedAddressUpdate={handleExcludedAddressUpdate}
                        />
                      )}


                        

                      {currentStep === 5 && (
                        <CompanyInfoStep form={form} />
                      )}

                      {currentStep === 6 && (
                        <MarketingStep 
                          form={form}
                          addMarketingChannel={addMarketingChannel}
                          removeMarketingChannel={removeMarketingChannel}
                        />
                      )}

                      {currentStep === 7 && (
                        <ProductsServicesStep 
                          form={form}
                          addProduct={addProduct}
                          removeProduct={removeProduct}
                          addService={addService}
                          removeService={removeService}
                          expandedProducts={expandedProducts}
                          expandedServices={expandedServices}
                          toggleProductExpanded={toggleProductExpanded}
                          toggleServiceExpanded={toggleServiceExpanded}
                        />
                      )}
                    </>
                  )}
                </CardContent>

                <ActionFooter>
                  {currentStep < 8 && (
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
                  )}

                  {currentStep < 7 ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      disabled={currentStep === 1 && !isRequiredFieldsComplete}
                      size="lg"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : currentStep === 7 ? (
                    <Button
                      type="button"
                      onClick={handleComplete}
                      disabled={isLoading || hasValidationErrors()}
                      size="lg"
                      className="min-w-[140px] bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                          <span>Creating</span>
                        </div>
                      ) : "Create Project"}
                      <Check className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <div className="flex gap-4 w-full">
                      <Button 
                        onClick={onGoToDashboard || (() => router.push("/dashboard"))}
                        size="lg"
                        className="flex-1"
                      >
                        Go to Dashboard
                      </Button>
                      <Button 
                        onClick={navigateToSiteSettings}
                        variant="outline"
                        size="lg"
                        className="flex-1"
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Configure Channels
                      </Button>
                    </div>
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