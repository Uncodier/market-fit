"use client"

import { useState } from 'react'
import Image from 'next/image'
import type { ChatAttachment } from '@/lib/chat/attachments'
import { useLocalization } from '@/app/context/LocalizationContext'
import { FileText } from '@/app/components/ui/icons'
import { ChatAudioPlayer } from './ChatAudioPlayer'

function Attachment({ attachment }: { attachment: ChatAttachment }) {
  const { t } = useLocalization()
  const [failed, setFailed] = useState(false)
  const { url, name, kind, mimeType } = attachment
  const visual = kind === 'image' || kind === 'sticker'
  const displayName = name === 'Audio response.mp3' ? t('chat.attachment.audio')
    : name === `${kind.charAt(0).toUpperCase()}${kind.slice(1)} attachment` ? t(`chat.attachment.${kind}`) : name

  if (kind === 'audio') return <ChatAudioPlayer key={url} url={url} name={displayName} />

  return (
    <div className="min-w-0 max-w-full space-y-2 rounded-lg border border-border/60 p-2">
      {!failed && visual && (
        <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={displayName}>
          <Image
            src={url} alt={displayName} width={kind === 'sticker' ? 160 : 360} height={kind === 'sticker' ? 160 : 280}
            unoptimized loading="lazy" referrerPolicy="no-referrer"
            className={kind === 'sticker' ? 'h-40 w-40 max-w-full object-contain' : 'h-auto max-h-80 max-w-full rounded-md object-contain'}
            onError={() => setFailed(true)}
          />
        </a>
      )}
      {!failed && kind === 'video' && (
        <video src={url} controls playsInline preload="none" aria-label={displayName} className="max-h-80 max-w-full rounded-md" onError={() => setFailed(true)} />
      )}
      {failed && <p role="status" className="text-sm text-muted-foreground">{t('chat.attachment.previewUnavailable')}</p>}
      {(!visual || failed) && <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
        className="flex items-center gap-2 rounded-md p-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {kind === 'document' && <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden={true} />}
        <span className="min-w-0 break-words font-medium">{displayName}</span>
      </a>
      }
      {kind === 'document' && <p className="px-1.5 text-xs text-muted-foreground">{mimeType === 'application/pdf' ? 'PDF' : t('chat.attachment.document')} · {t('chat.attachment.newTab')}</p>}
    </div>
  )
}

export function ChatAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  const { t } = useLocalization()
  if (!attachments.length) return null
  return (
    <div aria-label={t('chat.attachments')} className="flex min-w-0 max-w-full flex-col gap-2">
      {attachments.map(attachment => <Attachment key={attachment.url} attachment={attachment} />)}
    </div>
  )
}