"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { listCatalogItems } from "@/app/catalog/actions"
import { listLocations } from "@/app/inventory/actions"
import { listReservationSchedules } from "@/app/reservations/schedule-actions"
import { attestReservation, getReservationForVisit } from "../attest-actions"
import {
  getVisitsSettings,
  listVisitEmployees,
  registerBuyerVisit,
  registerVisit,
} from "../actions"
import type { ReservationResourceType } from "@/app/types"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { VisitFormAside } from "./VisitFormAside"
import { VisitFormSkeleton } from "./VisitFormSkeleton"
import { VisitRegistrationSteps } from "./VisitRegistrationSteps"
import {
  getVisitAttestationGaps,
  hasVisitAttestationGaps,
  isValidVisitEmail,
  isValidVisitPhone,
  resolveVisitTermsText,
  type VisitAttestationGaps,
} from "../visit-helpers"
import { buildVisitSteps, isVisitStepUnlocked, type VisitStep } from "./visit-form-steps"

type Mode = "kiosk" | "buyer"

const EMPTY_GAPS: VisitAttestationGaps = {
  terms: false,
  signature: false,
  photo: false,
  id: false,
}

export function VisitRegistrationForm({
  siteId,
  mode = "kiosk",
  buyerName,
  buyerEmail,
  backUrl,
  reservationId,
}: {
  siteId: string
  mode?: Mode
  buyerName?: string
  buyerEmail?: string
  backUrl?: string
  reservationId?: string
}) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const isAttest = Boolean(reservationId)

  const [activeStep, setActiveStep] = useState<VisitStep>(isAttest ? "terms" : "identity")
  const [visitorName, setVisitorName] = useState(buyerName || "")
  const [visitorEmail, setVisitorEmail] = useState(buyerEmail || "")
  const [visitorPhone, setVisitorPhone] = useState("")
  const [resourceType, setResourceType] = useState<ReservationResourceType>("catalog_item")
  const [catalogItemId, setCatalogItemId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [assigneeUserId, setAssigneeUserId] = useState("")
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [idDataUrl, setIdDataUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resourceLabel, setResourceLabel] = useState("")
  const [identityTouched, setIdentityTouched] = useState(false)
  const [attestPrefillDone, setAttestPrefillDone] = useState(false)

  const { data: settingsData, isLoading: settingsLoading } = useSWR(
    siteId ? ["visits-settings", siteId] : null,
    () => getVisitsSettings(siteId)
  )
  const settings = settingsData?.data
  const defaultDuration = settings?.default_duration_minutes || 60

  const { data: reservationData, isLoading: reservationLoading } = useSWR(
    isAttest && siteId && reservationId ? ["reservation-for-visit", siteId, reservationId] : null,
    () => getReservationForVisit(siteId, reservationId!)
  )

  const { data: catalogData, isLoading: catalogLoading } = useSWR(
    !isAttest && siteId ? ["catalog-reservable", siteId] : null,
    () => listCatalogItems({ siteId, isReservation: true, pageSize: 100 })
  )
  const { data: locationsData, isLoading: locationsLoading } = useSWR(
    !isAttest && siteId ? ["locations", siteId] : null,
    () => listLocations(siteId)
  )
  const { data: employeesData, isLoading: employeesLoading } = useSWR(
    !isAttest && siteId ? ["visit-employees", siteId] : null,
    () => listVisitEmployees(siteId)
  )
  const { data: schedulesData } = useSWR(
    !isAttest && siteId ? ["visit-schedules", siteId] : null,
    () => listReservationSchedules(siteId)
  )

  const isBootstrapping = isAttest
    ? settingsLoading || reservationLoading || !settingsData || !reservationData
    : settingsLoading || catalogLoading || locationsLoading || employeesLoading || !settingsData

  const services = catalogData?.data || []
  const locations = locationsData?.data || []
  const employees = employeesData?.data || []
  const serviceDurations = useMemo(() => {
    const map: Record<string, number> = {}
    for (const schedule of schedulesData?.data || []) {
      if (schedule.catalog_item_id && schedule.duration_minutes > 0) {
        map[schedule.catalog_item_id] = schedule.duration_minutes
      }
    }
    return map
  }, [schedulesData])

  const availableResourceTypes = useMemo(() => {
    const types: ReservationResourceType[] = []
    if (services.length) types.push("catalog_item")
    if (locations.length) types.push("location")
    if (employees.length) types.push("employee")
    return types
  }, [services, locations, employees])

  const reservation = reservationData?.data
  const missing = useMemo(() => {
    if (isAttest && reservation) return reservation.gaps
    if (!settings) return EMPTY_GAPS
    return getVisitAttestationGaps(settings, {
      terms_accepted_at: null,
      signature_url: null,
      photo_url: null,
      id_url: null,
    })
  }, [isAttest, reservation, settings])

  useEffect(() => {
    if (buyerName) setVisitorName(buyerName)
  }, [buyerName])
  useEffect(() => {
    if (buyerEmail) setVisitorEmail(buyerEmail)
  }, [buyerEmail])
  useEffect(() => {
    if (durationMinutes == null) setDurationMinutes(defaultDuration)
  }, [defaultDuration, durationMinutes])
  useEffect(() => {
    if (availableResourceTypes.length && !availableResourceTypes.includes(resourceType)) {
      setResourceType(availableResourceTypes[0])
    }
  }, [availableResourceTypes, resourceType])

  useEffect(() => {
    if (!isAttest || !reservation || attestPrefillDone) return
    setVisitorName(reservation.visitorName)
    setVisitorEmail(reservation.visitorEmail || "")
    setResourceLabel(reservation.resourceLabel)
    setDurationMinutes(reservation.durationMinutes)
    setAttestPrefillDone(true)
    const first = buildVisitSteps({
      mode: "attest",
      needsDurationStep: false,
      needsTerms: true,
      requireSignature: false,
      requirePhoto: false,
      requireId: false,
      missing: reservation.gaps,
    }).find((s) => s !== "success")
    if (first) setActiveStep(first)
  }, [isAttest, reservation, attestPrefillDone])

  const needsDurationStep = !isAttest && (resourceType === "location" || resourceType === "employee")
  const requireSignature = Boolean(settings?.require_signature)
  const requirePhoto = Boolean(settings?.require_photo)
  const requireId = Boolean(settings?.require_id)
  const termsText = resolveVisitTermsText(settings?.terms_text, t("visits.terms.defaultTemplate"))
  const steps = useMemo(
    () =>
      buildVisitSteps({
        mode: isAttest ? "attest" : "walkin",
        needsDurationStep,
        needsTerms: true,
        requireSignature,
        requirePhoto,
        requireId,
        missing,
      }),
    [isAttest, needsDurationStep, requireSignature, requirePhoto, requireId, missing]
  )

  useEffect(() => {
    if (!steps.includes(activeStep)) {
      setActiveStep(steps.find((s) => s !== "success") || "success")
    }
  }, [steps, activeStep])

  const activeIndex = Math.max(0, steps.indexOf(activeStep))
  const serviceDuration =
    resourceType === "catalog_item" && catalogItemId
      ? serviceDurations[catalogItemId] || defaultDuration
      : null
  const resolvedDuration = isAttest
    ? durationMinutes || defaultDuration
    : needsDurationStep
      ? durationMinutes || defaultDuration
      : serviceDuration || defaultDuration

  const emailTrimmed = visitorEmail.trim()
  const phoneTrimmed = visitorPhone.trim()
  const emailValid = Boolean(emailTrimmed) && isValidVisitEmail(emailTrimmed)
  const phoneValid = Boolean(phoneTrimmed) && isValidVisitPhone(phoneTrimmed)
  const emailInvalid = Boolean(emailTrimmed) && !emailValid
  const phoneInvalid = Boolean(phoneTrimmed) && !phoneValid
  const nameOk = Boolean(visitorName.trim())
  const identityOk = isAttest || (nameOk && !emailInvalid && !phoneInvalid && (emailValid || phoneValid))
  const nameError = identityTouched && !nameOk ? t("visits.identity.nameRequired") : null
  const emailError = emailInvalid ? t("visits.identity.emailInvalid") : null
  const phoneError = phoneInvalid ? t("visits.identity.phoneInvalid") : null
  const contactHintError =
    (identityTouched || nameOk) && !emailTrimmed && !phoneTrimmed
      ? t("visits.identity.contactRequired")
      : null
  const resourceOk =
    isAttest ||
    (resourceType === "catalog_item" && Boolean(catalogItemId)) ||
    (resourceType === "location" && Boolean(locationId)) ||
    (resourceType === "employee" && Boolean(assigneeUserId))
  const durationOk = isAttest || !needsDurationStep || Boolean(durationMinutes && durationMinutes > 0)
  const termsOk = !missing.terms || (termsAccepted && Boolean(termsText))
  const signatureOk = !missing.signature || Boolean(signatureDataUrl)
  const photoOk = !missing.photo || Boolean(photoDataUrl)
  const idOk = !missing.id || Boolean(idDataUrl)
  const unlockedThrough = (step: VisitStep) =>
    isVisitStepUnlocked(step, {
      identityOk,
      resourceOk,
      durationOk,
      termsOk,
      signatureOk,
      photoOk,
    })

  const nextAfter = (step: VisitStep) => steps[steps.indexOf(step) + 1] || "success"
  const prevBefore = (step: VisitStep) => steps[Math.max(0, steps.indexOf(step) - 1)]
  const nextLabel = (step: VisitStep) =>
    nextAfter(step) === "success"
      ? submitting
        ? t("visits.actions.submitting")
        : t("visits.actions.complete")
      : t("visits.actions.continue")

  const resolveResourceLabel = () => {
    if (isAttest) return resourceLabel || reservation?.resourceLabel || t("visits.resource.serviceFallback")
    if (resourceType === "catalog_item") {
      return services.find((s: any) => s.id === catalogItemId)?.name || t("visits.resource.serviceFallback")
    }
    if (resourceType === "location") {
      return locations.find((l: any) => l.id === locationId)?.name || t("visits.resource.locationFallback")
    }
    return employees.find((e) => e.id === assigneeUserId)?.name || t("visits.resource.teamFallback")
  }

  const resetForm = () => {
    if (isAttest && reservation) {
      setActiveStep(steps.find((s) => s !== "success") || "terms")
      setTermsAccepted(false)
      setSignatureDataUrl(null)
      setPhotoDataUrl(null)
      setIdDataUrl(null)
      return
    }
    setActiveStep("identity")
    setVisitorName(buyerName || "")
    setVisitorEmail(buyerEmail || "")
    setVisitorPhone("")
    setDurationMinutes(defaultDuration)
    setTermsAccepted(false)
    setSignatureDataUrl(null)
    setPhotoDataUrl(null)
    setIdDataUrl(null)
    setResourceLabel("")
  }

  const submit = async () => {
    if (!settings) return
    setSubmitting(true)
    setResourceLabel(resolveResourceLabel())

    if (isAttest && reservationId) {
      const res = await attestReservation({
        siteId,
        reservationId,
        termsAccepted: missing.terms ? termsAccepted : true,
        acceptedTermsText: termsText,
        signatureDataUrl: missing.signature ? signatureDataUrl : null,
        photoDataUrl: missing.photo ? photoDataUrl : null,
        idDataUrl: missing.id ? idDataUrl : null,
      })
      setSubmitting(false)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setActiveStep("success")
      return
    }

    const payload = {
      siteId,
      visitorName: visitorName.trim(),
      visitorEmail: visitorEmail.trim() || null,
      visitorPhone: visitorPhone.trim() || null,
      resourceType,
      catalogItemId: resourceType === "catalog_item" ? catalogItemId : null,
      locationId: resourceType === "location" ? locationId : null,
      assigneeUserId: resourceType === "employee" ? assigneeUserId : null,
      durationMinutes: needsDurationStep ? durationMinutes : null,
      termsAccepted,
      acceptedTermsText: termsText,
      signatureDataUrl,
      photoDataUrl,
      idDataUrl,
    }
    const res = mode === "buyer" ? await registerBuyerVisit(payload) : await registerVisit(payload)
    setSubmitting(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    setActiveStep("success")
  }

  const continueFrom = (step: VisitStep, canProceed: boolean) => {
    if (!canProceed) return
    const next = nextAfter(step)
    if (next === "success") submit()
    else setActiveStep(next)
  }

  const channelEnabled =
    mode === "buyer" ? settings?.enabled_online !== false : settings?.enabled_physical !== false

  if (isBootstrapping) return <VisitFormSkeleton />

  if (isAttest && reservationData?.error) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">{reservationData.error}</div>
    )
  }

  if (isAttest && reservation && !hasVisitAttestationGaps(reservation.gaps)) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">{t("visits.attest.nothingMissing")}</div>
    )
  }

  if (settings && !channelEnabled && !isAttest) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">{t("visits.unavailable")}</div>
    )
  }

  const siteName = currentSite?.name || t("layout.sidebar.visits")
  const siteLogo =
    (currentSite as any)?.logo_url || (currentSite as any)?.settings?.branding?.logo_url
  const summaryLine = visitorName
    ? `${visitorName}${resourceOk || isAttest ? ` · ${resolveResourceLabel()}` : ""}`
    : null

  return (
    <div className="max-w-4xl w-full mx-auto">
      <div className="grid md:grid-cols-3 gap-8">
        <VisitFormAside
          siteName={siteName}
          siteLogo={siteLogo}
          durationMinutes={resolvedDuration}
          summaryLine={summaryLine}
          title={isAttest ? t("visits.attest.title") : undefined}
          hint={isAttest ? t("visits.attest.hint") : undefined}
        />

        <div className="md:col-span-2 relative w-full overflow-visible z-0">
          <style>{`@media (min-width: 768px) { .visit-slide-card { transform: var(--visit-transform); opacity: var(--visit-opacity) !important; z-index: var(--visit-z); position: absolute; left: 0; top: 0; } .visit-slide-card:hover { opacity: 1 !important; } }`}</style>
          <div className="flex flex-col md:block gap-6 md:gap-0 pb-4 md:pb-0 relative w-full md:h-[590px] overflow-hidden md:overflow-visible">
            <VisitRegistrationSteps
              mode={mode}
              steps={steps}
              activeStep={activeStep}
              activeIndex={activeIndex}
              submitting={submitting}
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
              resourceType={resourceType}
              availableResourceTypes={availableResourceTypes}
              services={services.map((item: any) => ({
                id: item.id,
                label: item.name,
                hint: serviceDurations[item.id]
                  ? t("visits.minutes", { count: serviceDurations[item.id] })
                  : undefined,
              }))}
              locations={locations.map((loc: any) => ({ id: loc.id, label: loc.name }))}
              employees={employees.map((emp) => ({ id: emp.id, label: emp.name }))}
              catalogItemId={catalogItemId}
              locationId={locationId}
              assigneeUserId={assigneeUserId}
              resourceOk={resourceOk}
              durationMinutes={durationMinutes}
              defaultDuration={defaultDuration}
              durationOk={durationOk}
              termsText={termsText}
              termsAccepted={termsAccepted}
              termsOk={termsOk}
              signatureOk={signatureOk}
              photoDataUrl={photoDataUrl}
              photoOk={photoOk}
              idDataUrl={idDataUrl}
              idOk={idOk}
              resourceLabel={resourceLabel}
              resolvedDuration={resolvedDuration}
              backUrl={isAttest ? "/reservations" : backUrl}
              unlockedThrough={unlockedThrough}
              nextAfter={nextAfter}
              prevBefore={prevBefore}
              nextLabel={nextLabel}
              setActiveStep={setActiveStep}
              setVisitorName={setVisitorName}
              setVisitorEmail={setVisitorEmail}
              setVisitorPhone={setVisitorPhone}
              setIdentityTouched={setIdentityTouched}
              setResourceType={setResourceType}
              setCatalogItemId={setCatalogItemId}
              setLocationId={setLocationId}
              setAssigneeUserId={setAssigneeUserId}
              setDurationMinutes={setDurationMinutes}
              setTermsAccepted={setTermsAccepted}
              setSignatureDataUrl={setSignatureDataUrl}
              setPhotoDataUrl={setPhotoDataUrl}
              setIdDataUrl={setIdDataUrl}
              continueFrom={continueFrom}
              onRegisterAnother={resetForm}
              resolveResourceLabel={resolveResourceLabel}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
