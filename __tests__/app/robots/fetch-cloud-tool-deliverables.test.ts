import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/client'
import { CLOUD_FILE_PAGE_SIZE, fetchCloudToolDeliverables } from '@/app/robots/fetch-cloud-tool-deliverables'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const instanceId = randomUUID()
const siteId = randomUUID()
const fileId = randomUUID()
function receipt(version: number, id = fileId) {
  return {
    instance_id: instanceId, site_id: siteId, tool_name: 'write_cloud_file', created_at: '2026-11-03',
    tool_result: { file_id: id, instance_id: instanceId, version,
      archive_url: `/api/robots/instance/${instanceId}/cloud-files/${id}?version=${version}&format=zip` },
  }
}

function client() {
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), range: jest.fn(),
  }
  const from = jest.fn(() => query)
  jest.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
  return { query, from }
}

it('pages only file results and deduplicates all revisions without loading chat payloads', async () => {
  const { query, from } = client()
  const secondId = randomUUID()
  query.range.mockResolvedValueOnce({ data: Array.from({ length: CLOUD_FILE_PAGE_SIZE }, () => receipt(1)), error: null })
    .mockResolvedValueOnce({ data: [receipt(2), receipt(1, secondId)], error: null })
  const files = await fetchCloudToolDeliverables(instanceId, siteId)
  expect(files).toHaveLength(2)
  expect(files.find(file => file.fileId === fileId)?.version).toBe(2)
  expect(from).toHaveBeenCalledWith('instance_logs')
  expect(query.select).toHaveBeenCalledWith('instance_id, site_id, tool_name, tool_result, created_at')
  expect(query.eq.mock.calls).toEqual([
    ['instance_id', instanceId], ['site_id', siteId],
    ['instance_id', instanceId], ['site_id', siteId],
  ])
  expect(query.in).toHaveBeenCalledWith('tool_name', ['write_cloud_file', 'deliver_file', 'tools'])
  expect(query.not).toHaveBeenCalledWith('tool_result', 'is', null)
  expect(query.order.mock.calls.slice(0, 2)).toEqual([['created_at', { ascending: true }], ['id', { ascending: true }]])
  expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]])
})

it('rejects failed reads instead of returning an incomplete or falsely empty list', async () => {
  const { query } = client()
  query.range.mockResolvedValue({ data: null, error: { message: 'private database error' } })
  await expect(fetchCloudToolDeliverables(instanceId, siteId)).rejects.toThrow('Failed to load instance files')
})

it('loads dispatched deliver_file history alongside legacy receipts', async () => {
  const { query } = client()
  const delivered = receipt(2)
  query.range.mockResolvedValue({ data: [receipt(1), {
    ...delivered, tool_name: 'tools', tool_result: { success: true, output: {
      name: 'deliver_file', success: true, result: { ok: true, output: delivered.tool_result },
    } },
  }], error: null })
  const files = await fetchCloudToolDeliverables(instanceId, siteId)
  expect(files).toHaveLength(1)
  expect(files[0].version).toBe(2)
})

it('returns no files for an empty instance', async () => {
  const { query } = client()
  query.range.mockResolvedValue({ data: [], error: null })
  await expect(fetchCloudToolDeliverables(instanceId, siteId)).resolves.toEqual([])
  expect(query.range).toHaveBeenCalledTimes(1)
})