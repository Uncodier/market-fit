import { useRef, useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { OnboardingFormLayout } from "@/app/components/onboarding/onboarding-form-layout"
import type { OnboardingCollections } from "@/app/components/onboarding/hooks/use-onboarding-collections"
import type { SiteOnboardingValues } from "@/app/components/onboarding/schemas/onboarding-schema"

jest.mock("@/app/components/onboarding/steps/basic-info-step", () => ({
  BasicInfoStep: () => <div>Basic step content</div>,
}))
jest.mock("@/app/components/onboarding/steps/focus-mode-step", () => ({
  FocusModeStep: () => <div>Focus step content</div>,
}))
jest.mock("@/app/components/onboarding/steps/business-hours-step", () => ({
  BusinessHoursStep: () => null,
}))
jest.mock("@/app/components/onboarding/steps/company-info-step", () => ({
  CompanyInfoStep: () => null,
}))
jest.mock("@/app/components/onboarding/steps/marketing-step", () => ({
  MarketingStep: () => null,
}))
jest.mock("@/app/components/onboarding/steps/products-services-step", () => ({
  ProductsServicesStep: () => null,
}))
jest.mock("@/app/components/onboarding/steps/success-step", () => ({
  SuccessStep: () => null,
}))
jest.mock("@/app/components/onboarding/steps/summary-step", () => ({
  SummaryStep: () => null,
}))
jest.mock("@/app/components/onboarding/LocationsOnboardingStep", () => ({
  LocationsOnboardingStep: () => null,
}))

const collections = {} as OnboardingCollections

function MobileOnboardingHarness() {
  const [currentStep, setCurrentStep] = useState(1)
  const formRef = useRef<HTMLFormElement>(null)
  const form = useForm<SiteOnboardingValues>({
    defaultValues: {
      name: "",
      url: "",
      focusMode: 50,
      business_hours: [],
      locations: [],
      marketing_channels: [],
      products: [],
      services: [],
    },
  })

  return (
    <OnboardingFormLayout
      form={form}
      formRef={formRef}
      currentStep={currentStep}
      hasExistingSites
      hasValidated={false}
      stepErrors={new Set()}
      canGoNext
      emptyCurrentStep={false}
      collections={collections}
      onSubmit={(event) => event.preventDefault()}
      onPrevious={() => setCurrentStep((step) => Math.max(1, step - 1))}
      onStepSelect={setCurrentStep}
      isStepDisabled={() => false}
      onBack={jest.fn()}
      onNavigateToDashboard={jest.fn()}
      onNavigateToSettings={jest.fn()}
    />
  )
}

describe("OnboardingFormLayout on compact screens", () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))
    window.requestAnimationFrame = (callback) => {
      callback(0)
      return 0
    }
    Element.prototype.scrollIntoView = jest.fn()
  })

  it("keeps one step expanded and opens the selected step inline", async () => {
    render(<MobileOnboardingHarness />)

    const basicStep = await screen.findByRole("button", {
      name: /Basic Information/,
    })
    expect(basicStep).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Basic step content")).toBeInTheDocument()
    expect(screen.getByText("Summary")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /AI Focus Mode/ }))

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /AI Focus Mode/ })
      ).toHaveAttribute("aria-expanded", "true")
    })
    expect(screen.queryByText("Basic step content")).not.toBeInTheDocument()
    expect(screen.getByText("Focus step content")).toBeInTheDocument()
  })
})
