import {
  isCurrentZavuInboundMx,
  isReplaceableInboundMxConflict,
  normalizeDnsHost,
  ZAVU_INBOUND_MX_HOST,
} from "@/lib/zavu-email-dns"

describe("Zavu inbound email DNS", () => {
  it("normalizes DNS hosts before comparing them", () => {
    expect(normalizeDnsHost("INBOUND-SMTP.US-EAST-1.AMAZONAWS.COM."))
      .toBe(ZAVU_INBOUND_MX_HOST)
    expect(isCurrentZavuInboundMx("INBOUND-SMTP.US-EAST-1.AMAZONAWS.COM."))
      .toBe(true)
  })

  it("recognizes obsolete Zavu and SES feedback MX records", () => {
    expect(isReplaceableInboundMxConflict("inbound.zavu.dev")).toBe(true)
    expect(
      isReplaceableInboundMxConflict("feedback-smtp.us-east-1.amazonses.com.")
    ).toBe(true)
  })

  it("does not allow replacing unrelated mail providers", () => {
    expect(isReplaceableInboundMxConflict("aspmx.l.google.com")).toBe(false)
    expect(
      isReplaceableInboundMxConflict("inbound-smtp.us-east-1.amazonaws.com")
    ).toBe(false)
  })
})
