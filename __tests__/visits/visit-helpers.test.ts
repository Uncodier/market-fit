import {
  assertVisitAttestation,
  buildVisitResourcePayload,
  mergeVisitsSettings,
  reservationResourceLabel,
  visitDurationOptions,
  isValidVisitEmail,
  isValidVisitPhone,
  resolveVisitTermsText,
  DEFAULT_VISIT_TERMS,
  getReservationSignatureKind,
} from "@/app/visits/visit-helpers"

describe("visit-helpers", () => {
  describe("buildVisitResourcePayload", () => {
    it("builds catalog item payload", () => {
      expect(
        buildVisitResourcePayload({ resourceType: "catalog_item", catalogItemId: "svc-1" })
      ).toEqual({
        resource_type: "catalog_item",
        catalog_item_id: "svc-1",
        location_id: null,
        assignee_user_id: null,
      })
    })

    it("requires location id for location resources", () => {
      expect(buildVisitResourcePayload({ resourceType: "location" })).toEqual({
        error: "Location is required",
      })
    })

    it("builds employee payload", () => {
      expect(
        buildVisitResourcePayload({ resourceType: "employee", assigneeUserId: "user-1" })
      ).toEqual({
        resource_type: "employee",
        catalog_item_id: null,
        location_id: null,
        assignee_user_id: "user-1",
      })
    })
  })

  describe("assertVisitAttestation", () => {
    const settings = mergeVisitsSettings({
      require_signature: true,
      require_photo: true,
      terms_text: "Be respectful.",
    })

    it("rejects missing signature", () => {
      expect(
        assertVisitAttestation({
          settings,
          channel: "physical",
          termsAccepted: true,
          signatureDataUrl: null,
          photoDataUrl: "data:image/jpeg;base64,abc",
        })
      ).toEqual({ error: "Signature is required" })
    })

    it("rejects when physical channel disabled", () => {
      expect(
        assertVisitAttestation({
          settings: mergeVisitsSettings({ enabled_physical: false, terms_text: "Terms" }),
          channel: "physical",
          termsAccepted: true,
          signatureDataUrl: "data:image/png;base64,abc",
          photoDataUrl: "data:image/jpeg;base64,abc",
        })
      ).toEqual({ error: "Physical visit registration is disabled" })
    })

    it("passes when requirements are met", () => {
      expect(
        assertVisitAttestation({
          settings,
          channel: "online",
          termsAccepted: true,
          signatureDataUrl: "data:image/png;base64,abc",
          photoDataUrl: "data:image/jpeg;base64,abc",
        })
      ).toBeNull()
    })

    it("accepts default terms when site terms are empty", () => {
      expect(
        assertVisitAttestation({
          settings: mergeVisitsSettings({
            require_signature: true,
            require_photo: false,
            terms_text: "",
          }),
          channel: "physical",
          termsAccepted: true,
          signatureDataUrl: "data:image/png;base64,abc",
          photoDataUrl: null,
        })
      ).toBeNull()
    })

    it("rejects missing ID when required", () => {
      expect(
        assertVisitAttestation({
          settings: mergeVisitsSettings({
            require_signature: false,
            require_photo: false,
            require_id: true,
            terms_text: "Terms",
          }),
          channel: "physical",
          termsAccepted: true,
          idDataUrl: null,
        })
      ).toEqual({ error: "ID document is required" })
    })
  })

  describe("reservationResourceLabel", () => {
    it("prefers location and employee labels", () => {
      expect(
        reservationResourceLabel({
          resource_type: "location",
          location: { name: "Studio A" },
        })
      ).toBe("Studio A")
      expect(
        reservationResourceLabel({
          resource_type: "employee",
          assignee_name: "Alex",
        })
      ).toBe("Alex")
    })
  })

  describe("getReservationSignatureKind", () => {
    it("classifies digital, physical, and none", () => {
      expect(getReservationSignatureKind({ signature_url: null })).toBe("none")
      expect(getReservationSignatureKind({ signature_url: null, buyer_user_id: "u1" })).toBe("digital")
      expect(getReservationSignatureKind({ signature_url: "x", buyer_user_id: "u1" })).toBe("digital")
      expect(getReservationSignatureKind({ signature_url: "x", buyer_user_id: null })).toBe("physical")
    })
  })

  describe("resolveVisitTermsText", () => {
    it("uses custom terms when provided", () => {
      expect(resolveVisitTermsText("  Custom  ")).toBe("Custom")
    })
    it("falls back to Makinari default template", () => {
      expect(resolveVisitTermsText("")).toBe(DEFAULT_VISIT_TERMS)
      expect(resolveVisitTermsText(null)).toBe(DEFAULT_VISIT_TERMS)
    })

    it("prefers localized default over English fallback", () => {
      expect(resolveVisitTermsText("", "Plantilla ES")).toBe("Plantilla ES")
    })
  })

  describe("contact validators", () => {
    it("validates email and phone", () => {
      expect(isValidVisitEmail("a@b.co")).toBe(true)
      expect(isValidVisitEmail("bad")).toBe(false)
      expect(isValidVisitPhone("+52 55 1234 5678")).toBe(true)
      expect(isValidVisitPhone("123")).toBe(false)
    })
  })

  describe("visitDurationOptions", () => {
    it("includes custom default minutes when missing from base list", () => {
      expect(visitDurationOptions(20)).toEqual([15, 20, 30, 45, 60, 90, 120])
    })
  })
})
