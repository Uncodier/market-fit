import { z } from 'zod'

export const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024
export const EVIDENCE_BUCKET = 'procurement-credentials'
export const evidenceMime = z.enum(['application/pdf', 'image/png', 'image/jpeg'])
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}, 'Invalid date')
export const credentialMetadata = z.object({
  holder_kind: z.literal('person'), holder_name: z.string().trim().min(1).max(200),
  type: z.string().trim().regex(/^[a-z][a-z0-9_-]{1,79}$/),
  title: z.string().trim().min(1).max(200), issuer: z.string().trim().min(1).max(200),
  reference: z.string().trim().max(200), scope: z.string().trim().max(2000),
  issued_on: date.nullable(), expires_on: date.nullable(), non_expiring: z.boolean(),
}).strict().superRefine((value, ctx) => {
  if (value.non_expiring && value.expires_on) ctx.addIssue({ code: 'custom', message: 'Non-expiring evidence cannot have an expiry date' })
  if (value.issued_on && value.expires_on && value.expires_on < value.issued_on) ctx.addIssue({ code: 'custom', message: 'Expiry must follow issue date' })
})
export const uploadMetadata = z.object({
  credential_id: z.string().uuid().nullable(), expected_version: z.number().int().min(0),
  metadata: credentialMetadata,
}).strict()
export type CredentialMetadata = z.infer<typeof credentialMetadata>
export type CredentialRevision = { id: string; credential_id: string; revision: number; metadata: CredentialMetadata;
  original_name: string; mime_type: string; byte_size: number; created_at: string; state: 'pending' | 'ready' }
export type Credential = { id: string; version: number; archived_at: string | null; revisions: CredentialRevision[] }

export function matchesEvidenceSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  if (mime === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)
  return mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
}