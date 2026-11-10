"use client"

import { Button } from '@/app/components/ui/button'
import type { ChatResponseFormat } from '@/lib/chat/response-format'
import { useLocalization } from '@/app/context/LocalizationContext'

export function ResponseFormatSelector({ value, onChange, disabled }: {
  value: ChatResponseFormat
  onChange: (value: ChatResponseFormat) => void
  disabled: boolean
}) {
  const { t } = useLocalization()
  return (
    <div role="group" aria-label={t('chat.responseFormat.label')} className="flex h-8 shrink-0 items-center rounded-full bg-secondary/50 p-0.5">
      {(['text', 'audio'] as const).map(format => (
        <Button key={format} type="button" variant="ghost" size="sm"
          aria-pressed={value === format} disabled={disabled}
          onClick={() => onChange(format)}
          className={`h-7 rounded-full px-2 text-xs ${value === format ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
          {t(`chat.responseFormat.${format}`)}
        </Button>
      ))}
    </div>
  )
}