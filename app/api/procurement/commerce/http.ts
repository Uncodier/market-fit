import { NextResponse } from "next/server"
import { procurementAccess, procurementError, privateHeaders } from "../http"
import { isProcurementRequestOrigin } from '../request-origin'

export { procurementAccess, procurementError, privateHeaders }

export function commerceWriteAccess(request: Request) {
  return isProcurementRequestOrigin(request) ? null : procurementError('Origin not allowed', 403)
}

export async function commerceBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return null
  if (Number(request.headers.get("content-length")) > 32768) return null
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 32768) { await reader.cancel(); return null }
      chunks.push(value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch { return null }
}

export function commerceResult(data: unknown, error: { code?: string; message?: string } | null) {
  if (error) {
    if (error.code === '22023' && error.message === 'Quotation catalog mapping and taxes must be resolved before ordering') {
      return procurementError('Quotation catalog mapping and taxes must be resolved before ordering', 422)
    }
    const status = error.code === "42501" ? 403 : ["40001", "23505"].includes(error.code ?? "") ? 409
      : ["22023", "23514", "23503", "22P02"].includes(error.code ?? "") ? 422 : 503
    return procurementError(status === 403 ? "Procurement access denied" : status === 409
      ? "The document changed. Refresh before retrying."
      : "The operation could not be completed. Check eligibility, publication, quantities and current approvals.", status)
  }
  return NextResponse.json({ data }, { headers: privateHeaders })
}