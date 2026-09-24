"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { SiteOnboardingSkeleton } from "./site-onboarding-skeleton"
import { siteOnboardingSchema, SiteOnboardingValues } from "./schemas/onboarding-schema"
import { steps } from "./constants/onboarding-constants"
import {
  sanitizeOnboardingValues,
  getFirstErrorStep,
  getValidationErrorMessage,
  getRequiredFieldErrors,
  canProceedFromStep,
  prepareOnboardingSubmit,
  readAutofilledBasicFields,
} from "./utils/onboarding-submit"
import { useOnboardingCollections } from "./hooks/use-onboarding-collections"
import { OnboardingFormLayout } from "./onboarding-form-layout"

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
  const [stepErrors, setStepErrors] = useState<Set<number>>(new Set())
  const [hasValidated, setHasValidated] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  // Move to step 9 when project is successfully created
  useEffect(() => {
    if (isSuccess) {
      setCurrentStep(9)
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
  const collections = useOnboardingCollections(form)

  const watchedName = form.watch("name")
  const watchedUrl = form.watch("url")
  const currentValues = { ...form.getValues(), name: watchedName, url: watchedUrl }
  const canGoNext = canProceedFromStep(currentStep, currentValues)

  // Validation and step management
  const validateStep = (stepId: number): boolean => {
    return canProceedFromStep(stepId, currentValues)
  }

  const isStepEmpty = (stepId: number, values: SiteOnboardingValues) => {
    switch (stepId) {
      case 1: 
        return false; // Basic info is required
      case 2: 
        return false; // Focus mode has a default value (50), so it's never technically "empty"
      case 3: 
        return !values.business_hours || values.business_hours.length === 0 || values.business_hours.every((h: any) => !h.name || !h.name.trim());
      case 4: 
        return !values.locations || values.locations.length === 0 || values.locations.every((l: any) => !l.name || !l.name.trim());
      case 5: 
        return !values.about && !values.company_size && !values.industry && 
               (!values.swot || (!values.swot.strengths && !values.swot.weaknesses && !values.swot.opportunities && !values.swot.threats)) &&
               (!values.goals || (!values.goals.quarterly && !values.goals.yearly && !values.goals.fiveYear && !values.goals.tenYear));
      case 6: 
        return (!values.marketing_budget?.total && !values.marketing_budget?.available) && 
               (!values.marketing_channels || values.marketing_channels.length === 0 || values.marketing_channels.every((c: any) => !c.name || !c.name.trim()));
      case 7: 
        return (!values.products || values.products.length === 0 || values.products.every((p: any) => !p.name || !p.name.trim())) && 
               (!values.services || values.services.length === 0 || values.services.every((s: any) => !s.name || !s.name.trim()));
      default: 
        return false;
    }
  }

  const emptyCurrentStep = isStepEmpty(currentStep, currentValues);

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

  const nextStep = async () => {
    setHasValidated(true)
    syncAutofilledBasicFields()

    let fieldsToValidate: any[] = [];
    if (currentStep === 1) fieldsToValidate = ["name", "url", "description", "logo_url"];
    else if (currentStep === 2) fieldsToValidate = ["focusMode"];
    else if (currentStep === 3) fieldsToValidate = ["business_hours"];
    else if (currentStep === 4) fieldsToValidate = ["locations"];
    else if (currentStep === 5) fieldsToValidate = ["about", "company_size", "industry", "swot", "goals"];
    else if (currentStep === 6) fieldsToValidate = ["marketing_budget", "marketing_channels"];
    else if (currentStep === 7) fieldsToValidate = ["products", "services"];

    if (fieldsToValidate.length > 0) {
      const isValid = await form.trigger(fieldsToValidate);
      if (!isValid) {
        updateStepErrors();
        return; // Don't proceed if current step has validation errors
      }
    }

    if (currentStep === 1) {
      const fieldErrors = getRequiredFieldErrors(form.getValues())
      if (fieldErrors.name || fieldErrors.url) {
        updateStepErrors()
        toast.error(fieldErrors.name || fieldErrors.url)
        return
      }
    }

    applySanitizedValues(sanitizeOnboardingValues(form.getValues()))
    updateStepErrors()
    
    if (currentStep < 8) {
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

  const handleComplete = async () => {
    if (isLoading) return
    setHasValidated(true)
    syncAutofilledBasicFields()

    const isValid = await form.trigger();
    if (!isValid) {
      updateStepErrors();
      return;
    }

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

  const isStepDisabled = (stepId: number) => {
    if (stepId <= currentStep) return false
    if (stepId === 9 && currentStep < 9) return true

    for (let previousStep = 1; previousStep < stepId; previousStep += 1) {
      if (!validateStep(previousStep)) return true
      if (hasValidated && stepErrors.has(previousStep)) return true
    }
    return false
  }

  const selectStep = (stepId: number) => {
    if (isStepDisabled(stepId)) return
    setHasValidated(true)
    updateStepErrors()
    setCurrentStep(stepId)
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
    <OnboardingFormLayout
      form={form}
      formRef={formRef}
      currentStep={currentStep}
      hasExistingSites={hasExistingSites}
      hasValidated={hasValidated}
      stepErrors={stepErrors}
      canGoNext={canGoNext}
      emptyCurrentStep={emptyCurrentStep}
      isLoading={isLoading}
      collections={collections}
      onSubmit={(event) => {
        event.preventDefault()
        if (currentStep < 8) {
          if (canGoNext) nextStep()
        } else if (currentStep === 8) {
          handleComplete()
        }
      }}
      onPrevious={prevStep}
      onStepSelect={selectStep}
      isStepDisabled={isStepDisabled}
      onBack={() => router.push("/dashboard")}
      onNavigateToDashboard={onGoToDashboard || (() => router.push("/dashboard"))}
      onNavigateToSettings={navigateToSiteSettings}
    />
  )
} 