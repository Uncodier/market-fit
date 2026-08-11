import type { ReservationChannel, ReservationResourceType, VisitsSettings } from "@/app/types"

/** Default Visit Terms when a site has not configured custom text. */
export const DEFAULT_VISIT_TERMS = `Visit Terms — Data handling & confidentiality (Makinari)

By registering this visit, you acknowledge and agree that:

1. Purpose of collection
Your name and contact details (email and/or phone), visit target, duration, and any signature or photo captured during registration are collected to identify visitors, manage on-site or online check-in, and keep an accurate visit record for the business hosting this visit.

2. Confidentiality
Information shared during your visit, including business, product, or operational details you may see or hear, should be treated as confidential unless the host states otherwise. Do not copy, record, or disclose confidential information without prior written permission from the host.

3. Use of your data
The host may use your visit data to confirm attendance, improve safety and operations, follow up when appropriate, and comply with legal or contractual obligations. Visit records may be stored in Makinari, the platform used by the host to operate visit registration.

4. Photos and signatures
If a signature or photo is requested, it is used only to evidence acceptance of these terms and to identify the visitor for this visit record.

5. Your rights
You may ask the host about the personal data they hold related to this visit and request correction or deletion where applicable under local law.

6. Acceptance
By continuing and accepting these terms, you confirm that the information you provided is accurate and that you agree to this data handling and confidentiality notice.

Makinari Inc. provides the software used for this registration. The host business remains responsible for how visit data is used beyond this registration flow.`

export const DEFAULT_VISITS_SETTINGS: VisitsSettings = {
  enabled_physical: true,
  enabled_online: true,
  require_signature: true,
  require_photo: true,
  require_id: false,
  terms_text: "",
  default_duration_minutes: 60,
}

export function resolveVisitTermsText(
  raw?: string | null,
  localizedDefault?: string | null
): string {
  const custom = typeof raw === "string" ? raw.trim() : ""
  if (custom) return custom
  const localized = typeof localizedDefault === "string" ? localizedDefault.trim() : ""
  return localized || DEFAULT_VISIT_TERMS
}

export function isValidVisitEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/** Accepts common local/international phone numbers (7–15 digits). */
export function isValidVisitPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 7 && digits.length <= 15
}

/** Visible duration choices for location / team visits (not a dropdown). */
export const BASE_VISIT_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const

export function visitDurationOptions(defaultMinutes?: number | null): number[] {
  const set = new Set<number>(BASE_VISIT_DURATION_OPTIONS)
  if (typeof defaultMinutes === "number" && defaultMinutes > 0) set.add(defaultMinutes)
  return [...set].sort((a, b) => a - b)
}

export function mergeVisitsSettings(raw?: Partial<VisitsSettings> | null): VisitsSettings {
  return {
    ...DEFAULT_VISITS_SETTINGS,
    ...(raw || {}),
    terms_text: typeof raw?.terms_text === "string" ? raw.terms_text : DEFAULT_VISITS_SETTINGS.terms_text,
    default_duration_minutes:
      typeof raw?.default_duration_minutes === "number" && raw.default_duration_minutes > 0
        ? raw.default_duration_minutes
        : DEFAULT_VISITS_SETTINGS.default_duration_minutes,
  }
}

export type VisitResourceInput = {
  resourceType: ReservationResourceType
  catalogItemId?: string | null
  locationId?: string | null
  assigneeUserId?: string | null
}

export function buildVisitResourcePayload(input: VisitResourceInput): {
  resource_type: ReservationResourceType
  catalog_item_id: string | null
  location_id: string | null
  assignee_user_id: string | null
} | { error: string } {
  const { resourceType, catalogItemId, locationId, assigneeUserId } = input

  if (resourceType === "catalog_item") {
    if (!catalogItemId) return { error: "Service is required" }
    return {
      resource_type: "catalog_item",
      catalog_item_id: catalogItemId,
      location_id: null,
      assignee_user_id: null,
    }
  }

  if (resourceType === "location") {
    if (!locationId) return { error: "Location is required" }
    return {
      resource_type: "location",
      catalog_item_id: null,
      location_id: locationId,
      assignee_user_id: null,
    }
  }

  if (resourceType === "employee") {
    if (!assigneeUserId) return { error: "Employee is required" }
    return {
      resource_type: "employee",
      catalog_item_id: null,
      location_id: null,
      assignee_user_id: assigneeUserId,
    }
  }

  return { error: "Invalid resource type" }
}

export function assertVisitAttestation(params: {
  settings: VisitsSettings
  channel: ReservationChannel
  termsAccepted: boolean
  signatureDataUrl?: string | null
  photoDataUrl?: string | null
  idDataUrl?: string | null
}): { error: string } | null {
  const { settings, channel, termsAccepted, signatureDataUrl, photoDataUrl, idDataUrl } = params

  if (channel === "physical" && !settings.enabled_physical) {
    return { error: "Physical visit registration is disabled" }
  }
  if (channel === "online" && !settings.enabled_online) {
    return { error: "Online visit registration is disabled" }
  }

  // Always require acceptance: custom site terms or Makinari default template.
  if (!termsAccepted) {
    return { error: "Visit Terms must be accepted" }
  }
  if (settings.require_signature && !signatureDataUrl) {
    return { error: "Signature is required" }
  }
  if (settings.require_photo && !photoDataUrl) {
    return { error: "Photo is required" }
  }
  if (settings.require_id && !idDataUrl) {
    return { error: "ID document is required" }
  }

  return null
}

export type VisitAttestationGaps = {
  terms: boolean
  signature: boolean
  photo: boolean
  id: boolean
}

export function getVisitAttestationGaps(
  settings: VisitsSettings,
  reservation: {
    terms_accepted_at?: string | null
    signature_url?: string | null
    photo_url?: string | null
    id_url?: string | null
  }
): VisitAttestationGaps {
  return {
    terms: !reservation.terms_accepted_at,
    signature: Boolean(settings.require_signature) && !reservation.signature_url,
    photo: Boolean(settings.require_photo) && !reservation.photo_url,
    id: Boolean(settings.require_id) && !reservation.id_url,
  }
}

export function hasVisitAttestationGaps(gaps: VisitAttestationGaps): boolean {
  return gaps.terms || gaps.signature || gaps.photo || gaps.id
}

export function reservationCanRegisterVisitor(
  settings: VisitsSettings,
  reservation: {
    status: string
    terms_accepted_at?: string | null
    signature_url?: string | null
    photo_url?: string | null
    id_url?: string | null
  }
): boolean {
  if (reservation.status !== "pending" && reservation.status !== "confirmed") return false
  return hasVisitAttestationGaps(getVisitAttestationGaps(settings, reservation))
}

/** Attestation checks that treat already-stored fields as satisfied. */
export function assertMissingVisitAttestation(params: {
  settings: VisitsSettings
  channel: ReservationChannel
  gaps: VisitAttestationGaps
  termsAccepted: boolean
  signatureDataUrl?: string | null
  photoDataUrl?: string | null
  idDataUrl?: string | null
}): { error: string } | null {
  const { settings, channel, gaps, termsAccepted, signatureDataUrl, photoDataUrl, idDataUrl } = params

  if (channel === "physical" && !settings.enabled_physical) {
    return { error: "Physical visit registration is disabled" }
  }
  if (channel === "online" && !settings.enabled_online) {
    return { error: "Online visit registration is disabled" }
  }

  if (gaps.terms && !termsAccepted) {
    return { error: "Visit Terms must be accepted" }
  }
  if (gaps.signature && !signatureDataUrl) {
    return { error: "Signature is required" }
  }
  if (gaps.photo && !photoDataUrl) {
    return { error: "Photo is required" }
  }
  if (gaps.id && !idDataUrl) {
    return { error: "ID document is required" }
  }

  return null
}

export function reservationResourceLabel(res: {
  resource_type?: ReservationResourceType | null
  catalog_item?: { name?: string | null } | null
  location?: { name?: string | null } | null
  assignee_name?: string | null
}): string {
  const type = res.resource_type || "catalog_item"
  if (type === "location") return res.location?.name || "Location"
  if (type === "employee") return res.assignee_name || "Employee"
  return res.catalog_item?.name || "Service"
}

export type ReservationSignatureKind = "digital" | "physical" | "none"

/**
 * Digital = linked user account (booking/visit under an account), or on-screen signature with account.
 * Physical = kiosk/anonymous captured signature without account.
 * None = anonymous reservation with no signature file.
 */
export function getReservationSignatureKind(res: {
  signature_url?: string | null
  buyer_user_id?: string | null
}): ReservationSignatureKind {
  if (res.buyer_user_id) return "digital"
  if (res.signature_url) return "physical"
  return "none"
}

export function visitAttestationStoragePath(urlOrPath?: string | null): string | null {
  if (!urlOrPath) return null
  const marker = "/visit-attestations/"
  const idx = urlOrPath.indexOf(marker)
  if (idx >= 0) return urlOrPath.slice(idx + marker.length)
  if (!urlOrPath.includes("://")) return urlOrPath.replace(/^\//, "")
  return null
}

export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | { error: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return { error: "Invalid data URL" }
  const contentType = match[1]
  const base64 = match[2]
  try {
    const buffer = Buffer.from(base64, "base64")
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg"
    return { buffer, contentType, ext }
  } catch {
    return { error: "Failed to decode data URL" }
  }
}
