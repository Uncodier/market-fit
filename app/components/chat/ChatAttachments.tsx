"use client"

import { useState } from 'react'
import Image from 'next/image'
import type { ChatAttachment } from '@/lib/chat/attachments'

function Attachment({ attachment }: { attachment: ChatAttachment }) {
  const [failed, setFailed] = useState(false)
  const { url, name, kind, mimeType } = attachment
  const visual = kind === 'image' || kind === 'sticker'

  return (
    <div className="min-w-0 max-w-full space-y-2 rounded-lg border border-border/60 p-2">
      {!failed && visual && (
        <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Open ${name}`}>
          <Image
            src={url} alt={name} width={kind === 'sticker' ? 160 : 360} height={kind === 'sticker' ? 160 : 280}
            unoptimized loading="lazy" referrerPolicy="no-referrer"
            className={kind === 'sticker' ? 'h-40 w-40 max-w-full object-contain' : 'h-auto max-h-80 max-w-full rounded-md object-contain'}
            onError={() => setFailed(true)}
          />
        </a>
      )}
      {!failed && kind === 'audio' && (
        <audio src={url} controls preload="none" aria-label={name} className="max-w-full" onError={() => setFailed(true)} />
      )}
      {!failed && kind === 'video' && (
        <video src={url} controls playsInline preload="none" aria-label={name} className="max-h-80 max-w-full rounded-md" onError={() => setFailed(true)} />
      )}
      {failed && <p role="status" className="text-sm text-muted-foreground">Preview unavailable. The file may have expired or this format may not be supported. Try opening it or ask the sender to resend it.</p>}
      <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="block break-words text-sm underline underline-offset-2">
        {visual ? `Open original: ${name}` : `Open file: ${name}`}
      </a>
      {kind === 'document' && <p className="text-xs text-muted-foreground">{mimeType || 'Document'} · Opens in a new tab</p>}
    </div>
  )
}

export function ChatAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  if (!attachments.length) return null
  return (
    <div aria-label="Message attachments" className="flex min-w-0 max-w-full flex-col gap-2">
      {attachments.map(attachment => <Attachment key={attachment.url} attachment={attachment} />)}
    </div>
  )
}