"use client"

import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
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
    notifications, loading, searchQuery, updateFilters, updateSearchQuery,
    markAsRead, markAllNotificationsAsRead, deleteOneNotification, deleteAllUserNotifications,
  } = useNotifications()
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all")
  const [pending, setPending] = useState<"read" | "delete" | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
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
    if (pending) return
    setPending(action)
    try {
      await (action === "read" ? markAllNotificationsAsRead() : deleteAllUserNotifications())
    } finally {
      setPending(null)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-muted/30 min-h-[calc(100vh-var(--topbar-height,64px))]">
      <StickyHeader>
        <div className="flex min-w-0 w-full flex-wrap items-center justify-between gap-2 py-3 md:flex-nowrap md:gap-4 md:py-0" data-toolbar-icon-actions="off">
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:gap-4">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList aria-label="Filter notifications">
                <TabsTrigger value="all">{t('notifications.tabs.all')}</TabsTrigger>
                <TabsTrigger value="unread" className="gap-2">
                  {t('notifications.tabs.unread')}
                  {!loading && <span className="rounded-full bg-background px-1.5 text-xs tabular-nums">{unreadCount}</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <SearchInput type="search" placeholder={t('notifications.searchPlaceholder')} aria-label="Search notifications" containerClassName="w-48 lg:w-64" className="w-full" value={searchQuery} onSearch={updateSearchQuery} />
          </div>
          <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 md:flex-nowrap">
            <Button variant="secondary" size="sm" className="h-9 min-w-0 gap-2" onClick={() => void runBulkAction("read")} disabled={loading || !!pending || unreadCount === 0}>
              {pending === "read" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} /> : <Check className="h-4 w-4" aria-hidden={true} />}
              <span>{t('notifications.markAllRead')}</span>
            </Button>
            <Button variant="ghost" size="icon" aria-label={t('notifications.deleteAll')} title={t('notifications.deleteAll')} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)} disabled={loading || !!pending || notifications.length === 0}>
              <Trash2 className="h-4 w-4" aria-hidden={true} />
            </Button>
          </div>
        </div>
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
            {loading ? "Loading notifications…" : query
              ? `${filteredNotifications.length} results`
              : `${unreadCount} unread · ${notifications.length} total`}
          </p>
        </div>
        {loading ? (
          <div className="space-y-3" aria-label="Loading notifications" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => <NotificationSkeleton key={index} />)}
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="space-y-3">
            {filteredNotifications.map(notification => (
              <NotificationCard key={notification.id} notification={notification} onMarkAsRead={markAsRead} onDelete={deleteOneNotification} disabled={!!pending} />
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
            <AlertDialogAction className="bg-destructive" disabled={!!pending} onClick={event => { event.preventDefault(); void runBulkAction("delete") }}>
              {pending === "delete" ? "Deleting…" : "Delete all notifications"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
