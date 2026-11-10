import { assertPdfBytes, authorize, BUCKET, DocumentError, failure, isUuid, MAX_PDF_BYTES } from "../helpers"

export const runtime = "nodejs"
type Context = { params: Promise<{ id: string; documentId: string }> }

export async function GET(request: Request, context: Context) {
  try {
    const { id, documentId } = await context.params
    const { client } = await authorize(id, "select")
    if (!isUuid(documentId)) throw new DocumentError(400, "Invalid document ID")
    const query = new URL(request.url).searchParams
    const disposition = query.get("disposition") || "attachment"
    if (!["attachment", "inline"].includes(disposition) || query.getAll("disposition").length > 1) throw new DocumentError(400, "Invalid disposition")
    const { data, error } = await client.from("shipment_documents").select("object_path,file_name,size_bytes")
      .eq("shipment_id", id).eq("id", documentId).maybeSingle()
    if (error) throw error
    if (!data) throw new DocumentError(404, "Document not found")
    const { data: blob, error: downloadError } = await client.storage.from(BUCKET).download(data.object_path)
    if (downloadError || !blob) throw new DocumentError(404, "Document unavailable")
    if (blob.size > MAX_PDF_BYTES || blob.size < 16 || blob.size !== data.size_bytes) throw new DocumentError(415, "Invalid PDF content")
    const bytes = Buffer.from(await blob.arrayBuffer())
    assertPdfBytes(bytes)
    return new Response(bytes, { headers: {
      "Content-Type": "application/pdf", "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename="carrier-document.pdf"; filename*=UTF-8''${encodeURIComponent(data.file_name).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'", "Referrer-Policy": "no-referrer",
    } })
  } catch (error) { return failure(error) }
}