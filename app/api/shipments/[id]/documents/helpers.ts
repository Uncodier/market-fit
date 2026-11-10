import { createClient } from "@/lib/supabase/server"
import { userCanOnLocation } from "@/lib/permissions/location-access"

export const BUCKET = "shipment-carrier-documents"
export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const MAX_BODY_BYTES = MAX_PDF_BYTES + 64 * 1024
export const FIELDS = "id,shipment_id,file_name,mime_type,size_bytes,created_at,uploaded_by"
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export class DocumentError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } })
}
export function failure(error: unknown) {
  return error instanceof DocumentError
    ? json({ error: error.message }, error.status)
    : json({ error: "Unable to process shipment document" }, 500)
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new DocumentError(403, "Forbidden")
  }
}
export async function authorize(id: string, command: "select" | "update") {
  const client = await createClient(true)
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new DocumentError(401, "Unauthorized")
  if (!isUuid(id)) throw new DocumentError(400, "Invalid shipment ID")
  const { data: shipment, error: lookupError } = await client.from("shipments")
    .select("id,site_id,origin_location_id").eq("id", id).maybeSingle()
  if (lookupError) throw new DocumentError(500, "Unable to authorize shipment")
  if (!shipment || !await userCanOnLocation(client, shipment.site_id, shipment.origin_location_id, command)) {
    throw new DocumentError(403, "Forbidden")
  }
  return { client, user }
}

/** Bound streamed bodies too; Content-Length is not trusted as the only limit. */
export async function readMultipart(request: Request): Promise<FormData> {
  const type = request.headers.get("content-type") || ""
  if (!type.toLowerCase().startsWith("multipart/form-data;")) throw new DocumentError(415, "Expected multipart form data")
  const length = request.headers.get("content-length")
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new DocumentError(413, "Upload too large")
  if (!request.body) throw new DocumentError(400, "Missing file")
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new DocumentError(413, "Upload too large")
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData()
  } catch { throw new DocumentError(400, "Invalid multipart body") }
}

export async function validatePdf(form: FormData) {
  const entries = Array.from(form.entries())
  const file = form.get("file")
  if (entries.length !== 1 || !file || typeof file === "string") throw new DocumentError(400, "Provide one file field")
  if (file.size > MAX_PDF_BYTES) throw new DocumentError(413, "PDF must be at most 10 MiB")
  if (file.type !== "application/pdf" || !/\.pdf$/i.test(file.name)) throw new DocumentError(415, "Only PDF files are supported")
  if (!file.name || file.name.length > 180 || /[\x00-\x1f\x7f/\\]/.test(file.name)) throw new DocumentError(400, "Invalid file name")
  const bytes = Buffer.from(await file.arrayBuffer())
  assertPdfBytes(bytes)
  return { file, bytes }
}
export function assertPdfBytes(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes)
  if (buffer.length < 16 || buffer.length > MAX_PDF_BYTES ||
      !/^%PDF-(1\.[0-7]|2\.0)[\r\n]/.test(buffer.subarray(0, 12).toString("ascii")) ||
      !/%%EOF\s*$/.test(buffer.subarray(-1024).toString("ascii"))) {
    throw new DocumentError(415, "Invalid PDF content")
  }
}