const uuid = { type: "string", format: "uuid" }
const quantity = { type: "number", exclusiveMinimum: 0, maximum: 1_000_000_000 }
const notes = { type: "string", maxLength: 1000 }
export const inventoryTransferTool = {
  type: "function",
  function: {
    name: "inventory_transfer_order",
    description: "Create a draft/requested transfer without changing stock, then approve, dispatch, receive incrementally or reconcile returns/writeoffs. Approval requires a manager; receiving requires assigned receiver or manager. Cancel only before dispatch. Differences require explicit quantities and reasons. Retain identical requestId/input after uncertain results; use the current order revision. Do not infer receipt from dispatch.",
    parameters: {
      type: "object", additionalProperties: false, required: ["operation", "input"],
      properties: { operation: { enum: ["create", "transition"] }, input: { type: "object" } },
      oneOf: [
        { properties: { operation: { const: "create" }, input: { type: "object", additionalProperties: false,
          required: ["siteId", "requestId", "fromLocationId", "toLocationId", "status", "items"],
          properties: { siteId: uuid, requestId: uuid, fromLocationId: uuid, toLocationId: uuid, receivingUserId: uuid,
            notes, status: { enum: ["draft", "requested"] }, items: { type: "array", minItems: 1, maxItems: 100,
              items: { type: "object", additionalProperties: false, required: ["catalogItemId", "quantity"], properties: { catalogItemId: uuid, quantity } } } },
        } } },
        { properties: { operation: { const: "transition" }, input: { type: "object", additionalProperties: false,
          required: ["siteId", "orderId", "requestId", "action", "revision"],
          properties: { siteId: uuid, orderId: uuid, requestId: uuid, revision: { type: "integer", minimum: 0 },
            action: { enum: ["request", "approve", "cancel", "dispatch", "receive", "reconcile"] }, notes,
            lines: { type: "array", minItems: 1, maxItems: 100, items: { type: "object", additionalProperties: false,
              required: ["lineId"], properties: { lineId: uuid, quantity, notes,
                returnedQuantity: { type: "number", minimum: 0, maximum: 1_000_000_000 },
                writtenOffQuantity: { type: "number", minimum: 0, maximum: 1_000_000_000 } } } } },
        } } },
      ],
    },
  },
  transport: { method: "POST", path: "/api/inventory/transfers", maxBodyBytes: 131_072 },
} as const