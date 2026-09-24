export const WEBHOOK_OPERATIONS = [
  { value: "created", label: "created" },
  { value: "updated", label: "updated" },
  { value: "deleted", label: "deleted" },
] as const

export const WEBHOOK_RESOURCES = [
  { table: "tasks", event: "task", label: "Task" },
  { table: "messages", event: "message", label: "Message" },
  { table: "leads", event: "lead", label: "Lead" },
  { table: "deals", event: "deal", label: "Deal" },
  { table: "conversations", event: "conversation", label: "Conversation" },
  { table: "quotations", event: "quotation", label: "Quotation" },
  { table: "reservations", event: "reservation", label: "Reservation" },
  { table: "content", event: "content", label: "Content" },
  { table: "sales", event: "sale", label: "Sale" },
] as const

export type WebhookOperation = (typeof WEBHOOK_OPERATIONS)[number]["value"]
export type WebhookResourceName = (typeof WEBHOOK_RESOURCES)[number]["event"]
export type WebhookEventType = `${WebhookResourceName}.${WebhookOperation}`

export interface WebhookEventOption {
  id: WebhookEventType
  label: string
  table: (typeof WEBHOOK_RESOURCES)[number]["table"]
}

export const WEBHOOK_EVENT_OPTIONS: readonly WebhookEventOption[] = WEBHOOK_RESOURCES.flatMap(
  (resource) =>
    WEBHOOK_OPERATIONS.map((operation) => ({
      id: `${resource.event}.${operation.value}` as WebhookEventType,
      label: `${resource.label} ${operation.label}`,
      table: resource.table,
    })),
)

export const WEBHOOK_TABLE_OPTIONS = WEBHOOK_RESOURCES.map(({ table, label }) => ({
  value: table,
  label,
}))

export type WebhookTestOperation = "INSERT" | "UPDATE" | "DELETE"

export function buildWebhookTestRequest(params: {
  endpointId: string
  siteId: string
  operation: WebhookTestOperation
  table: string
  record?: unknown
}) {
  return {
    endpoint_id: params.endpointId,
    site_id: params.siteId,
    operation: params.operation,
    table: params.table,
    record: params.record,
  }
}
