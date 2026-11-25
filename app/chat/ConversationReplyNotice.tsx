import { Button } from '@/app/components/ui/button'
import { useLocalization } from '@/app/context/LocalizationContext'

export function ConversationReplyNotice({ failed, retrying, onRetry }: {
  failed: boolean
  retrying: boolean
  onRetry: () => void
}) {
  const { t } = useLocalization()
  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      {failed ? <>
        <p role="alert">{t('chat.input.conversationLoadError')}</p>
        <Button type="button" variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
          {t(retrying ? 'chat.list.retrying' : 'chat.status.retry')}
        </Button>
      </> : <p role="status">{t('chat.input.loadingSettings')}</p>}
    </div>
  )
}