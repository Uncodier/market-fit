import { addDnsRecords } from "@/app/lib/integrations/cloudflare/cloudflare-service"
import {
  ZAVU_INBOUND_MX_HOST,
  ZAVU_INBOUND_MX_PRIORITY,
} from "@/lib/zavu-email-dns"

const successResponse = (result: unknown): Response => ({
  ok: true,
  json: async () => ({ success: true, result }),
}) as Response

describe("Cloudflare inbound MX sync", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("creates the current inbound MX before deleting a known SES conflict", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(successResponse([
        {
          id: "legacy-mx",
          content: "feedback-smtp.us-east-1.amazonses.com",
          priority: 10,
        },
      ]))
      .mockResolvedValueOnce(successResponse({ id: "current-mx" }))
      .mockResolvedValueOnce(successResponse({ id: "legacy-mx" }))

    const results = await addDnsRecords(
      "zone-id",
      [{
        type: "MX",
        name: "mail.example.com",
        content: ZAVU_INBOUND_MX_HOST,
        priority: ZAVU_INBOUND_MX_PRIORITY,
      }],
      "token",
      { replaceConflictingInboundMx: true }
    )

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.cloudflare.com/client/v4/zones/zone-id/dns_records",
      expect.objectContaining({ method: "POST" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.cloudflare.com/client/v4/zones/zone-id/dns_records/legacy-mx",
      expect.objectContaining({ method: "DELETE" })
    )
    expect(results).toContainEqual(expect.objectContaining({
      deleted: true,
      previousContent: "feedback-smtp.us-east-1.amazonses.com",
    }))
  })

  it("refuses to delete an unrelated MX provider", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(successResponse([
        {
          id: "google-mx",
          content: "aspmx.l.google.com",
          priority: 10,
        },
      ]))

    await expect(addDnsRecords(
      "zone-id",
      [{
        type: "MX",
        name: "mail.example.com",
        content: ZAVU_INBOUND_MX_HOST,
        priority: ZAVU_INBOUND_MX_PRIORITY,
      }],
      "token",
      { replaceConflictingInboundMx: true }
    )).rejects.toThrow("Use a separate inbound subdomain")

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
