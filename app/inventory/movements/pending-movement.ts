type MovementCommon = {
  siteId: string
  requestId: string
  fromLocationId: string
  toLocationId: string
  notes?: string
  receivingUserId?: string
}
export type MovementItem = { catalogItemId: string; quantity: number }
export type PendingMovement = MovementCommon & ((MovementItem | { items: MovementItem[] }) & { workflow?: undefined; status?: undefined } | { items: MovementItem[]; workflow: "transfer_order"; status: "draft" | "requested" })

const validId = (value: unknown) => typeof value === "string" && value.trim().length > 0 && value.length <= 100
const validItem = (value: unknown): value is MovementItem => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const item = value as MovementItem
  return validId(item.catalogItemId) && typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 1_000_000_000
}

export function movementItems(input: PendingMovement): MovementItem[] {
  return "items" in input ? input.items : [{ catalogItemId: input.catalogItemId, quantity: input.quantity }]
}

export function pendingMovementKey(actorId: string, siteId: string) {
  return `inventory:pending-movement:v1:${actorId}:${siteId}`
}

// Storage failure blocks admission: an uncertain mutation must survive a reload.
export function readPendingMovement(key: string, siteId: string): PendingMovement | null {
  const raw = sessionStorage.getItem(key)
  if (!raw) return null
  const value = JSON.parse(raw) as PendingMovement
  const batch = value && typeof value === "object" && "items" in value
  const workflow = value && value.workflow === "transfer_order"
  const fields = ["siteId", "requestId", "fromLocationId", "toLocationId", "notes", "receivingUserId", ...(workflow ? ["workflow", "status"] : []), ...(batch ? ["items"] : ["catalogItemId", "quantity"])]
  if (!value || typeof value !== "object" || Array.isArray(value) || value.siteId !== siteId || ![value.siteId, value.requestId, value.fromLocationId, value.toLocationId].every(validId)
    || (batch ? !("items" in value) || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 100 || !value.items.every(item => validItem(item) && Object.keys(item).every(field => ["catalogItemId", "quantity"].includes(field))) : !validItem(value))
    || (workflow && (!batch || !["draft", "requested"].includes(value.status!)))
    || value.fromLocationId.toLowerCase() === value.toLocationId.toLowerCase()
    || Object.keys(value).some(field => !fields.includes(field))
    || (value.receivingUserId !== undefined && !validId(value.receivingUserId))
    || (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.length > 1000))) {
    throw new Error("Invalid pending movement")
  }
  return value
}

export function writePendingMovement(key: string, input: PendingMovement) {
  const payload = JSON.stringify(input)
  sessionStorage.setItem(key, payload)
  if (sessionStorage.getItem(key) !== payload) throw new Error("Pending movement could not be saved")
}

export function clearPendingMovement(key: string) {
  sessionStorage.removeItem(key)
  if (sessionStorage.getItem(key) !== null) throw new Error("Pending movement could not be cleared")
}