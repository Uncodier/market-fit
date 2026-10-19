import { z } from "zod"

const id = z.string().uuid()
const money = z.number().finite().min(0).max(999999999).refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
  "Use at most two decimal places",
)
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
})

export const registerDashboardSchema = z.object({
  siteId: id, locationId: id, from: day.optional(), to: day.optional(),
  page: z.number().int().min(0).max(10000).default(0),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to)

export const registerSessionSchema = z.object({ siteId: id, sessionId: id }).strict()
export const registerPaymentScopeSchema = z.object({ siteId: id, locationId: id.optional() }).strict()
export const registerOpenSchema = z.object({
  siteId: id, locationId: id, currency: z.string().regex(/^[A-Z]{3}$/),
  openingAmount: money, requestId: id,
}).strict()
export const registerMoveSchema = registerSessionSchema.extend({
  kind: z.enum(["cash_in", "cash_out", "cash_refund"]),
  amount: money.refine((value) => value > 0), reason: z.string().trim().min(1).max(500),
  requestId: id,
})
export const registerCloseSchema = registerSessionSchema.extend({
  countedAmount: money, notes: z.string().trim().max(2000), requestId: id,
})

export function registerError(error: { code?: string; message?: string }): string {
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code || "")) {
    return "Cash Register is unavailable. The database migration must be installed."
  }
  if (error.code === "23505") return "This register already has an open shift, or the request was already recorded. Refresh and try again."
  if (error.code === "42501") return "You do not have permission to use this register."
  if (error.code === "P0001") return "The register changed or the operation is invalid. Refresh the register and try again."
  return "Unable to load or update the register. Please try again."
}