"use client"

import { useState } from "react"
import Link from 'next/link'
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { ListToolbar } from "@/app/components/ui/list-toolbar"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Bell, Check, Trash2, Loader2 } from "@/app/components/ui/icons"
import { EmptyState } from "@/app/components/ui/empty-state"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/app/components/ui/alert-dialog"
import { useNotifications } from "./context/NotificationsContext"
import { NotificationCard } from "./components/NotificationCard"
import { NotificationSkeleton } from "./components/NotificationSkeleton"

export default function NotificationsPage() {
  const { t } = useLocalization()
  const {
    notifications, status, retryVerification, refreshNotifications, searchQuery, updateFilters, updateSearchQuery,
    markAsRead, markAllNotificationsAsRead, deleteOneNotification, deleteAllUserNotifications,
  } = useNotifications()
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all")
  const [pending, setPending] = useState<"read" | "delete" | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ready = status === 'ready'
  const showInbox = ready || status === 'refreshing' || status === 'paused'
  const loading = status === 'checking' || status === 'inactive' || status === 'loading'
  const retry = status === 'failed' ? refreshNotifications : retryVerification
  const unreadCount = notifications.filter(notification => !notification.is_read).length
  const query = searchQuery.trim().toLowerCase()
  const filteredNotifications = notifications
    .filter(notification => activeTab === "all" || !notification.is_read)
    .filter(notification => notification.title.toLowerCase().includes(query) || notification.message.toLowerCase().includes(query))

  const handleTabChange = (value: string) => {
    const tab = value as "all" | "unread"
    setActiveTab(tab)
    updateFilters({ is_read: tab === "unread" ? false : undefined })
  }

  const runBulkAction = async (action: "read" | "delete") => {
    if (!ready || pending) return
    setPending(action)
    try {
      await (action === "read" ? markAllNotificationsAsRead() : deleteAllUserNotifications())
    } finally {
      setPending(null)
      setConfirmDelete(false)
    }
  }

  if (loading) return <div role="status" aria-busy="true" aria-label={t('common.loading')} className="space-y-3 p-4 md:p-8 motion-reduce:[&_.animate-pulse]:animate-none">
    {Array.from({ length: 4 }, (_, index) => <NotificationSkeleton key={index} />)}
  </div>

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-muted/30 min-h-[calc(100vh-var(--topbar-height,64px))]">
      <StickyHeader>
        <ListToolbar className="py-3 md:py-0"
          search={<SearchInput type="search" placeholder={t('notifications.searchPlaceholder')} aria-label="Search notifications" containerClassName="w-48 lg:w-64" className="w-full" value={searchQuery} onSearch={updateSearchQuery} />}
          tabs={
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList aria-label="Filter notifications">
                <TabsTrigger value="all">{t('notifications.tabs.all')}</TabsTrigger>
                <TabsTrigger value="unread" className="gap-2">
                  {t('notifications.tabs.unread')}
                  {showInbox && <span className="rounded-full bg-background px-1.5 text-xs tabular-nums">{unreadCount}</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          } actions={<>
            <ToolbarIconButton label={t('notifications.markAllRead')} onClick={() => void runBulkAction("read")} disabled={!ready || !!pending || unreadCount === 0}>
              {pending === "read" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} /> : <Check className="h-4 w-4" aria-hidden={true} />}
            </ToolbarIconButton>
            <ToolbarIconButton label={t('notifications.deleteAll')} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={!ready || !!pending || notifications.length === 0}>
              <Trash2 className="h-4 w-4" aria-hidden={true} />
            </ToolbarIconButton>
          </>} />
      </StickyHeader>

      <div className="w-full min-w-0 flex-1 p-4 md:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background text-muted-foreground"><Bell className="h-5 w-5" aria-hidden={true} /></div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Your inbox</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Stay up to date with your workspace.</p>
            </div>
          </div>
          <p role="status" className="text-sm text-muted-foreground">
            {showInbox ? (query ? `${filteredNotifications.length} results` : `${unreadCount} unread · ${notifications.length} total`)
              : null}
          </p>
        </div>
        {!showInbox ? <div role="alert" className="space-y-3 rounded-lg border p-4">
          <p>{status === 'missing' ? t('noSiteSelected') : status === 'denied' ? t('workspacePreview.denied')
            : status === 'settings-unavailable' ? t('notifications.settingsUnavailable')
            : status === 'unavailable' ? t('chat.workspace.unavailable') : 'Notifications could not be loaded.'}</p>
          {retry && <Button variant="outline" onClick={() => void retry()}>{t('common.retry')}</Button>}
          {status === 'missing' && <Link href="/projects" prefetch={false} className="underline">{t('chat.workspace.choose')}</Link>}
        </div> : filteredNotifications.length > 0 ? (
          <div className="space-y-3">
            {filteredNotifications.map(notification => (
              <NotificationCard key={notification.id} notification={notification} onMarkAsRead={markAsRead} onDelete={deleteOneNotification} disabled={!ready || !!pending} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-background py-12">
            <EmptyState icon={<Bell className="h-12 w-12 text-muted-foreground" />} title={t('notifications.empty.title')}
              description={query ? t('notifications.empty.search') : activeTab === "unread" ? t('notifications.empty.unread') : t('notifications.empty.none')} />
            {query && <div className="flex justify-center"><Button variant="outline" onClick={() => updateSearchQuery("")}>Clear search</Button></div>}
          </div>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={open => { if (!pending) setConfirmDelete(open) }}>
        <AlertDialogContent busy={!!pending}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all your notifications in this workspace, including those hidden by the current filters. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" disabled={!ready || !!pending} onClick={event => { event.preventDefault(); void runBulkAction("delete") }}>
              {pending === "delete" ? "Deleting…" : "Delete all notifications"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
