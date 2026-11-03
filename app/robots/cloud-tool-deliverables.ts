import { cloudRevisionFormat } from '@/lib/cloud-file-url'

interface Activity {
  instance_id?: string
  site_id?: string
  tool_name?: string
  tool_result?: unknown
  created_at: string
}

export interface CloudDeliverable {
  fileId: string
  version: number
  url: string
  createdAt: string
}

/** Keep private revision URLs on the authenticated ZIP path, never the public proxy. */
export function cloudViewerUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !cloudRevisionFormat(value)) return null
  const [path, query] = value.split('?')
  const params = new URLSearchParams(query)
  params.set('format', 'zip')
  return `${path}?${params}`
}

/** A private document is not evidence of an application repository or database. */
export function isCloudOnlyContent(previewUrl: unknown, sourceUrl: unknown): boolean {
  const urls = [previewUrl, sourceUrl].filter((value): value is string => typeof value === 'string' && !!value)
  return urls.length > 0 && urls.every(value => cloudRevisionFormat(value) !== null)
}

/** Inspect only known result envelopes, not document content, arguments or prose. */
export function cloudToolDeliverables(logs: readonly Activity[], instanceId: string, siteId: string): CloudDeliverable[] {
  const files = new Map<string, CloudDeliverable>()
  for (const log of logs) {
    if (log.instance_id !== instanceId || log.site_id !== siteId || log.tool_name !== 'write_cloud_file') continue
    let result = log.tool_result
    for (let depth = 0; depth < 8; depth++) {
      if (!result || typeof result !== 'object' || Array.isArray(result)) break
      const receipt = result as Record<string, unknown>
      if (receipt.ok === false || receipt.success === false || receipt.error || receipt.state === 'conflict') break
      if (typeof receipt.file_id === 'string' && Number.isInteger(receipt.version)) {
        const url = cloudViewerUrl(receipt.archive_url) ?? cloudViewerUrl(receipt.download_url)
        if (!url || receipt.instance_id !== instanceId) break
        const [path, query] = url.split('?')
        if (path !== `/api/robots/instance/${instanceId}/cloud-files/${receipt.file_id}` ||
          Number(new URLSearchParams(query).get('version')) !== receipt.version) break
        const next = { fileId: receipt.file_id, version: receipt.version as number, url, createdAt: log.created_at }
        const previous = files.get(next.fileId)
        if (!previous || next.version > previous.version ||
          (next.version === previous.version && next.createdAt > previous.createdAt)) files.set(next.fileId, next)
        break
      }
      result = receipt.output ?? receipt.result ?? receipt.data
    }
  }
  return [...files.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.version - a.version)
}