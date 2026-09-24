"use client"

import {
  type FormEventHandler,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react"
import type { UseFormReturn } from "react-hook-form"
import { Button } from "../ui/button"
import {
  SectionCard,
  SectionCardContent,
  SectionCardHeader,
  SectionCardTitle,
} from "../ui/section-card"
import { ActionFooter } from "../ui/card-footer"
import { Form } from "../ui/form"
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion"
import { Check, ChevronLeft, ChevronRight, Globe, X } from "../ui/icons"
import { cn } from "@/lib/utils"
import { steps } from "./constants/onboarding-constants"
import type { SiteOnboardingValues } from "./schemas/onboarding-schema"
import type { OnboardingCollections } from "./hooks/use-onboarding-collections"
import { BasicInfoStep } from "./steps/basic-info-step"
import { BusinessHoursStep } from "./steps/business-hours-step"
import { CompanyInfoStep } from "./steps/company-info-step"
import { FocusModeStep } from "./steps/focus-mode-step"
import { MarketingStep } from "./steps/marketing-step"
import { ProductsServicesStep } from "./steps/products-services-step"
import { SuccessStep } from "./steps/success-step"
import { SummaryStep } from "./steps/summary-step"
import { LocationsOnboardingStep } from "./LocationsOnboardingStep"

interface OnboardingFormLayoutProps {
  form: UseFormReturn<SiteOnboardingValues>
  formRef: RefObject<HTMLFormElement | null>
  currentStep: number
  hasExistingSites: boolean
  hasValidated: boolean
  stepErrors: Set<number>
  canGoNext: boolean
  emptyCurrentStep: boolean
  isLoading?: boolean
  collections: OnboardingCollections
  onSubmit: FormEventHandler<HTMLFormElement>
  onPrevious: () => void
  onStepSelect: (stepId: number) => void
  isStepDisabled: (stepId: number) => boolean
  onBack: () => void
  onNavigateToDashboard: () => void
  onNavigateToSettings: () => void
}

function useCompactOnboarding() {
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)")
    const update = () => setIsCompact(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return isCompact
}

function StepStatus({
  stepId,
  currentStep,
  hasError,
}: {
  stepId: number
  currentStep: number
  hasError: boolean
}) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-inter text-sm font-medium ring-4 ring-background transition-colors",
        hasError
          ? "bg-red-600 text-white"
          : stepId < currentStep
            ? "bg-green-600 text-white"
            : stepId === currentStep
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
      )}
    >
      {hasError ? (
        <X className="h-4 w-4" />
      ) : stepId < currentStep ? (
        <Check className="h-4 w-4" />
      ) : (
        stepId
      )}
    </div>
  )
}

function StepContent({
  currentStep,
  form,
  collections,
  onStepSelect,
  onNavigateToDashboard,
  onNavigateToSettings,
}: Pick<
  OnboardingFormLayoutProps,
  | "currentStep"
  | "form"
  | "collections"
  | "onStepSelect"
  | "onNavigateToDashboard"
  | "onNavigateToSettings"
>) {
  if (currentStep === 1) return <BasicInfoStep form={form} />
  if (currentStep === 2) return <FocusModeStep form={form} />
  if (currentStep === 3) return <BusinessHoursStep form={form} />
  if (currentStep === 4) {
    return (
      <LocationsOnboardingStep
        locations={form.watch("locations") || []}
        onAddLocation={collections.addLocation}
        onRemoveLocation={collections.removeLocation}
        onAddIncludedAddress={collections.addIncludedAddress}
        onAddExcludedAddress={collections.addExcludedAddress}
        onRemoveIncludedAddress={collections.removeIncludedAddress}
        onRemoveExcludedAddress={collections.removeExcludedAddress}
        onIncludedAddressUpdate={collections.handleIncludedAddressUpdate}
        onExcludedAddressUpdate={collections.handleExcludedAddressUpdate}
      />
    )
  }
  if (currentStep === 5) return <CompanyInfoStep form={form} />
  if (currentStep === 6) {
    return (
      <MarketingStep
        form={form}
        addMarketingChannel={collections.addMarketingChannel}
        removeMarketingChannel={collections.removeMarketingChannel}
      />
    )
  }
  if (currentStep === 7) {
    return (
      <ProductsServicesStep
        form={form}
        addProduct={collections.addProduct}
        removeProduct={collections.removeProduct}
        addService={collections.addService}
        removeService={collections.removeService}
        expandedProducts={collections.expandedProducts}
        expandedServices={collections.expandedServices}
        toggleProductExpanded={collections.toggleProductExpanded}
        toggleServiceExpanded={collections.toggleServiceExpanded}
      />
    )
  }
  if (currentStep === 8) {
    return <SummaryStep values={form.getValues()} onEditStep={onStepSelect} />
  }
  return (
    <SuccessStep
      projectName={form.watch("name")}
      onNavigateToSettings={onNavigateToSettings}
      onNavigateToDashboard={async () => {
        await onNavigateToDashboard()
      }}
    />
  )
}

function StepFooter({
  currentStep,
  canGoNext,
  emptyCurrentStep,
  isLoading,
  onPrevious,
  onNavigateToDashboard,
  onNavigateToSettings,
}: Pick<
  OnboardingFormLayoutProps,
  | "currentStep"
  | "canGoNext"
  | "emptyCurrentStep"
  | "isLoading"
  | "onPrevious"
  | "onNavigateToDashboard"
  | "onNavigateToSettings"
>) {
  return (
    <ActionFooter className="flex-wrap px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      {currentStep > 1 && currentStep < 9 ? (
        <Button type="button" variant="outline" onClick={onPrevious} size="lg">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
      ) : currentStep === 1 ? (
        <div />
      ) : null}

      {currentStep < 8 ? (
        <Button type="submit" variant="outline" size="lg" disabled={!canGoNext}>
          {emptyCurrentStep ? "Skip" : "Next"}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      ) : currentStep === 8 ? (
        <Button
          type="submit"
          disabled={isLoading}
          size="lg"
          className="min-w-[140px] bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-pulse rounded bg-muted" />
              Creating
            </span>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Create Project
            </>
          )}
        </Button>
      ) : (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-4">
          <Button
            type="button"
            onClick={onNavigateToDashboard}
            size="lg"
            className="flex-1"
          >
            Go to Dashboard
          </Button>
          <Button
            type="button"
            onClick={onNavigateToSettings}
            variant="outline"
            size="lg"
            className="flex-1"
          >
            <Globe className="mr-2 h-4 w-4" />
            Configure Channels
          </Button>
        </div>
      )}
    </ActionFooter>
  )
}

function ActiveStepCard(
  props: Pick<
    OnboardingFormLayoutProps,
    | "currentStep"
    | "form"
    | "collections"
    | "canGoNext"
    | "emptyCurrentStep"
    | "isLoading"
    | "onPrevious"
    | "onStepSelect"
    | "onNavigateToDashboard"
    | "onNavigateToSettings"
  > & { compact?: boolean }
) {
  const step = steps[props.currentStep - 1]

  return (
    <SectionCard
      className={cn(
        "bg-card",
        props.compact
          ? "rounded-none border-0 border-t shadow-none"
          : "rounded-xl border shadow-lg"
      )}
    >
      {!props.compact && (
        <SectionCardHeader className="p-8 pb-6">
          <SectionCardTitle className="mb-3 text-2xl font-semibold">
            {step.title}
          </SectionCardTitle>
          <p className="text-lg text-muted-foreground">{step.description}</p>
        </SectionCardHeader>
      )}
      <SectionCardContent className="px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-0">
        <StepContent {...props} />
      </SectionCardContent>
      <StepFooter {...props} />
    </SectionCard>
  )
}

function PageIntroduction({ hasExistingSites }: { hasExistingSites: boolean }) {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold sm:text-3xl lg:mb-3">
        {hasExistingSites
          ? "Create New Project"
          : "Welcome! Let's create your first project"}
      </h1>
      <p className="text-base text-muted-foreground sm:text-lg">
        {hasExistingSites
          ? "Add another project to your workspace in just a few steps"
          : "We'll help you get set up with everything you need to start tracking your market fit"}
      </p>
    </div>
  )
}

export function OnboardingFormLayout(props: OnboardingFormLayoutProps) {
  const isCompact = useCompactOnboarding()
  const previousStep = useRef(props.currentStep)

  useEffect(() => {
    if (!isCompact || previousStep.current === props.currentStep) return
    previousStep.current = props.currentStep
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    requestAnimationFrame(() => {
      document.getElementById(`onboarding-step-${props.currentStep}`)?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      })
    })
  }, [isCompact, props.currentStep])

  return (
    <div className="relative z-[9999] flex min-h-screen items-center justify-center bg-gradient-to-b from-background/40 to-background p-4">
      <div className="container relative z-[9999] mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between lg:mb-8">
          {props.hasExistingSites ? (
            <button
              type="button"
              onClick={props.onBack}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div />
          )}
        </div>

        <Form {...props.form}>
          <form
            ref={props.formRef}
            noValidate
            autoComplete="on"
            onSubmit={props.onSubmit}
          >
            {isCompact ? (
              <div className="lg:hidden">
                <PageIntroduction hasExistingSites={props.hasExistingSites} />
                <Accordion
                  type="single"
                  value={`step-${props.currentStep}`}
                  onValueChange={(value) => {
                    if (value) props.onStepSelect(Number(value.replace("step-", "")))
                  }}
                  className="mt-6 space-y-3"
                >
                  {steps.map((step) => {
                    const disabled = props.isStepDisabled(step.id)
                    return (
                      <AccordionItem
                        id={`onboarding-step-${step.id}`}
                        key={step.id}
                        value={`step-${step.id}`}
                        disabled={disabled}
                        className="scroll-mt-4 overflow-hidden rounded-xl border bg-card shadow-sm"
                      >
                        <AccordionHeader>
                          <AccordionTrigger
                            className={cn(
                              "gap-3 px-4 py-4 text-left hover:no-underline",
                              disabled && "cursor-not-allowed opacity-50"
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <StepStatus
                                stepId={step.id}
                                currentStep={props.currentStep}
                                hasError={
                                  props.hasValidated && props.stepErrors.has(step.id)
                                }
                              />
                              <span className="min-w-0">
                                <span className="block font-medium">{step.title}</span>
                                <span className="block text-sm font-normal text-muted-foreground">
                                  {step.description}
                                </span>
                              </span>
                            </span>
                          </AccordionTrigger>
                        </AccordionHeader>
                        <AccordionContent className="pb-0 [&>div]:pb-0">
                          {step.id === props.currentStep && (
                            <ActiveStepCard {...props} compact />
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </div>
            ) : (
              <div className="hidden grid-cols-1 gap-8 lg:grid lg:grid-cols-3">
                <div className="space-y-6">
                  <PageIntroduction hasExistingSites={props.hasExistingSites} />
                  <div className="flex flex-col">
                    {steps.map((step, index) => {
                      const disabled = props.isStepDisabled(step.id)
                      return (
                        <div key={step.id}>
                          <button
                            type="button"
                            onClick={() => !disabled && props.onStepSelect(step.id)}
                            disabled={disabled}
                            className={cn(
                              "relative z-10 flex w-full items-center gap-4 rounded-lg p-2 text-left transition-colors",
                              disabled
                                ? "cursor-not-allowed opacity-50"
                                : "hover:bg-muted/30"
                            )}
                          >
                            <StepStatus
                              stepId={step.id}
                              currentStep={props.currentStep}
                              hasError={
                                props.hasValidated && props.stepErrors.has(step.id)
                              }
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  "block font-medium",
                                  step.id === props.currentStep
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                                )}
                              >
                                {step.title}
                              </span>
                              <span className="block text-sm text-muted-foreground">
                                {step.description}
                              </span>
                            </span>
                          </button>
                          {index < steps.length - 1 && (
                            <div className="my-1 ml-6 h-5 w-px bg-border" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <ActiveStepCard {...props} />
                </div>
              </div>
            )}
          </form>
        </Form>
      </div>
    </div>
  )
}
