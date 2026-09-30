import "server-only"
import { z } from "zod"
import { isOutstandMediaUrl } from "./outstand-media"

export class OutstandBoundaryError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = "OutstandBoundaryError"
  }
}

export const UNCONFIRMED_PUBLISH =
  "Publishing could not be confirmed. Check the post status before retrying."

export function outstandFailure(error: unknown, fallback: string): {
  success: false; error: string; status: number; data?: never
} {
  return {
    success: false,
    error: error instanceof OutstandBoundaryError ? error.message : fallback,
    status: error instanceof OutstandBoundaryError ? error.status : 502,
  }
}

export const siteIdSchema = z.string().uuid().transform(value => value.toLowerCase())
export const accountIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/)
const selector = z.string().min(1).max(256).refine(value =>
  value === value.trim() && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
const filename = z.string().min(1).max(255).refine(value =>
  !value.startsWith(".") && !/[\\/?#]/.test(value) &&
  !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))

const mediaSchema = z.object({
  id: z.union([accountIdSchema, z.number().int().nonnegative().safe()]).optional(),
  url: z.string().max(8192).refine(isOutstandMediaUrl),
  filename,
}).strict()

const publishSchema = z.object({
  tenant_id: siteIdSchema,
  containers: z.array(z.object({
    content: z.string().max(100_000),
    media: z.array(mediaSchema).max(20).default([]),
  }).strict().refine(container => container.content.trim().length > 0 || container.media.length > 0))
    .min(1).max(20),
  accounts: z.array(selector).min(1).max(100),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
}).strict()

export type OutstandPublishInput = {
  tenant_id: string
  containers: { content: string; media: unknown[] }[]
  accounts: string[]
  scheduledAt?: string
}

export function parseOutstandPublish(siteId: string, payload: unknown) {
  const parsed = publishSchema.safeParse(payload)
  if (!parsed.success) throw new OutstandBoundaryError(400, "Invalid social post payload.")
  if (parsed.data.tenant_id !== siteId) {
    throw new OutstandBoundaryError(403, "The social post does not belong to this site.")
  }
  if (Buffer.byteLength(JSON.stringify(parsed.data), "utf8") > 512_000) {
    throw new OutstandBoundaryError(413, "The social post payload is too large.")
  }
  return parsed.data
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function matchesOutstandSite(value: Record<string, unknown>, siteId: string): boolean {
  return ["tenant_id", "tenantId", "site_id", "siteId"].every(key =>
    !(key in value) || (typeof value[key] === "string" && value[key].toLowerCase() === siteId))
}