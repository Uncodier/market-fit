/** @jest-environment node */
import { readFileSync } from "node:fs"
import { createClient } from "@/lib/supabase/server"
import { userCanOnLocation } from "@/lib/permissions/location-access"
import { GET, POST } from "@/app/api/shipments/[id]/documents/route"
import { GET as download } from "@/app/api/shipments/[id]/documents/[documentId]/route"
import { assertPdfBytes, MAX_BODY_BYTES, MAX_PDF_BYTES, readMultipart, validatePdf } from "@/app/api/shipments/[id]/documents/helpers"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/permissions/location-access", () => ({ userCanOnLocation: jest.fn() }))
const id = "11111111-1111-4111-8111-111111111111"
const documentId = "22222222-2222-4222-8222-222222222222"
const userId = "33333333-3333-4333-8333-333333333333"
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n")
const context = { params: Promise.resolve({ id }) }
type QueryMock = Record<"select" | "eq" | "order" | "insert" | "single" | "maybeSingle", jest.Mock>
type StorageMock = Record<"upload" | "remove" | "download", jest.Mock>
let client: { auth: { getUser: jest.Mock }; from: jest.Mock; storage: { from: jest.Mock } }
let query: QueryMock
let storage: StorageMock
function uploadRequest(bytes = pdf, name = "carrier.pdf", type = "application/pdf") {
  const form = new FormData()
  form.set("file", new File([bytes], name, { type }))
  return new Request("http://localhost/api", { method: "POST", body: form })
}
beforeEach(() => {
  jest.clearAllMocks()
  query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
    insert: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: documentId }, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id, site_id: id, origin_location_id: null }, error: null }) }
  storage = { upload: jest.fn().mockResolvedValue({ error: null }), remove: jest.fn().mockResolvedValue({ error: null }),
    download: jest.fn().mockResolvedValue({ data: new Blob([pdf]), error: null }) }
  client = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: jest.fn().mockReturnValue(query), storage: { from: jest.fn().mockReturnValue(storage) } }
  jest.mocked(createClient).mockResolvedValue(client)
  jest.mocked(userCanOnLocation).mockResolvedValue(true)
})

it("authenticates every endpoint before storage access", async () => {
  client.auth.getUser.mockResolvedValue({ data: { user: null } })
  expect((await GET(new Request("http://localhost"), context)).status).toBe(401)
  expect((await POST(uploadRequest(), context)).status).toBe(401)
  expect((await download(new Request("http://localhost"), { params: Promise.resolve({ id, documentId }) })).status).toBe(401)
  expect(client.from).not.toHaveBeenCalled()
  expect(createClient).toHaveBeenCalledWith(true)
})
it("denies cross-tenant shipments and action/location permission failures", async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: null })
  expect((await GET(new Request("http://localhost"), context)).status).toBe(403)
  jest.mocked(userCanOnLocation).mockResolvedValue(false)
  expect((await POST(uploadRequest(), context)).status).toBe(403)
  expect(storage.upload).not.toHaveBeenCalled()
})
it("validates IDs", async () => {
  expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400)
  expect(client.from).not.toHaveBeenCalled()
})
it("lists only projected shipment metadata with no-store", async () => {
  const response = await GET(new Request("http://localhost"), context)
  expect(await response.json()).toEqual({ documents: [] })
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(query.eq).toHaveBeenCalledWith("shipment_id", id)
})
it("uploads a PDF with trusted actor and generated object path", async () => {
  const response = await POST(uploadRequest(), context)
  expect(response.status).toBe(201)
  expect(userCanOnLocation).toHaveBeenCalledWith(client, id, null, "update")
  expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ uploaded_by: userId, shipment_id: id, size_bytes: pdf.length }))
  expect(storage.upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${id}/${userId}/.+\\.pdf$`)), pdf, { contentType: "application/pdf", upsert: false })
})
it("compensates upload if metadata insertion fails", async () => {
  query.single.mockResolvedValue({ error: { message: "private details" } })
  const response = await POST(uploadRequest(), context)
  expect(response.status).toBe(500)
  expect(JSON.stringify(await response.json())).not.toContain("private details")
  expect(storage.remove).toHaveBeenCalled()
})
it.each([{ origin: "https://attacker.example" }, { "sec-fetch-site": "cross-site" }])("rejects cross-origin uploads %#", async headers => {
  const request = uploadRequest()
  for (const [key, value] of Object.entries(headers)) request.headers.set(key, value)
  expect((await POST(request, context)).status).toBe(403)
  expect(storage.upload).not.toHaveBeenCalled()
})
it("accepts explicitly same-origin uploads", async () => {
  const request = uploadRequest()
  request.headers.set("origin", "http://localhost")
  expect((await POST(request, context)).status).toBe(201)
})
it("rejects oversized downloads before reading bytes", async () => {
  const arrayBuffer = jest.fn()
  query.maybeSingle.mockResolvedValueOnce({ data: { site_id: id, origin_location_id: null } })
    .mockResolvedValueOnce({ data: { object_path: "x", file_name: "x.pdf", size_bytes: MAX_PDF_BYTES + 1 } })
  storage.download.mockResolvedValue({ data: { size: MAX_PDF_BYTES + 1, arrayBuffer } })
  expect((await download(new Request("http://localhost"), { params: Promise.resolve({ id, documentId }) })).status).toBe(415)
  expect(arrayBuffer).not.toHaveBeenCalled()
})
it.each([
  [Buffer.from("not a PDF"), "carrier.pdf", "application/pdf", 415],
  [pdf, "carrier.txt", "application/pdf", 415],
  [pdf, "carrier.pdf", "text/html", 415],
  [pdf, "../carrier.pdf", "application/pdf", 400],
])("rejects invalid upload %#", async (bytes, name, type, status) => {
  // Test original filename directly: multipart parsers may strip directory parts.
  const form = new FormData()
  form.set("file", new File([bytes], name, { type }))
  await expect(validatePdf(form)).rejects.toMatchObject({ status })
})
it("bounds declared and streamed upload sizes before parsing", async () => {
  await expect(readMultipart(new Request("http://localhost", { method: "POST", headers: {
    "content-type": "multipart/form-data; boundary=x", "content-length": String(MAX_BODY_BYTES + 1),
  }, body: "x" }))).rejects.toMatchObject({ status: 413 })
  const req = new Request("http://localhost", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: Buffer.alloc(MAX_BODY_BYTES + 1) })
  await expect(readMultipart(req)).rejects.toMatchObject({ status: 413 })
  expect(() => assertPdfBytes(Buffer.alloc(MAX_PDF_BYTES + 1))).toThrow()
})
it("rejects forged metadata fields", async () => {
  const form = new FormData()
  form.set("file", new File([pdf], "x.pdf", { type: "application/pdf" }))
  form.set("uploaded_by", userId)
  await expect(validatePdf(form)).rejects.toMatchObject({ status: 400 })
})
it.each(["attachment", "inline"])("downloads private PDF with %s disposition", async disposition => {
  query.maybeSingle.mockResolvedValueOnce({ data: { site_id: id, origin_location_id: null } })
    .mockResolvedValueOnce({ data: { object_path: "private/path.pdf", file_name: "carrier.pdf", size_bytes: pdf.length } })
  const response = await download(new Request(`http://localhost?disposition=${disposition}`), { params: Promise.resolve({ id, documentId }) })
  expect(response.status).toBe(200)
  expect(response.headers.get("content-disposition")).toMatch(new RegExp(`^${disposition};`))
  expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf)
  expect(query.eq).toHaveBeenCalledWith("id", documentId)
})
it("requires matching shipment/document and valid disposition", async () => {
  let response = await download(new Request("http://localhost?disposition=bad"), { params: Promise.resolve({ id, documentId }) })
  expect(response.status).toBe(400)
  query.maybeSingle.mockResolvedValueOnce({ data: { site_id: id, origin_location_id: null } }).mockResolvedValueOnce({ data: null })
  response = await download(new Request("http://localhost"), { params: Promise.resolve({ id, documentId }) })
  expect(response.status).toBe(404)
  expect(storage.download).not.toHaveBeenCalled()
})
it("migration locks down metadata and private storage independently", () => {
  const sql = readFileSync(`${process.cwd()}/supabase/migrations/20261109223000_shipment_carrier_documents.sql`, "utf8")
  expect(sql).toContain("ENABLE ROW LEVEL SECURITY")
  expect(sql).toContain("false, 10485760, ARRAY['application/pdf']")
  expect(sql).toContain("SECURITY INVOKER")
  expect(sql).not.toContain("SECURITY DEFINER")
  for (const action of ["SELECT", "INSERT", "UPDATE", "DELETE"]) expect(sql).toContain(`AS RESTRICTIVE FOR ${action}`)
  expect(sql).toContain("uploaded_by = auth.uid()")
  expect(sql).toContain("public.user_can_access_location(s.site_id, s.origin_location_id)")
})