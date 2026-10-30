'use client'

import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { X } from '@/app/components/ui/icons'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import styles from './submission-shell.module.css'

export function SubmissionShell({ open, onClose, busy, children, title, description }: {
  open: boolean; onClose: () => void; busy?: boolean; children: ReactNode; title: string; description: string
}) {
  const { t } = useProcurementI18n()
  return <Sheet open={open} onOpenChange={next => { if (!next && !busy) onClose() }}>
    <SheetContent side="right" showClose={false} data-submission-checkout overlayBlur={false}
      className={`${styles.surface} flex h-dvh w-full flex-col gap-0 overflow-hidden bg-gray-50 p-0 dark:bg-gray-950 sm:max-w-[720px]`}
      onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault() }}>
      <SheetHeader className="shrink-0 border-b bg-white px-6 py-5 pr-16 dark:border-gray-800 dark:bg-gray-950">
        <SheetTitle className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
        <Button type="button" variant="ghost" size="icon" disabled={busy} className="absolute right-4 top-4"
          aria-label={t('procurement.portal.closeDraft')} onClick={onClose}><X className="h-5 w-5" /></Button>
      </SheetHeader>
      {children}
    </SheetContent>
  </Sheet>
}