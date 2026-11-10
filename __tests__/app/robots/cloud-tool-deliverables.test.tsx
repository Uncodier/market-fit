import { randomUUID } from 'node:crypto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig, useSWRConfig } from 'swr'
import { cloudToolDeliverables, cloudViewerUrl, isCloudOnlyContent } from '@/app/robots/cloud-tool-deliverables'
import { useCloudToolDeliverables } from '@/app/robots/use-cloud-tool-deliverables'
import { fetchCloudToolDeliverables } from '@/app/robots/fetch-cloud-tool-deliverables'

jest.mock('@/app/robots/fetch-cloud-tool-deliverables', () => ({ fetchCloudToolDeliverables: jest.fn(async () => []) }))

beforeEach(() => jest.mocked(fetchCloudToolDeliverables).mockReset().mockResolvedValue([]))

const instanceId = randomUUID()
const siteId = randomUUID()
const fileId = randomUUID()
const path = `/api/robots/instance/${instanceId}/cloud-files/${fileId}`
const url = (version: number, format = 'zip') => `${path}?version=${version}&format=${format}`
function activity(version = 1) {
  return {
    instance_id: instanceId, site_id: siteId, tool_name: 'write_cloud_file',
    created_at: `2026-11-03T21:10:0${version}Z`,
    tool_result: { success: true, output: { ok: true, output: {
      file_id: fileId, instance_id: instanceId, version, saved: true, git_status: 'pending', name: 'animation.html',
      archive_url: url(version), download_url: url(version, 'text'),
    } } },
  }
}

it('extracts successful nested receipts without requiring a requirement or Git publication', () => {
  expect(cloudToolDeliverables([activity()], instanceId, siteId)).toEqual([
    { fileId, version: 1, url: url(1), createdAt: activity().created_at },
  ])
})

it('deduplicates replays and keeps the highest version even when older receipts arrive later', () => {
  const replay = { ...activity(1), created_at: '2026-11-04T00:00:00Z' }
  expect(cloudToolDeliverables([activity(2), activity(1), replay, activity(2)], instanceId, siteId))
    .toEqual([{ fileId, version: 2, url: url(2), createdAt: activity(2).created_at }])
})

function dispatchedActivity(version = 1, name = 'deliver_file') {
  const log = activity(version)
  return { ...log, tool_name: 'tools', tool_result: {
    success: true, error: null, output: { name, success: true, result: log.tool_result.output },
  } }
}

it.each(['deliver_file', 'write_cloud_file'])('accepts direct and dispatched %s receipts', name => {
  expect(cloudToolDeliverables([{ ...activity(), tool_name: name }, dispatchedActivity(2, name)], instanceId, siteId))
    .toEqual([{ fileId, version: 2, url: url(2), createdAt: activity(2).created_at }])
})

it('rejects unidentified dispatch, lookup metadata, unrelated tools and failed dispatch receipts', () => {
  const log = dispatchedActivity()
  expect(cloudToolDeliverables([
    { ...activity(), tool_name: 'tools' },
    dispatchedActivity(1, 'read_cloud_file'),
    { ...log, tool_result: { success: false, output: log.tool_result.output } },
    { ...log, tool_result: { output: { name: 'deliver_file', parameters: activity().tool_result } } },
    { ...activity(), tool_name: 'deliver_file', tool_result: { ...activity().tool_result.output.output, saved: false } },
    { ...log, site_id: randomUUID() },
  ], instanceId, siteId)).toEqual([])
})

it('rejects failed, conflicting, foreign, forged and argument-only receipts', () => {
  const valid = activity()
  const receipt = valid.tool_result.output.output
  const invalid = [
    { ...valid, site_id: randomUUID() },
    { ...valid, instance_id: randomUUID() },
    { ...valid, tool_name: 'read_cloud_file' },
    { ...valid, tool_result: { success: false, output: receipt } },
    { ...valid, tool_result: { ...receipt, state: 'conflict' } },
    { ...valid, tool_result: { ...receipt, instance_id: randomUUID() } },
    { ...valid, tool_result: { ...receipt, file_id: randomUUID() } },
    { ...valid, tool_result: { ...receipt, version: 2 } },
    { ...valid, tool_result: { ...receipt, archive_url: `https://evil.example.test${url(1)}`, download_url: null } },
    { ...valid, tool_result: { content: receipt }, tool_args: receipt },
  ]
  expect(cloudToolDeliverables(invalid, instanceId, siteId)).toEqual([])
})

it('converts only strict private revision URLs to the authenticated archive path', () => {
  expect(cloudViewerUrl(url(2, 'text'))).toBe(url(2))
  expect(cloudViewerUrl(url(2))).toBe(url(2))
  expect(cloudViewerUrl(`${url(2)}&url=x`)).toBeNull()
  expect(cloudViewerUrl(`https://evil.example.test${url(2)}`)).toBeNull()
})

it('does not infer application capabilities from cloud files', () => {
  expect(isCloudOnlyContent(url(1), url(1))).toBe(true)
  expect(isCloudOnlyContent(url(1), null)).toBe(true)
  expect(isCloudOnlyContent(null, url(1, 'text'))).toBe(true)
  expect(isCloudOnlyContent('https://app.example.test', url(1))).toBe(false)
  expect(isCloudOnlyContent(null, null)).toBe(false)
})

it('merges background files with live receipts, preserves files outside the log window and resets scope', async () => {
  const olderFile = { fileId: randomUUID(), version: 1, url: 'history', createdAt: '2026-01-01' }
  jest.mocked(fetchCloudToolDeliverables).mockResolvedValueOnce([olderFile])
  const fetcher = jest.fn()
  const cache = new Map()
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SWRConfig value={{ provider: () => cache, fetcher }}>{children}</SWRConfig>
  )
  const view = renderHook(({ id }) => ({
    files: useCloudToolDeliverables(id, siteId), mutate: useSWRConfig().mutate,
  }), { wrapper, initialProps: { id: instanceId } })
  expect(view.result.current.files).toEqual([])
  await waitFor(() => expect(view.result.current.files).toEqual([olderFile]))
  await act(async () => { await view.result.current.mutate(['instance_logs', instanceId], [activity()], false) })
  expect(view.result.current.files[0]?.url).toBe(url(1))
  await act(async () => { await view.result.current.mutate(['instance_logs', instanceId], [dispatchedActivity(2)], false) })
  expect(view.result.current.files[0]?.url).toBe(url(2))
  await act(async () => { await view.result.current.mutate(['instance_logs', instanceId], [], false) })
  expect(view.result.current.files.map(file => file.fileId)).toEqual([fileId, olderFile.fileId])
  expect(fetchCloudToolDeliverables).toHaveBeenCalledTimes(1)
  view.rerender({ id: randomUUID() })
  expect(view.result.current.files).toEqual([])
  await act(async () => { await Promise.resolve() })
  expect(fetcher).not.toHaveBeenCalled()
})

it('does not query without both instance and site scope', () => {
  renderHook(() => useCloudToolDeliverables(instanceId, null))
  expect(fetchCloudToolDeliverables).not.toHaveBeenCalled()
})