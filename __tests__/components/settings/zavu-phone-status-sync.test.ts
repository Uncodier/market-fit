import { act, renderHook } from "@testing-library/react"

const getMock = jest.fn()
let mockSiteId: string | undefined = "site with spaces"

jest.mock("@/app/services/api-client-service", () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: mockSiteId ? { id: mockSiteId } : null }),
}))

import {
  applyRegulatoryStatuses,
  useZavuPhoneStatusSync,
} from "@/app/components/settings/use-zavu-phone-status-sync"

describe("applyRegulatoryStatuses", () => {
  const pendingConnection = {
    type: "sms",
    status: "in_progress",
    zavu_sender_id: "snd_1",
    metadata: {
      phone_number_id: "pn_1",
      phone_number: "+14155550100",
      regulatory_status: "pending_review",
    },
  }

  it("connects a channel after regulatory approval", () => {
    const result = applyRegulatoryStatuses([pendingConnection], [{
      id: "pn_1",
      phoneNumber: "+14155550100",
      regulatoryStatus: "approved",
    }])

    expect(result.changed).toBe(true)
    expect(result.connections[0]).toMatchObject({
      status: "connected",
      metadata: { regulatory_status: "approved" },
    })
  })

  it("marks a rejected regulatory review as failed", () => {
    const result = applyRegulatoryStatuses([pendingConnection], [{
      id: "pn_1",
      phoneNumber: "+14155550100",
      regulatoryStatus: "rejected",
    }])

    expect(result.changed).toBe(true)
    expect(result.connections[0]).toMatchObject({
      status: "failed",
      metadata: {
        regulatory_status: "rejected",
        failure_reason: "Phone number regulatory review was rejected.",
      },
    })
  })

  it("does not mark Voice connected while remote activation is incomplete", () => {
    const result = applyRegulatoryStatuses([{
      ...pendingConnection,
      type: "voice",
      metadata: {
        ...pendingConnection.metadata,
        activation_pending: true,
      },
    }], [{
      id: "pn_1",
      phoneNumber: "+14155550100",
      regulatoryStatus: "approved",
    }])

    expect(result.changed).toBe(true)
    expect(result.connections[0]).toMatchObject({
      status: "in_progress",
      metadata: {
        regulatory_status: "approved",
        activation_pending: true,
      },
    })

    const repeated = applyRegulatoryStatuses(result.connections, [{
      id: "pn_1",
      phoneNumber: "+14155550100",
      regulatoryStatus: "approved",
    }])
    expect(repeated.changed).toBe(false)
    expect(repeated.connections[0]).toBe(result.connections[0])
  })

  it("leaves unrelated connections unchanged", () => {
    const result = applyRegulatoryStatuses([pendingConnection], [{
      id: "pn_other",
      phoneNumber: "+14155550999",
      regulatoryStatus: "approved",
    }])

    expect(result.changed).toBe(false)
    expect(result.connections[0]).toBe(pendingConnection)
  })
})

describe("useZavuPhoneStatusSync", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSiteId = "site with spaces"
    getMock.mockResolvedValue({ success: true, data: { items: [] } })
  })

  it("scopes pending-review polling to the current site", async () => {
    renderHook(() =>
      useZavuPhoneStatusSync({
        connections: [{
          status: "in_progress",
          metadata: { phone_number_id: "pn_1" },
        }],
        enabled: true,
        onConnectionsChange: jest.fn(),
      })
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(getMock).toHaveBeenCalledWith(
      "/api/integrations/zavu/phone-numbers?siteId=site%20with%20spaces"
    )
  })

  it("does not restart polling after persisting an idempotent status update", async () => {
    getMock.mockResolvedValue({
      success: true,
      data: {
        items: [{
          id: "pn_1",
          phoneNumber: "+14155550100",
          regulatoryStatus: "approved",
        }],
      },
    })
    const onConnectionsChange = jest.fn()
    const initialConnections = [{
      status: "in_progress",
      metadata: {
        phone_number_id: "pn_1",
        regulatory_status: "pending_review",
        activation_pending: true,
      },
    }]
    const { rerender } = renderHook(
      ({ connections }) => useZavuPhoneStatusSync({
        connections,
        enabled: true,
        onConnectionsChange,
      }),
      { initialProps: { connections: initialConnections } },
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const persistedConnections = onConnectionsChange.mock.calls[0][0]
    rerender({ connections: persistedConnections })
    await act(async () => {
      await Promise.resolve()
    })

    expect(getMock).toHaveBeenCalledTimes(1)
    expect(onConnectionsChange).toHaveBeenCalledTimes(1)
  })

  it("does not poll without a site ID", async () => {
    mockSiteId = undefined
    renderHook(() =>
      useZavuPhoneStatusSync({
        connections: [{
          status: "in_progress",
          metadata: { phone_number_id: "pn_1" },
        }],
        enabled: true,
        onConnectionsChange: jest.fn(),
      })
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(getMock).not.toHaveBeenCalled()
  })
})
