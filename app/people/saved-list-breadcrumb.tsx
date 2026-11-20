import { ChevronRight } from '@/app/components/ui/icons'

export function SavedListBreadcrumb({ root, name, onReturn }: { root: string; name: string; onReturn: () => void }) {
  return (
    <nav className="min-w-0" aria-label="Breadcrumb">
      <ol className="flex items-center min-w-0">
        <li className="shrink-0">
          <button type="button" onClick={onReturn} className="min-h-10 text-base md:text-xl font-semibold text-muted-foreground hover:text-foreground">
            {root}
          </button>
        </li>
        <li className="flex items-center min-w-0">
          <ChevronRight aria-hidden="true" className="mx-1.5 h-4 w-4 shrink-0" />
          <h1 aria-current="page" className="truncate text-lg md:text-2xl font-semibold" title={name}>{name}</h1>
        </li>
      </ol>
    </nav>
  )
}