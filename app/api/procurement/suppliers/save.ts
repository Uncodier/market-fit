import { NextResponse } from "next/server"
import { supplierInputSchema } from "@/app/suppliers/schema"
import { privateHeaders, procurementError } from "../http"
import { supplierAccess } from "./access"

export async function saveSupplier(request: Request, id: string | null) {
  const access = await supplierAccess(request, id ? "update" : "insert")
  if (access.error) return access.error
  // Limit the streamed body even when Content-Length is absent or dishonest.
  const reader = request.body?.getReader()
  if (!reader) return procurementError("A supplier document is required", 400)
  let size = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const part = await reader.read()
    if (part.done) break
    size += part.value.length
    if (size > 131072) { await reader.cancel(); return procurementError("Supplier document is too large", 413) }
    chunks.push(part.value)
  }
  let body: unknown
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch {
    return procurementError("Invalid JSON document", 400)
  }
  const parsed = supplierInputSchema.safeParse(body)
  if (!parsed.success || (!id && (parsed.data.expected_version !== 0 || parsed.data.status !== "prospect"))) {
    return procurementError("Invalid supplier document", 400)
  }
  const { expected_version, ...document } = parsed.data
  const { data, error } = await access.supabase.rpc("save_procurement_supplier", {
    p_site_id: access.siteId, p_id: id, p_expected_version: expected_version, p_document: document,
  })
  if (error) {
    if (error.code === "40001") return procurementError("Supplier changed. Reload before saving again.", 409)
    if (error.code === "42501") return procurementError("Forbidden", 403)
    if (["22023", "23503", "23514", "23505", "22P02"].includes(error.code)) {
      return procurementError("Invalid supplier or workspace reference", 400)
    }
    return procurementError("Unable to save supplier", 503)
  }
  if (!data || typeof data.id !== "string" || data.site_id !== access.siteId || data.version !== expected_version + 1) {
    return procurementError("Supplier save could not be confirmed. Reload before retrying.", 503)
  }
  return NextResponse.json({ supplier: data }, { status: id ? 200 : 201, headers: privateHeaders })
}