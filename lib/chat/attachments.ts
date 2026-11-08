export type ChatAttachmentKind = 'image' | 'sticker' | 'audio' | 'video' | 'document'

export interface ChatAttachment {
  url: string
  name: string
  mimeType?: string
  kind: ChatAttachmentKind
}

const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 255) : undefined
const MAX_CANDIDATES = 100
const MAX_ATTACHMENTS = 10

/** Read the persisted support contract without exposing arbitrary provider payloads. */
export function normalizeChatAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.slice(0, MAX_CANDIDATES).flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const raw = row.url || row.mediaUrl
    if (typeof raw !== 'string' || raw.length > 8192) return []
    let url: URL
    try {
      url = new URL(raw)
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return []
    } catch { return [] }
    if (seen.has(url.href)) return []
    seen.add(url.href)
    const mimeType = text(row.mimeType || row.mime_type || row.contentType || row.content_type)?.toLowerCase()
    const type = text(row.type || row.messageType)?.toLowerCase()
    const path = url.pathname.toLowerCase()
    let kind: ChatAttachmentKind = 'document'
    if (mimeType?.startsWith('image/')) kind = type === 'sticker' ? 'sticker' : 'image'
    else if (mimeType?.startsWith('audio/')) kind = 'audio'
    else if (mimeType?.startsWith('video/')) kind = 'video'
    else if (!mimeType || mimeType === 'application/octet-stream') {
      if (type === 'image' || type === 'sticker' || type === 'video' || type === 'document') kind = type
      else if (type === 'audio' || type === 'voice' || type === 'voice_note') kind = 'audio'
      else if (/\.(png|jpe?g|gif|webp|avif)$/.test(path)) kind = 'image'
      else if (/\.(mp3|m4a|ogg|opus|wav|aac|flac)$/.test(path)) kind = 'audio'
      else if (/\.(mp4|webm|mov)$/.test(path)) kind = 'video'
    }
    // Never use URL query parameters as display names (they can contain signatures).
    const name = text(row.name || row.filename || row.fileName)?.trim() ||
      `${kind.charAt(0).toUpperCase()}${kind.slice(1)} attachment`
    return [{ url: url.href, name, mimeType, kind }]
  }).slice(0, MAX_ATTACHMENTS)
}

/** Outstand historically persisted DM URLs separately from support attachments. */
export function getChatAttachments(metadata: unknown): ChatAttachment[] {
  if (!metadata || typeof metadata !== 'object') return []
  const row = metadata as Record<string, unknown>
  const attachments = normalizeChatAttachments(row.attachments)
  const legacy = row.source === 'outstand_dm' && Array.isArray(row.media_urls)
    ? normalizeChatAttachments(row.media_urls.slice(0, MAX_CANDIDATES).map(url => ({ url }))) : []
  // Already normalized: preserve inferred kinds while merging independently bounded sources.
  const seen = new Set<string>()
  return [...attachments, ...legacy].filter(attachment => {
    if (seen.has(attachment.url)) return false
    seen.add(attachment.url)
    return true
  }).slice(0, MAX_ATTACHMENTS)
}

/** Only replace a standalone provider marker when its attachment is available. */
export function chatAttachmentText(text: string, attachments: ChatAttachment[]): string {
  const marker = text.trim().match(/^\[(image|sticker|audio|voice|voice_note|video|document)\]$/i)
  if (!marker) return text
  const kind = ['voice', 'voice_note'].includes(marker[1].toLowerCase()) ? 'audio' : marker[1].toLowerCase()
  return attachments.some(attachment => attachment.kind === kind) ? '' : text
}