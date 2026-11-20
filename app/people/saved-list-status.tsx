import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import type { SavedListSnapshot } from './saved-list-types'

function statusPresentation(status: string) {
  switch (status) {
    case 'pending': return ['people.saved.status.pending', 'Pending', 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300']
    case 'running': case 'mining': case 'in_progress':
      return ['people.saved.status.inProgress', 'In Progress', 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300']
    case 'completed': return ['people.saved.status.completed', 'Completed', 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300']
    case 'failed': return ['people.saved.status.failed', 'Failed', 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300']
    default: return ['status.unknown', 'Unknown', 'bg-muted text-muted-foreground']
  }
}

export function SavedListStatus({ snapshot, t }: {
  snapshot: Pick<SavedListSnapshot, 'status' | 'completed' | 'total'>
  t: (key: string) => string
}) {
  const { status, completed, total } = snapshot
  const [key, fallback, colors] = statusPresentation(status)
  const processing = t('processing') || 'Processing'
  const count = `${completed.toLocaleString()} / ${total.toLocaleString()}`

  return <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
    <div className="flex items-center gap-3" role="status" aria-label={t('common.status') || 'Status'}>
      <span className="text-sm font-medium">{t('common.status') || 'Status'}</span>
      <Badge variant="secondary" className={`gap-1.5 ${colors}`}>
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        {t(key) || fallback}
      </Badge>
    </div>
    <div className="w-full sm:w-52">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{processing}</span>
        <span className="font-medium tabular-nums">{count} <span className="font-normal text-muted-foreground">{t('people.table.pagination.people') || 'people'}</span></span>
      </div>
      {total > 0 && <Progress aria-label={processing} aria-valuetext={count} value={completed / total * 100} className="mt-1.5 h-1.5" />}
    </div>
  </div>
}