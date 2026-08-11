import type { VisitAttestationGaps } from "../visit-helpers"

export type VisitStep =
  | "identity"
  | "resource"
  | "duration"
  | "terms"
  | "signature"
  | "photo"
  | "id"
  | "success"

export type VisitFormMode = "walkin" | "attest"

export function buildVisitSteps(opts: {
  mode?: VisitFormMode
  needsDurationStep: boolean
  needsTerms: boolean
  requireSignature: boolean
  requirePhoto: boolean
  requireId: boolean
  missing?: VisitAttestationGaps
}): VisitStep[] {
  const mode = opts.mode || "walkin"

  if (mode === "attest") {
    const missing = opts.missing || {
      terms: false,
      signature: false,
      photo: false,
      id: false,
    }
    const list: VisitStep[] = []
    if (missing.terms) list.push("terms")
    if (missing.signature) list.push("signature")
    if (missing.photo) list.push("photo")
    if (missing.id) list.push("id")
    list.push("success")
    return list
  }

  const list: VisitStep[] = ["identity", "resource"]
  if (opts.needsDurationStep) list.push("duration")
  if (opts.needsTerms) list.push("terms")
  if (opts.requireSignature) list.push("signature")
  if (opts.requirePhoto) list.push("photo")
  if (opts.requireId) list.push("id")
  list.push("success")
  return list
}

export function isVisitStepUnlocked(
  step: VisitStep,
  gates: {
    identityOk: boolean
    resourceOk: boolean
    durationOk: boolean
    termsOk: boolean
    signatureOk: boolean
    photoOk: boolean
  }
): boolean {
  if (step === "identity" || step === "success") return true
  if (step === "resource") return gates.identityOk
  if (step === "duration") return gates.identityOk && gates.resourceOk
  if (step === "terms") return gates.identityOk && gates.resourceOk && gates.durationOk
  if (step === "signature") {
    return gates.identityOk && gates.resourceOk && gates.durationOk && gates.termsOk
  }
  if (step === "photo") {
    return (
      gates.identityOk &&
      gates.resourceOk &&
      gates.durationOk &&
      gates.termsOk &&
      gates.signatureOk
    )
  }
  if (step === "id") {
    return (
      gates.identityOk &&
      gates.resourceOk &&
      gates.durationOk &&
      gates.termsOk &&
      gates.signatureOk &&
      gates.photoOk
    )
  }
  return false
}
