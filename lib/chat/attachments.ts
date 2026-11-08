export type ChatAttachmentKind = 'image' | 'sticker' | 'audio' | 'video' | 'document'

export interface ChatAttachment {
  url: string
  name: string
  mimeType?: string
  kind: ChatAttachmentKind
}

const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 255) : undefined

/** Read the persisted support contract without exposing arbitrary provider payloads. */
export function normalizeChatAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.slice(0, 10).flatMap((item: unknown) => {
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
    if (type === 'sticker') kind = 'sticker'
    else if (mimeType?.startsWith('image/')) kind = 'image'
    else if (mimeType?.startsWith('audio/')) kind = 'audio'
    else if (mimeType?.startsWith('video/')) kind = 'video'
    else if (!mimeType || mimeType === 'application/octet-stream') {
      if (type === 'image' || /\.(png|jpe?g|gif|webp|avif)$/.test(path)) kind = 'image'
      else if (type === 'audio' || type === 'voice' || type === 'voice_note' || /\.(mp3|m4a|ogg|opus|wav|aac|flac)$/.test(path)) kind = 'audio'
      else if (type === 'video' || /\.(mp4|webm|mov)$/.test(path)) kind = 'video'
    }
    // Never use URL query parameters as display names (they can contain signatures).
    const name = text(row.name || row.filename || row.fileName)?.trim() ||
      `${kind.charAt(0).toUpperCase()}${kind.slice(1)} attachment`
    return [{ url: url.href, name, mimeType, kind }]
  })
}

/** Outstand historically persisted DM URLs separately from support attachments. */
export function getChatAttachments(metadata: unknown): ChatAttachment[] {
  if (!metadata || typeof metadata !== 'object') return []
  const row = metadata as Record<string, unknown>
  const attachments = Array.isArray(row.attachments) ? row.attachments : []
  const legacy = row.source === 'outstand_dm' && Array.isArray(row.media_urls)
    ? row.media_urls.map(url => ({ url })) : []
  return normalizeChatAttachments([...attachments, ...legacy])
}

/** Only replace a standalone provider marker when its attachment is available. */
export function chatAttachmentText(text: string, attachments: ChatAttachment[]): string {
  const marker = text.trim().match(/^\[(image|sticker|audio|voice|voice_note|video|document)\]$/i)
  if (!marker) return text
  const kind = ['voice', 'voice_note'].includes(marker[1].toLowerCase()) ? 'audio' : marker[1].toLowerCase()
  return attachments.some(attachment => attachment.kind === kind) ? '' : text
}