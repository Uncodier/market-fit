import { getEmailDomainOptions, isValidEmailDomain, normalizeEmailDomain } from "@/app/components/settings/email-domain-options"

const email = (domain: string, domainId = "domain_1", status = "verified") => ({
  id: domainId, type: "email", metadata: { domain, email_domain_id: domainId, domain_status: status },
})

describe("email domain suggestions", () => {
  it("deduplicates normalized exact domains and keeps subdomains separate", () => {
    expect(getEmailDomainOptions([
      email("Example.COM."), email(" example.com "), email("agents.example.com", "domain_2"),
    ])).toEqual([
      { domain: "agents.example.com", previouslyVerified: true },
      { domain: "example.com", previouslyVerified: true },
    ])
  })

  it("prioritizes previously verified domains without treating suggestions as provider proof", () => {
    expect(getEmailDomainOptions([
      email("a.example.com", "a", "pending"), email("z.example.com", "z"),
    ])).toEqual([
      { domain: "z.example.com", previouslyVerified: true },
      { domain: "a.example.com", previouslyVerified: false },
    ])
  })

  it("ignores non-email, incomplete, malformed and current-channel metadata", () => {
    expect(getEmailDomainOptions([
      { ...email("example.com"), type: "sms" },
      { type: "email", metadata: { domain: "example.com" } },
      email("https://example.com"), email("example.com", "current"),
      { type: "email", metadata: null }, email("valid.example.com", "valid"),
    ], "current")).toEqual([{ domain: "valid.example.com", previouslyVerified: true }])
  })

  it("does not suggest conflicting provider identities for the same domain", () => {
    expect(getEmailDomainOptions([email("example.com", "a"), email("example.com", "b")])).toEqual([])
  })

  it("retains domains of inactive channels without copying their channel state", () => {
    const option = { ...email("example.com"), status: "disabled", metadata: {
      ...email("example.com").metadata, emailReceivingEnabled: true, emailChannelActive: false,
    } }
    expect(getEmailDomainOptions([option])).toEqual([{ domain: "example.com", previouslyVerified: true }])
  })

  it.each(["https://example.com", "example.com/path", "user@example.com", "-bad.example.com", "localhost", ""])(
    "rejects invalid hostname %s", (value) => expect(isValidEmailDomain(normalizeEmailDomain(value))).toBe(false),
  )
})