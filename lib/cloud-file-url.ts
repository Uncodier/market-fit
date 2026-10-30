const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const cloudPath = new RegExp(`^/api/robots/instance/${uuid}/cloud-files/${uuid}$`, 'i')

/** Only API-issued relative revision URLs may bypass the public asset proxy. */
export function cloudRevisionFormat(value: string): 'zip' | 'text' | null {
  const [path, query] = value.split('?')
  if (!cloudPath.test(path) || !query || value.includes('#') || value.split('?').length !== 2) return null
  const params = new URLSearchParams(query)
  if ([...params.keys()].some(key => !['version', 'format'].includes(key)) ||
    params.getAll('version').length !== 1 || params.getAll('format').length !== 1) return null
  const version = params.get('version')!
  const format = params.get('format')
  if (!/^[1-9]\d*$/.test(version) || Number(version) > 2147483647) return null
  return format === 'zip' || format === 'text' ? format : null
}

export function archiveRequestUrl(url: string, origin: string): string {
  if (cloudRevisionFormat(url) === 'zip') return url
  const absolute = url.startsWith('/') ? origin + url : url
  return `/api/assets/proxy-zip?url=${encodeURIComponent(absolute)}`
}