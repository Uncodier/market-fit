"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

// UI Components
import { Button } from "../ui/button"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "../ui/card-footer"
import { Form } from "../ui/form"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { SiteOnboardingSkeleton } from "./site-onboarding-skeleton"
import {
  Globe,
  ChevronRight,
  ChevronLeft,
  Check,
  X
} from "../ui/icons"

// Extracted modules
import { siteOnboardingSchema, SiteOnboardingValues } from "./schemas/onboarding-schema"
import { 
  steps 
} from "./constants/onboarding-constants"
import {
  sanitizeOnboardingValues,
  getFirstErrorStep,
  getValidationErrorMessage,
  getRequiredFieldErrors,
  canProceedFromStep,
  prepareOnboardingSubmit,
  readAutofilledBasicFields,
} from "./utils/onboarding-submit"
import { SuccessStep } from "./steps/success-step"
import { BasicInfoStep } from "./steps/basic-info-step"
import { BusinessHoursStep } from "./steps/business-hours-step"
import { FocusModeStep } from "./steps/focus-mode-step"
import { CompanyInfoStep } from "./steps/company-info-step"
import { MarketingStep } from "./steps/marketing-step"
import { ProductsServicesStep } from "./steps/products-services-step"
import { LocationsOnboardingStep } from "./LocationsOnboardingStep"

import { cn } from "@/lib/utils"

interface SiteOnboardingProps {
  onComplete: (data: SiteOnboardingValues) => void
  isLoading?: boolean
  isSuccess?: boolean
  createdSiteId?: string
  onGoToDashboard?: () => Promise<void>
  onGoToSettings?: () => Promise<void>
  hasExistingSites?: boolean
}

export function SiteOnboarding({ 
  onComplete, 
  isLoading, 
  isSuccess, 
  createdSiteId,
  onGoToDashboard,
  onGoToSettings,
  hasExistingSites = false,
}: SiteOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())
  const [stepErrors, setStepErrors] = useState<Set<number>>(new Set())
  const [hasValidated, setHasValidated] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
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

  const watchedName = form.watch("name")
  const watchedUrl = form.watch("url")
  const currentValues = { ...form.getValues(), name: watchedName, url: watchedUrl }
  const canGoNext = canProceedFromStep(currentStep, currentValues)

  // Validation and step management
  const validateStep = (stepId: number): boolean => {
    return canProceedFromStep(stepId, currentValues)
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

  const applySanitizedValues = (sanitized: SiteOnboardingValues) => {
    form.setValue("name", sanitized.name)
    form.setValue("url", sanitized.url)
    form.setValue("products", sanitized.products)
    form.setValue("services", sanitized.services)
    form.setValue("marketing_channels", sanitized.marketing_channels)
    form.setValue("business_hours", sanitized.business_hours)
    form.setValue("locations", sanitized.locations)
    form.setValue("marketing_budget", sanitized.marketing_budget)
    form.setValue("focusMode", sanitized.focusMode)
  }

  const syncAutofilledBasicFields = () => {
    const autofilled = readAutofilledBasicFields(formRef.current, form.getValues())
    if (autofilled.name) form.setValue("name", autofilled.name)
    if (autofilled.url) form.setValue("url", autofilled.url)
  }

  useEffect(() => {
    if (currentStep !== 1) return
    const formEl = formRef.current
    if (!formEl) return

    const sync = () => syncAutofilledBasicFields()
    sync()
    formEl.addEventListener("animationstart", sync)
    formEl.addEventListener("input", sync)
    formEl.addEventListener("change", sync)
    return () => {
      formEl.removeEventListener("animationstart", sync)
      formEl.removeEventListener("input", sync)
      formEl.removeEventListener("change", sync)
    }
  }, [currentStep])

  const nextStep = () => {
    setHasValidated(true)
    syncAutofilledBasicFields()

    if (currentStep === 1) {
      const fieldErrors = getRequiredFieldErrors(form.getValues())
      if (fieldErrors.name) {
        form.setError("name", { type: "manual", message: fieldErrors.name })
      }
      if (fieldErrors.url) {
        form.setError("url", { type: "manual", message: fieldErrors.url })
      }
      if (fieldErrors.name || fieldErrors.url) {
        updateStepErrors()
        toast.error(fieldErrors.name || fieldErrors.url)
        return
      }
    }

    applySanitizedValues(sanitizeOnboardingValues(form.getValues()))
    updateStepErrors()
    
    if (currentStep < 7) {
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
    if (isLoading) return
    setHasValidated(true)
    syncAutofilledBasicFields()

    const prepared = prepareOnboardingSubmit(form.getValues())
    applySanitizedValues(prepared.data)

    if (!prepared.ok) {
      for (const issue of prepared.error.issues) {
        const path = issue.path.join(".")
        if (path) {
          form.setError(path as any, { type: "manual", message: issue.message })
        }
      }
      const errorStep = getFirstErrorStep(prepared.error)
      setCurrentStep(errorStep)
      updateStepErrors()
      toast.error(getValidationErrorMessage(prepared.error))
      return
    }

    onComplete(prepared.data)
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

  // Show loading skeleton while creating site, but never cover the success step
  if (isLoading && !isSuccess) {
    return (
      <div className="relative">
        <SiteOnboardingSkeleton />
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border dark:border-white/5 border-black/5 rounded-lg shadow-lg p-6 text-center">
            <LoadingSkeleton variant="fullscreen" size="lg" />
            <h3 className="text-lg font-semibold mb-2">Creating Your Project</h3>
            <p className="text-sm text-muted-foreground">
              Setting up your workspace and configuring everything...
            </p>
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
                  
                  // Don't allow jumping ahead if required fields in previous steps are empty
                  for (let i = 1; i < step.id; i++) {
                    if (!validateStep(i)) return true
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
                      "w-8 h-8 rounded-full font-inter flex items-center justify-center text-sm font-medium transition-colors",
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
              <form
                ref={formRef}
                noValidate
                autoComplete="on"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (currentStep < 7) {
                    if (!canGoNext) return
                    nextStep()
                  } else if (currentStep === 7) handleComplete()
                }}
              >
              <SectionCard className="bg-card rounded-xl border shadow-lg overflow-hidden">
                {/* Step Header */}
                <SectionCardHeader className="p-8 pb-6">
                  <div className="mb-2">
                    <SectionCardTitle className="text-2xl font-semibold mb-3">
                      {steps[currentStep - 1].title}
                    </SectionCardTitle>
                    <p className="text-muted-foreground text-lg">
                      {steps[currentStep - 1].description}
                    </p>
                  </div>
                </SectionCardHeader>

                <SectionCardContent className="pb-12">
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
                        <BusinessHoursStep form={form} />
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
                </SectionCardContent>

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
                      type="submit"
                      size="lg"
                      disabled={!canGoNext}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : currentStep === 7 ? (
                    <Button
                      type="submit"
                      disabled={isLoading}
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
              </SectionCard>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  )
} 