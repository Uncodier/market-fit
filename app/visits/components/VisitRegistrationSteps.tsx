"use client"

import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { ReservationResourceType } from "@/app/types"
import { SignaturePad } from "./SignaturePad"
import { VisitDurationPicker } from "./VisitDurationPicker"
import { VisitIdStep } from "./VisitIdStep"
import { VisitIdentityStep } from "./VisitIdentityStep"
import { VisitPhotoStep } from "./VisitPhotoStep"
import { VisitResourcePicker } from "./VisitResourcePicker"
import { VisitSliderCard } from "./VisitSliderCard"
import { VisitSuccessPanel } from "./VisitSuccessPanel"
import { VisitTermsView } from "./VisitTermsView"
import type { VisitStep } from "./visit-form-steps"

type Mode = "kiosk" | "buyer"

export function VisitRegistrationSteps({
  mode,
  steps,
  activeStep,
  activeIndex,
  submitting,
  visitorName,
  visitorEmail,
  visitorPhone,
  nameOk,
  identityOk,
  emailInvalid,
  phoneInvalid,
  nameError,
  emailError,
  phoneError,
  contactHintError,
  resourceType,
  availableResourceTypes,
  services,
  locations,
  employees,
  catalogItemId,
  locationId,
  assigneeUserId,
  resourceOk,
  durationMinutes,
  defaultDuration,
  durationOk,
  termsText,
  termsAccepted,
  termsOk,
  signatureOk,
  photoDataUrl,
  photoOk,
  idDataUrl,
  idOk,
  resourceLabel,
  resolvedDuration,
  backUrl,
  unlockedThrough,
  nextAfter,
  prevBefore,
  nextLabel,
  setActiveStep,
  setVisitorName,
  setVisitorEmail,
  setVisitorPhone,
  setIdentityTouched,
  setResourceType,
  setCatalogItemId,
  setLocationId,
  setAssigneeUserId,
  setDurationMinutes,
  setTermsAccepted,
  setSignatureDataUrl,
  setPhotoDataUrl,
  setIdDataUrl,
  continueFrom,
  onRegisterAnother,
  resolveResourceLabel,
}: {
  mode: Mode
  steps: VisitStep[]
  activeStep: VisitStep
  activeIndex: number
  submitting: boolean
  visitorName: string
  visitorEmail: string
  visitorPhone: string
  nameOk: boolean
  identityOk: boolean
  emailInvalid: boolean
  phoneInvalid: boolean
  nameError: string | null
  emailError: string | null
  phoneError: string | null
  contactHintError: string | null
  resourceType: ReservationResourceType
  availableResourceTypes: ReservationResourceType[]
  services: { id: string; label: string; hint?: string }[]
  locations: { id: string; label: string }[]
  employees: { id: string; label: string }[]
  catalogItemId: string
  locationId: string
  assigneeUserId: string
  resourceOk: boolean
  durationMinutes: number | null
  defaultDuration: number
  durationOk: boolean
  termsText: string
  termsAccepted: boolean
  termsOk: boolean
  signatureOk: boolean
  photoDataUrl: string | null
  photoOk: boolean
  idDataUrl: string | null
  idOk: boolean
  resourceLabel: string
  resolvedDuration: number
  backUrl?: string
  unlockedThrough: (step: VisitStep) => boolean
  nextAfter: (step: VisitStep) => VisitStep
  prevBefore: (step: VisitStep) => VisitStep
  nextLabel: (step: VisitStep) => string
  setActiveStep: (step: VisitStep) => void
  setVisitorName: (v: string) => void
  setVisitorEmail: (v: string) => void
  setVisitorPhone: (v: string) => void
  setIdentityTouched: (v: boolean) => void
  setResourceType: (v: ReservationResourceType) => void
  setCatalogItemId: (v: string) => void
  setLocationId: (v: string) => void
  setAssigneeUserId: (v: string) => void
  setDurationMinutes: (v: number | null) => void
  setTermsAccepted: (v: boolean) => void
  setSignatureDataUrl: (v: string | null) => void
  setPhotoDataUrl: (v: string | null) => void
  setIdDataUrl: (v: string | null) => void
  continueFrom: (step: VisitStep, canProceed: boolean) => void
  onRegisterAnother: () => void
  resolveResourceLabel: () => string
}) {
  const { t } = useLocalization()

  return (
    <>
      {steps.includes("identity") && (
        <VisitIdentityStep
          index={steps.indexOf("identity")}
          activeIndex={activeIndex}
          isActive={activeStep === "identity"}
          mode={mode}
          visitorName={visitorName}
          visitorEmail={visitorEmail}
          visitorPhone={visitorPhone}
          nameOk={nameOk}
          identityOk={identityOk}
          emailInvalid={emailInvalid}
          phoneInvalid={phoneInvalid}
          nameError={nameError}
          emailError={emailError}
          phoneError={phoneError}
          contactHintError={contactHintError}
          onNameChange={setVisitorName}
          onEmailChange={setVisitorEmail}
          onPhoneChange={setVisitorPhone}
          onTouch={() => setIdentityTouched(true)}
          onContinue={() => setActiveStep("resource")}
          onActivate={() => setActiveStep("identity")}
        />
      )}

      {steps.includes("resource") && (
        <VisitSliderCard
          index={steps.indexOf("resource")}
          activeIndex={activeIndex}
          unlocked={unlockedThrough("resource")}
          isActive={activeStep === "resource"}
          title={t("visits.steps.resource.title")}
          description={t("visits.steps.resource.description")}
          onActivate={() => setActiveStep("resource")}
          showMobileBack
          onBack={() => setActiveStep(prevBefore("resource"))}
          footer={
            <Button
              className="w-full font-semibold shadow-sm"
              disabled={!resourceOk || submitting}
              onClick={() => continueFrom("resource", resourceOk)}
            >
              {nextLabel("resource")}
            </Button>
          }
        >
          <VisitResourcePicker
            resourceType={resourceType}
            onResourceTypeChange={setResourceType}
            availableTypes={availableResourceTypes}
            services={services}
            locations={locations}
            employees={employees}
            catalogItemId={catalogItemId}
            locationId={locationId}
            assigneeUserId={assigneeUserId}
            onSelectService={(id) => {
              setCatalogItemId(id)
              const next = nextAfter("resource")
              if (next !== "success") setActiveStep(next)
            }}
            onSelectLocation={(id) => {
              setLocationId(id)
              const next = nextAfter("resource")
              if (next !== "success") setActiveStep(next)
            }}
            onSelectEmployee={(id) => {
              setAssigneeUserId(id)
              const next = nextAfter("resource")
              if (next !== "success") setActiveStep(next)
            }}
          />
        </VisitSliderCard>
      )}

      {steps.includes("duration") && (
        <VisitSliderCard
          index={steps.indexOf("duration")}
          activeIndex={activeIndex}
          unlocked={unlockedThrough("duration")}
          isActive={activeStep === "duration"}
          title={t("visits.steps.duration.title")}
          description={t("visits.steps.duration.description")}
          onActivate={() => setActiveStep("duration")}
          showMobileBack
          onBack={() => setActiveStep(prevBefore("duration"))}
          footer={
            <Button
              className="w-full font-semibold shadow-sm"
              disabled={!durationOk || submitting}
              onClick={() => continueFrom("duration", durationOk)}
            >
              {nextLabel("duration")}
            </Button>
          }
        >
          <VisitDurationPicker
            value={durationMinutes}
            defaultMinutes={defaultDuration}
            onChange={(minutes) => {
              setDurationMinutes(minutes)
              const next = nextAfter("duration")
              if (next !== "success") setActiveStep(next)
            }}
          />
        </VisitSliderCard>
      )}

      {steps.includes("terms") && (
        <VisitSliderCard
          index={steps.indexOf("terms")}
          activeIndex={activeIndex}
          unlocked={unlockedThrough("terms")}
          isActive={activeStep === "terms"}
          title={t("visits.steps.terms.title")}
          description={t("visits.steps.terms.description")}
          onActivate={() => setActiveStep("terms")}
          showMobileBack={steps[0] !== "terms"}
          onBack={() => setActiveStep(prevBefore("terms"))}
          footer={
            <Button
              className="w-full font-semibold shadow-sm"
              disabled={!termsOk || submitting}
              onClick={() => continueFrom("terms", termsOk)}
            >
              {nextLabel("terms")}
            </Button>
          }
        >
          <VisitTermsView termsText={termsText} agreed={termsAccepted} onAgreedChange={setTermsAccepted} />
        </VisitSliderCard>
      )}

      {steps.includes("signature") && (
        <VisitSliderCard
          index={steps.indexOf("signature")}
          activeIndex={activeIndex}
          unlocked={unlockedThrough("signature")}
          isActive={activeStep === "signature"}
          title={t("visits.steps.signature.title")}
          description={t("visits.steps.signature.description")}
          onActivate={() => setActiveStep("signature")}
          showMobileBack
          onBack={() => setActiveStep(prevBefore("signature"))}
          footer={
            <Button
              className="w-full font-semibold shadow-sm"
              disabled={!signatureOk || submitting}
              onClick={() => continueFrom("signature", signatureOk)}
            >
              {nextLabel("signature")}
            </Button>
          }
        >
          <SignaturePad onChange={setSignatureDataUrl} />
        </VisitSliderCard>
      )}

      {steps.includes("photo") && (
        <VisitPhotoStep
          index={steps.indexOf("photo")}
          activeIndex={activeIndex}
          unlocked={unlockedThrough("photo")}
          isActive={activeStep === "photo"}
          photoDataUrl={photoDataUrl}
          submitting={submitting}
          nextIsComplete={nextAfter("photo") === "success"}
          onActivate={() => setActiveStep("photo")}
          onBack={() => setActiveStep(prevBefore("photo"))}
          onChange={setPhotoDataUrl}
          onContinue={() => continueFrom("photo", photoOk)}
        />
      )}

      {steps.includes("id") && (
        <VisitIdStep
          index={steps.indexOf("id")}
          activeIndex={activeIndex}
          unlocked={unlockedThrough("id")}
          isActive={activeStep === "id"}
          idDataUrl={idDataUrl}
          submitting={submitting}
          nextIsComplete={nextAfter("id") === "success"}
          onActivate={() => setActiveStep("id")}
          onBack={() => setActiveStep(prevBefore("id"))}
          onChange={setIdDataUrl}
          onContinue={() => continueFrom("id", idOk)}
        />
      )}

      <VisitSliderCard
        index={steps.indexOf("success")}
        activeIndex={activeIndex}
        unlocked
        isActive={activeStep === "success"}
        isSuccess
        title={t("visits.steps.success.title")}
        onActivate={() => {}}
      >
        <VisitSuccessPanel
          isActive={activeStep === "success"}
          visitorName={visitorName}
          visitorEmail={visitorEmail}
          resourceLabel={resourceLabel || resolveResourceLabel()}
          durationMinutes={resolvedDuration}
          backUrl={backUrl}
          onRegisterAnother={onRegisterAnother}
        />
      </VisitSliderCard>
    </>
  )
}
