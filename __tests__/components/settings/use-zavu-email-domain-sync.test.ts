import { act, renderHook } from "@testing-library/react"
import { toast } from "sonner"

const getMock = jest.fn()
jest.mock("@/app/services/api-client-service", () => ({
  apiClient: { get: (...args: unknown[]) => getMock(...args) },
}))
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

import { useZavuEmailDomainSync } from "@/app/components/settings/use-zavu-email-domain-sync"

describe("useZavuEmailDomainSync", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
  })

  it("reconciles a pending domain with the authenticated site and channel", async () => {
    getMock.mockResolvedValue({
      success: true,
      data: { domain: { status: "verified", dnsRecords: [{ type: "CNAME" }] } },
    })
    const onDomainChange = jest.fn()

    renderHook(() => useZavuEmailDomainSync({
      siteId: "site 1",
      channelId: "channel/1",
      domainId: "domain/1",
      status: "pending",
      enabled: true,
      onDomainChange,
    }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(getMock).toHaveBeenCalledWith(
      "/api/integrations/zavu/email-domains/domain%2F1?siteId=site%201&channelId=channel%2F1"
    )
    expect(onDomainChange).toHaveBeenCalledWith({
      status: "verified",
      dnsRecords: [{ type: "CNAME" }],
    })
    expect(toast.success).toHaveBeenCalledWith("Email domain verified")
  })

  it("does not poll a terminal domain", async () => {
    renderHook(() => useZavuEmailDomainSync({
      siteId: "site_1",
      channelId: "channel_1",
      domainId: "domain_1",
      status: "verified",
      enabled: true,
      onDomainChange: jest.fn(),
    }))
    await act(async () => Promise.resolve())
    expect(getMock).not.toHaveBeenCalled()
  })

  it("ignores unknown statuses", async () => {
    getMock.mockResolvedValue({
      success: true,
      data: { domain: { status: "unexpected" } },
    })
    const onDomainChange = jest.fn()
    renderHook(() => useZavuEmailDomainSync({
      siteId: "site_1",
      channelId: "channel_1",
      domainId: "domain_1",
      status: "pending",
      enabled: true,
      onDomainChange,
    }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onDomainChange).not.toHaveBeenCalled()
  })
})