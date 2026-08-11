import { buildVisitSteps } from "@/app/visits/components/visit-form-steps"
import {
  getVisitAttestationGaps,
  mergeVisitsSettings,
  reservationCanRegisterVisitor,
} from "@/app/visits/visit-helpers"

describe("buildVisitSteps attest mode", () => {
  it("includes only missing attestation steps plus success", () => {
    expect(
      buildVisitSteps({
        mode: "attest",
        needsDurationStep: false,
        needsTerms: true,
        requireSignature: true,
        requirePhoto: true,
        requireId: true,
        missing: {
          terms: false,
          signature: false,
          photo: true,
          id: false,
        },
      })
    ).toEqual(["photo", "success"])
  })

  it("includes terms when not yet accepted", () => {
    expect(
      buildVisitSteps({
        mode: "attest",
        needsDurationStep: true,
        needsTerms: true,
        requireSignature: true,
        requirePhoto: false,
        requireId: false,
        missing: {
          terms: true,
          signature: true,
          photo: false,
          id: false,
        },
      })
    ).toEqual(["terms", "signature", "success"])
  })

  it("keeps walk-in identity and resource steps", () => {
    expect(
      buildVisitSteps({
        mode: "walkin",
        needsDurationStep: false,
        needsTerms: true,
        requireSignature: true,
        requirePhoto: false,
        requireId: false,
      })
    ).toEqual(["identity", "resource", "terms", "signature", "success"])
  })
})

describe("getVisitAttestationGaps", () => {
  const settings = mergeVisitsSettings({
    require_signature: true,
    require_photo: true,
    require_id: false,
  })

  it("flags only photo when photo is missing and terms already accepted", () => {
    expect(
      getVisitAttestationGaps(settings, {
        terms_accepted_at: "2026-08-10T12:00:00.000Z",
        signature_url: "sig.png",
        photo_url: null,
        id_url: null,
      })
    ).toEqual({
      terms: false,
      signature: false,
      photo: true,
      id: false,
    })
  })

  it("allows register visitor for pending reservation with gaps", () => {
    expect(
      reservationCanRegisterVisitor(settings, {
        status: "pending",
        terms_accepted_at: null,
        signature_url: null,
        photo_url: null,
        id_url: null,
      })
    ).toBe(true)
  })

  it("hides register visitor when nothing is missing", () => {
    expect(
      reservationCanRegisterVisitor(settings, {
        status: "confirmed",
        terms_accepted_at: "2026-08-10T12:00:00.000Z",
        signature_url: "sig.png",
        photo_url: "photo.jpg",
        id_url: null,
      })
    ).toBe(false)
  })
})
