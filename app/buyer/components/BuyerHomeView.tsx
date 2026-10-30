"use client"

import React from "react"
import Link from "next/link"
import useSWR from "swr"
import { getBuyerPortalSummary } from "../actions"
import { 
  Repeat, 
  FileText, 
  ShoppingCart, 
  User,
  Video,
  Ticket,
  File as FileIcon,
  CheckCircle2,
  Calendar,
  Clock,
  Store
} from "@/app/components/ui/icons"
import { Card, CardContent } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useLocalization } from "@/app/context/LocalizationContext"
import { demoAccountDetailPath } from '@/app/home/demo-commerce'
import { BuyerHomeSkeleton } from './BuyerHomeSkeleton'

type AccountNavigationCard = {
  title: string
  description: string
  icon: React.ReactNode
  href: string
  alwaysShow?: boolean
  isPrimary?: boolean
  count?: number
  newCount?: number
}

type PortalSummary = Extract<Awaited<ReturnType<typeof getBuyerPortalSummary>>, { counts: unknown }>
type HomeReservation = {
  id: string
  start_time: string
  end_time: string
  status: string
  entitlement_id: string | null
  site: { name: string } | null
  catalog_item: { name: string; image_url: string | null } | null
  entitlement: { id: string; catalog_item: { name: string; image_url: string | null } | null } | null
}
export type BuyerHomeSummary = Omit<PortalSummary, 'user' | 'activeReservations' | 'recentReservations'> & {
  user: Pick<PortalSummary['user'], 'email' | 'user_metadata'>
  activeReservations: HomeReservation[]
  recentReservations: HomeReservation[]
}

function HomeLink({ demo, href, children, ...props }: React.ComponentProps<typeof Link> & { demo: boolean }) {
  const reservationId = String(href).match(/^\/buyer\/reservations\/(demo-reservation-[^/]+)$/)?.[1]
  const target = demo && reservationId ? demoAccountDetailPath('reservations', reservationId) : href
  return <Link href={target} {...props}>{children}</Link>
}

export function BuyerHomeView({
  scope = "personal",
  ownerSiteId,
  basePath = "/buyer",
  additionalCards = [],
  demoSummary,
}: {
  scope?: "personal" | "site"
  ownerSiteId?: string
  basePath?: string
  additionalCards?: AccountNavigationCard[]
  demoSummary?: BuyerHomeSummary
}) {
  const { t } = useLocalization()
  
  const appUrl = typeof window !== 'undefined'
    ? (window.location.hostname.startsWith('www.')
        ? window.location.origin.replace('www.', 'app.')
        : '')
    : ''
  const workspaceUrl = appUrl
  
  const summary = useSWR<BuyerHomeSummary>(
    demoSummary ? null : { key: "buyer-portal-summary", scope, ownerSiteId },
    async (params: { scope: 'personal' | 'site'; ownerSiteId?: string }) => {
      const res = await getBuyerPortalSummary({ scope: params.scope, ownerSiteId: params.ownerSiteId })
      if (!res.counts) throw new Error(res.error || 'Failed to load account details.')
      return res
    }
  )
  const data = demoSummary ?? summary.data
  const error = !demoSummary && summary.error
  const isLoading = !demoSummary && summary.isLoading

  if (error) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center h-full">
        <p className="text-red-500">{t('buyer.home.failedToLoad') || 'Failed to load account details.'}</p>
      </div>
    )
  }

  if (isLoading) return <BuyerHomeSkeleton cardCount={2 + additionalCards.length} />

  const hasBusinesses = (data?.counts?.sites ?? 0) > 0

  let settingsCards: AccountNavigationCard[] = [
    ...(scope === "personal" ? [{
      title: hasBusinesses
        ? (t("buyer.home.cards.businesses.title") || "Manage your businesses")
        : (t("buyer.home.cards.startSelling.title") || "Start selling"),
      description: hasBusinesses
        ? (t("buyer.home.cards.businesses.desc") || "Switch businesses or create a new one.")
        : (t("buyer.home.cards.startSelling.desc") || "Create your business and start selling on Makinari."),
      icon: <Store className="w-6 h-6 text-foreground/70" />,
      href: `${workspaceUrl}/projects?manage=1`,
      isPrimary: true,
      count: isLoading ? undefined : (hasBusinesses ? data?.counts?.sites : undefined),
      alwaysShow: true
    }] : []),
    {
      title: t("buyer.home.cards.profile.title") || "Profile information",
      description: t("buyer.home.cards.profile.desc") || "Personal and account details.",
      icon: <User className="w-6 h-6 text-foreground/70" />,
      href: `${basePath}/profile`,
      alwaysShow: true
    },
    {
      title: t("buyer.home.cards.purchases.title") || "Online purchases",
      description: t("buyer.home.cards.purchases.desc") || "Marketplace orders and purchase history.",
      icon: <ShoppingCart className="w-6 h-6 text-foreground/70" />,
      href: `${basePath}/orders`,
      count: data?.counts?.orders,
      newCount: data?.newCounts?.orders
    },
    {
      title: t("buyer.home.cards.subscriptions.title") || "Subscriptions",
      description: t("buyer.home.cards.subscriptions.desc") || "Manage your recurring payments.",
      icon: <Repeat className="w-6 h-6 text-foreground/70" />,
      href: `${basePath}/subscriptions`,
      count: data?.counts?.subscriptions,
      newCount: data?.newCounts?.subscriptions
    },
    {
      title: t("buyer.home.cards.quotations.title") || "Quotations",
      description: t("buyer.home.cards.quotations.desc") || "Review your business quotes.",
      icon: <FileText className="w-6 h-6 text-foreground/70" />,
      href: `${basePath}/quotes`,
      count: data?.counts?.quotes,
      newCount: data?.newCounts?.quotes
    },
    {
      title: t("buyer.home.cards.courses.title") || "Courses",
      description: t("buyer.home.cards.courses.desc") || "Access your video courses.",
      icon: <Video className="w-6 h-6 text-foreground/70" />,
      href: `${basePath}/library?subtype=course`,
      count: data?.counts?.courses,
      newCount: data?.newCounts?.courses
    },
    {
      title: t("buyer.home.cards.tickets.title") || "Tickets",
      description: t("buyer.home.cards.tickets.desc") || "View your event tickets.",
      icon: <Ticket className="w-6 h-6 text-foreground/70" />,
      href: `${basePath}/library?subtype=ticket`,
      count: data?.counts?.tickets,
      newCount: data?.newCounts?.tickets
    },
    {
      title: t("buyer.home.cards.files.title") || "Files",
      description: t("buyer.home.cards.files.desc") || "Download your digital files.",
      icon: <FileIcon className="w-6 h-6 text-foreground/70" />,
      href: `${basePath}/library?subtype=file`,
      count: data?.counts?.files,
      newCount: data?.newCounts?.files
    },
    {
      title: t("buyer.home.cards.passes.title") || "Passes",
      description: t("buyer.home.cards.passes.desc") || "Manage your access passes.",
      icon: <CheckCircle2 className="w-6 h-6 text-foreground/70" />,
      href: `${basePath}/library?subtype=pass`,
      count: data?.counts?.passes,
      newCount: data?.newCounts?.passes
    },
    ...additionalCards.map(card => ({ ...card, alwaysShow: true }))
  ]

  // Filter cards based on counts, always keep alwaysShow cards
  settingsCards = settingsCards.filter(card => card.alwaysShow || (card.count !== undefined && card.count > 0))

  const userName = data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || data?.user?.user_metadata?.first_name || 'User'
  const userEmail = data?.user?.email || ''
  const avatarUrl = data?.user?.user_metadata?.avatar_url || data?.user?.user_metadata?.picture
  const initial = userName.charAt(0).toUpperCase()

  return (
    <div className="flex flex-col w-full gap-8 py-4 md:py-8 px-4">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-2">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shrink-0 border shadow-sm overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-medium text-muted-foreground">
                {initial}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32 mt-1" />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight truncate">{userName}</h1>
                <p className="text-muted-foreground text-sm mt-1 truncate">{userEmail}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Active Reservations */}
      {!isLoading && data?.activeReservations && data.activeReservations.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold tracking-tight">
            {t("buyer.home.reservations.title") || "Upcoming reservations"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.activeReservations.map((reservation) => {
              const imageUrl = reservation.entitlement?.catalog_item?.image_url || reservation.catalog_item?.image_url
              return (
                <HomeLink demo={!!demoSummary} key={reservation.id} href={`/buyer/reservations/${reservation.id}`} className="block group">
                  <Card className="border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 bg-card rounded-2xl group-hover:-translate-y-0.5 overflow-hidden">
                    <CardContent className="p-0 flex items-stretch">
                      {/* Left Icon / Date Block */}
                      <div className="w-20 shrink-0 border-r border-border/50 bg-muted/30 flex flex-col items-center justify-center relative overflow-hidden group-hover:bg-primary/5 transition-colors">
                        {imageUrl && (
                          <div className="absolute inset-0 opacity-15 mix-blend-luminosity">
                            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="relative z-10 flex flex-col items-center text-center">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary/80 mb-0.5 transition-colors">
                            {new Date(reservation.start_time).toLocaleString(undefined, { month: 'short' })}
                          </span>
                          <span className="text-2xl font-black text-foreground group-hover:text-primary leading-none transition-colors">
                            {new Date(reservation.start_time).getDate()}
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 p-4 min-w-0 flex flex-col justify-center">
                        <h3 className="font-bold text-[16px] truncate text-foreground group-hover:text-primary transition-colors leading-tight mb-2">
                          {reservation.catalog_item?.name || "Reservation"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 bg-muted/50 px-2 py-1 rounded-md border border-border/50">
                            <Calendar className="w-3.5 h-3.5 text-primary/70" />
                            <span className="capitalize">
                              {new Date(reservation.start_time).toLocaleDateString(undefined, { weekday: 'long' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 text-primary/60" />
                            <span className="font-medium">
                              {new Date(reservation.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              <span className="mx-1.5 text-muted-foreground/40">-</span>
                              {new Date(reservation.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </HomeLink>
              )
            })}
          </div>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsCards.map((card, i) => (
          <HomeLink demo={!!demoSummary} key={i} href={card.href} className="block group" onClick={() => {
            if (card.href.endsWith('/create-site')) {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('intentional_create_site_access', 'true')
              }
            }
          }}>
            <Card className={`h-full shadow-sm hover:shadow-md transition-all duration-200 border-border/50 ${
              card.isPrimary
                ? 'bg-primary/5 dark:bg-primary/10' 
                : 'bg-white dark:bg-background'
            }`}>
              <CardContent className="p-5 flex flex-col h-full relative">
                <div className="mb-4 flex items-center justify-between">
                  {card.icon}
                  <div className="flex gap-2 items-center">
                    {(card.newCount ?? 0) > 0 && (
                      <span className="flex items-center justify-center bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {card.newCount} {t("common.new") || "New"}
                      </span>
                    )}
                    {card.count !== undefined && (
                      <span className="flex items-center justify-center bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full min-w-[24px]">
                        {card.count}
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-foreground text-[15px] mb-1 group-hover:text-primary transition-colors">
                  {card.title}
                </h3>
                <p className="text-[13px] text-muted-foreground leading-snug">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          </HomeLink>
        ))}
      </div>

      {/* Recent Reservations */}
      {!isLoading && data?.recentReservations && data.recentReservations.length > 0 && (
        <div className="flex flex-col gap-4 mt-4">
          <h2 className="text-lg font-bold tracking-tight">
            {t("buyer.home.reservations.recent") || "Recent reservations"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-80 hover:opacity-100 transition-opacity">
            {data.recentReservations.map((reservation) => {
              const imageUrl = reservation.entitlement?.catalog_item?.image_url || reservation.catalog_item?.image_url
              return (
                <HomeLink demo={!!demoSummary} key={reservation.id} href={`/buyer/reservations/${reservation.id}`} className="block group">
                  <Card className="border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 bg-card/50 rounded-2xl group-hover:-translate-y-0.5 overflow-hidden">
                    <CardContent className="p-0 flex items-stretch">
                      {/* Left Icon / Date Block */}
                      <div className="w-20 shrink-0 border-r border-border/50 bg-muted/50 flex flex-col items-center justify-center relative overflow-hidden group-hover:bg-primary/5 transition-colors">
                        {imageUrl && (
                          <div className="absolute inset-0 opacity-15 mix-blend-luminosity grayscale">
                            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="relative z-10 flex flex-col items-center text-center">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary/80 mb-0.5 transition-colors">
                            {new Date(reservation.start_time).toLocaleString(undefined, { month: 'short' })}
                          </span>
                          <span className="text-2xl font-black text-muted-foreground group-hover:text-primary leading-none transition-colors">
                            {new Date(reservation.start_time).getDate()}
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 p-4 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h3 className="font-bold text-[16px] truncate text-muted-foreground group-hover:text-primary transition-colors leading-tight">
                            {reservation.catalog_item?.name || "Reservation"}
                          </h3>
                          <span className="shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-green-500/10 text-green-700 dark:text-green-400">
                            {t("buyer.reservations.status.completed") || "Completed"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-border/50">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                            <span className="capitalize">
                              {new Date(reservation.start_time).toLocaleDateString(undefined, { weekday: 'long' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground/80">
                            <Clock className="w-4 h-4 text-muted-foreground/60" />
                            <span className="font-medium">
                              {new Date(reservation.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              <span className="mx-1.5 text-muted-foreground/40">-</span>
                              {new Date(reservation.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </HomeLink>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
