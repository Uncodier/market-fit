/** Local manifest: transport accepts a delegated Supabase user JWT or cookie session. External registration is separate. */
import { inventoryTransferTool } from "./transfer-assistant-tool"

const uuid = { type: "string", format: "uuid" } as const
const notes = { type: "string", maxLength: 1000 } as const
const operation = (kind: string, required: string[], properties: Record<string, unknown>) => ({
  type: "object", additionalProperties: false,
  required: ["kind", ...required], properties: { kind: { const: kind }, ...properties },
})

export const inventoryAssistantTools = [
  inventoryTransferTool,
  {
    type: "function",
    function: {
      name: "inventory_bulk",
      description: "Apply 1–100 inventory transfers, signed-delta adjustments or legacy full bill receipts atomically. Bulk receipts cannot receive a partially received bill; use inventory_receive_bill for incremental bill-line quantities and receiving person. Confirm intent and locations first. Reuse the same requestId and identical operations on an uncertain retry; never generate a new ID for that retry. Full receipts use server-owned bill quantities.",
      parameters: {
        type: "object", additionalProperties: false, required: ["siteId", "requestId", "operations"],
        properties: {
          siteId: uuid, requestId: uuid,
          operations: {
            type: "array", minItems: 1, maxItems: 100,
            items: { oneOf: [
              operation("transfer", ["catalogItemId", "fromLocationId", "toLocationId", "quantity"], {
                catalogItemId: uuid, fromLocationId: uuid, toLocationId: uuid, receivingUserId: uuid,
                quantity: { type: "number", exclusiveMinimum: 0, maximum: 1_000_000_000 }, notes,
              }),
              operation("adjustment", ["catalogItemId", "toLocationId", "quantity"], {
                catalogItemId: uuid, toLocationId: uuid,
                quantity: { type: "number", minimum: -1_000_000_000, maximum: 1_000_000_000, not: { const: 0 } }, notes,
              }),
              operation("receipt", ["purchaseId", "toLocationId"], { purchaseId: uuid, toLocationId: uuid }),
            ] },
          },
        },
      },
    },
    transport: { method: "POST", path: "/api/inventory/bulk", maxBodyBytes: 131_072, authentication: "delegated-supabase-user-jwt-or-cookie" },
  },
  {
    type: "function",
    function: {
      name: "inventory_receive_bill",
      description: "Receive actual incremental quantities per bill product line into an authorized active destination. Require the receiving person's user ID and confirm quantities, receiver and destination first. Use purchaseItemId, not catalog item IDs. Omit zero quantities; quantities cannot exceed server-owned remaining amounts. Reuse requestId and identical input on uncertain retries. Repeat with a new request only after confirmed success for subsequent deliveries.",
      parameters: {
        type: "object", additionalProperties: false,
        required: ["siteId", "requestId", "purchaseId", "toLocationId", "receivingUserId", "lines"],
        properties: { siteId: uuid, requestId: uuid, purchaseId: uuid, toLocationId: uuid, receivingUserId: uuid,
          lines: { type: "array", minItems: 1, maxItems: 100, items: {
            type: "object", additionalProperties: false, required: ["purchaseItemId", "quantity"],
            properties: { purchaseItemId: uuid, quantity: { type: "number", exclusiveMinimum: 0, maximum: 1_000_000_000 } },
          } },
        },
      },
    },
    transport: { method: "POST", path: "/api/inventory/receive-bill", maxBodyBytes: 131_072, authentication: "delegated-supabase-user-jwt-or-cookie" },
  },
] as const