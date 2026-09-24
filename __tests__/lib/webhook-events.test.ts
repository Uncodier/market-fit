import {
  buildWebhookTestRequest,
  WEBHOOK_EVENT_OPTIONS,
  WEBHOOK_OPERATIONS,
  WEBHOOK_RESOURCES,
  WEBHOOK_TABLE_OPTIONS,
} from "@/lib/webhook-events"

describe("webhook event catalog", () => {
  it("exposes every operation for every supported resource", () => {
    expect(WEBHOOK_EVENT_OPTIONS).toHaveLength(
      WEBHOOK_RESOURCES.length * WEBHOOK_OPERATIONS.length,
    )

    for (const resource of WEBHOOK_RESOURCES) {
      for (const operation of WEBHOOK_OPERATIONS) {
        expect(WEBHOOK_EVENT_OPTIONS).toContainEqual({
          id: `${resource.event}.${operation.value}`,
          label: `${resource.label} ${operation.label}`,
          table: resource.table,
        })
      }
    }
  })

  it("keeps the test-table selector aligned with subscription resources", () => {
    expect(WEBHOOK_TABLE_OPTIONS.map((option) => option.value)).toEqual(
      WEBHOOK_RESOURCES.map((resource) => resource.table),
    )
  })

  it("includes the selected record in webhook test requests", () => {
    const record = { id: "deal-1", site_id: "site-1" }

    expect(buildWebhookTestRequest({
      endpointId: "endpoint-1",
      siteId: "site-1",
      operation: "DELETE",
      table: "deals",
      record,
    })).toEqual({
      endpoint_id: "endpoint-1",
      site_id: "site-1",
      operation: "DELETE",
      table: "deals",
      record,
    })
  })
})
