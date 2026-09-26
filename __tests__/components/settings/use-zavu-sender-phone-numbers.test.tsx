import { act, renderHook, waitFor } from "@testing-library/react"
import { apiClient } from "@/app/services/api-client-service"
import { matchSenderPhoneNumbers, useZavuSenderPhoneNumbers } from "@/app/components/settings/use-zavu-sender-phone-numbers"

let currentSiteId = "site-1"
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: currentSiteId } }) }))

describe("sender phone-number lookup", () => {
  afterEach(() => jest.restoreAllMocks())

  it("uses only a uniquely matching sender or phone ID; never guesses from an unrelated number", () => {
    const connections = [
      { zavu_sender_id: "sender-a", metadata: { phone_number_id: "number-1" } },
      { zavu_sender_id: "sender-b" },
      { zavu_sender_id: "sender-c", metadata: { phone_number_id: "number-3" } },
    ]
    expect(matchSenderPhoneNumbers(connections, [
      { id: "number-1", phoneNumber: "+14155550100", senderId: "sender-a" },
      { id: "number-2", phoneNumber: "+14155550200", senderId: "sender-b" },
      { id: "number-3", phoneNumber: "+14155550300", senderId: "sender-other" },
      { id: "number-4", phoneNumber: "+14155550400" },
    ])).toEqual({ "sender-a": "+14155550100", "sender-b": "+14155550200" })
    expect(matchSenderPhoneNumbers([
      { zavu_sender_id: "sender-a", metadata: { phone_number_id: "number-1" } },
    ], [
      { id: "number-1", phoneNumber: "+14155550100" },
      { id: "number-1", phoneNumber: "+14155550500" },
    ])).toEqual({})
    expect(matchSenderPhoneNumbers([
      { zavu_sender_id: "shared", metadata: { phone_number_id: "number-1" } },
      { zavu_sender_id: "shared", metadata: { phone_number_id: "number-2" } },
    ], [
      { id: "number-1", phoneNumber: "+14155550100", senderId: "shared" },
      { id: "number-2", phoneNumber: "+14155550200", senderId: "shared" },
    ])).toEqual({})
  })

  it("labels a missing number using only a uniquely assigned number from the existing site endpoint", async () => {
    currentSiteId = "site-1"
    jest.spyOn(apiClient, "get").mockResolvedValue({ success: true, data: [{ id: "number-1", phoneNumber: "+14155550100", senderId: "sender-a" }] })
    const { result } = renderHook(() => useZavuSenderPhoneNumbers({
      connections: [{ status: "connected", type: "whatsapp", zavu_sender_id: "sender-a" }],
      enabled: true,
    }))
    await waitFor(() => expect(result.current).toEqual({ "sender-a": "+14155550100" }))
  })

  it("looks up numbers for active and synced connections too", async () => {
    currentSiteId = "site-1"
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({ success: true, data: [{ id: "number-1", phoneNumber: "+14155550100", senderId: "sender-a" }] })
    const { result } = renderHook(() => useZavuSenderPhoneNumbers({
      connections: [{ status: "active", type: "voice", zavu_sender_id: "sender-a" }],
      enabled: true,
    }))
    await waitFor(() => expect(result.current).toEqual({ "sender-a": "+14155550100" }))
    expect(get).toHaveBeenCalledTimes(1)
  })

  it("uses the existing site-scoped GET once even when no sender number matches", async () => {
    currentSiteId = "site-1"
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({ success: true, data: [{ id: "unrelated", phoneNumber: "+14155550000" }] })
    const connections = [{ status: "connected", type: "voice", zavu_sender_id: "sender-a" }]
    const { result, rerender } = renderHook(({ items }) => useZavuSenderPhoneNumbers({ connections: items, enabled: true }), {
      initialProps: { items: connections },
    })
    await waitFor(() => expect(get).toHaveBeenCalledWith("/api/integrations/zavu/phone-numbers?siteId=site-1"))
    await act(async () => { await Promise.resolve() })
    rerender({ items: [{ ...connections[0] }] })
    await act(async () => { await Promise.resolve() })
    expect(get).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({})
  })
})