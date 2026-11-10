import { randomUUID } from "node:crypto"
import { assertSameOrigin, authorize, BUCKET, failure, FIELDS, json, readMultipart, validatePdf } from "./helpers"

export const runtime = "nodejs"
type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params
    const { client } = await authorize(id, "select")
    const { data, error } = await client.from("shipment_documents").select(FIELDS)
      .eq("shipment_id", id).order("created_at", { ascending: false })
    if (error) throw error
    return json({ documents: data || [] })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params
    const { client, user } = await authorize(id, "update")
    assertSameOrigin(request)
    const { file, bytes } = await validatePdf(await readMultipart(request))
    const documentId = randomUUID()
    const path = `${id.toLowerCase()}/${user.id}/${documentId}.pdf`
    const bucket = client.storage.from(BUCKET)
    const { error: uploadError } = await bucket.upload(path, bytes, { contentType: "application/pdf", upsert: false })
    if (uploadError) throw uploadError
    const { data, error } = await client.from("shipment_documents").insert({
      id: documentId, shipment_id: id, uploaded_by: user.id, object_path: path,
      file_name: file.name, mime_type: "application/pdf", size_bytes: bytes.length,
    }).select(FIELDS).single()
    if (error) {
      await bucket.remove([path])
      throw error
    }
    return json({ document: data }, 201)
  } catch (error) { return failure(error) }
}