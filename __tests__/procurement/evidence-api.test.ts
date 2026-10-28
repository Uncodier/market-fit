/** @jest-environment node */
import { createClient } from '@/lib/supabase/server'
import { GET, POST } from '@/app/api/procurement/credentials/route'
import { DELETE } from '@/app/api/procurement/credentials/[id]/route'
import { GET as download } from '@/app/api/procurement/credentials/revisions/[id]/file/route'
import { credentialMetadata, matchesEvidenceSignature } from '@/app/purchases/procurement/evidence/schema'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const create = jest.mocked(createClient)
const id = '00000000-0000-4000-8000-000000000001'
const context = { params: Promise.resolve({ id }) }
const metadata = { holder_kind: 'person', holder_name: 'Holder', title: 'License', type: 'professional_license', issuer: 'Issuer',
  reference: '', scope: '', issued_on: null, expires_on: null, non_expiring: false }
let rpc: jest.Mock; let upload: jest.Mock; let query: Record<string, jest.Mock>; let from: jest.Mock
function uploadRequest(content = '%PDF-content', changes = {}, mime = 'application/pdf') {
  const form = new FormData()
  form.set('metadata', JSON.stringify({ credential_id: null, expected_version: 0, metadata, ...changes }))
  form.set('file', new Blob([content], { type: mime }), 'license.pdf')
  return new Request('http://localhost/api/procurement/credentials', { method: 'POST', body: form, headers: { origin: 'http://localhost' } })
}
beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockResolvedValue({ data: { credential_id: id, revision_id: id, object_path: 'server/opaque/path', version: 1 }, error: null })
  upload = jest.fn().mockResolvedValue({ error: null })
  query = {}
  for (const method of ['select', 'eq', 'order', 'limit']) query[method] = jest.fn(() => query)
  query.then = jest.fn(resolve => Promise.resolve({ data: [], error: null }).then(resolve))
  query.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
  from = jest.fn(() => query)
  create.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, rpc, from,
    storage: { from: () => ({ upload }) } } as never)
})
test('requires real authentication for list/upload/archive/download without workspace membership', async () => {
  create.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  expect((await GET(new Request('http://localhost/api/procurement/credentials'))).status).toBe(401)
  expect((await POST(uploadRequest())).status).toBe(401)
  expect((await DELETE(new Request('http://localhost/api/procurement/credentials', { method: 'DELETE' }), context)).status).toBe(401)
  expect((await download(new Request('http://localhost/api/procurement/credentials'), context)).status).toBe(401)
  expect(rpc).not.toHaveBeenCalled()
})
test('cross-origin multipart upload is denied before authentication/storage', async () => {
  const request = uploadRequest(); request.headers.set('origin', 'https://attacker.test')
  expect((await POST(request)).status).toBe(403)
  expect(create).not.toHaveBeenCalled()
})
test('demo, client holder authority, file mismatch and oversized declared bodies fail closed', async () => {
  const demo = uploadRequest(); demo.headers.set('cookie', 'market_fit_demo_site_id=demo-1')
  expect((await POST(demo)).status).toBe(403)
  expect((await POST(uploadRequest('not pdf'))).status).toBe(400)
  expect((await POST(uploadRequest('%PDF-content', { metadata: { ...metadata, holder_kind: 'organization', holder_id: id } }))).status).toBe(400)
  const large = uploadRequest(); large.headers.set('content-length', '9000000')
  expect((await POST(large)).status).toBe(413)
  expect(upload).not.toHaveBeenCalled()
})
test('server-generated object path, private bucket and upload completion used only after validation', async () => {
  const response = await POST(uploadRequest())
  expect(response.status).toBe(201)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(create).toHaveBeenCalledWith(true)
  expect(upload).toHaveBeenCalledWith('server/opaque/path', expect.any(Uint8Array), { contentType: 'application/pdf', upsert: false })
  expect(rpc).toHaveBeenLastCalledWith('complete_procurement_credential', { p_revision: id })
})
test('storage failure cannot mark revision ready and foreign download does not reveal a path', async () => {
  upload.mockResolvedValue({ error: { message: 'secret' } })
  const response = await POST(uploadRequest())
  expect(response.status).toBe(503)
  expect(rpc).toHaveBeenCalledTimes(1)
  expect((await download(new Request('http://localhost/api/procurement/credentials'), context)).status).toBe(404)
})
test('dates and declared formats are validated without fabricated authenticity claims', () => {
  expect(credentialMetadata.safeParse({ ...metadata, issued_on: '2025-02-30' }).success).toBe(false)
  expect(credentialMetadata.safeParse({ ...metadata, non_expiring: true, expires_on: '2027-01-01' }).success).toBe(false)
  expect(matchesEvidenceSignature(new Uint8Array([255,216,255]), 'image/jpeg')).toBe(true)
  expect(matchesEvidenceSignature(new Uint8Array([137,80,78,71,13,10,26,10]), 'image/png')).toBe(true)
  expect(matchesEvidenceSignature(new Uint8Array([1,2,3]), 'image/png')).toBe(false)
})