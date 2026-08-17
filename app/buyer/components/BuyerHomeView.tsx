"use client"

import React from "react"
import Link from "next/link"
import useSWR from "swr"
import { getBuyerPortalSummary } from "../actions"
import { 
  Repeat, 
  FileText, 
  Archive, 
  ShoppingCart, 
  User,
  Video,
  Ticket,
  File as FileIcon,
  CheckCircle2,
  Calendar,
  Clock,
  QrCode,
  Store
} from "@/app/components/ui/icons"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { isDemoSiteId } from "@/lib/demo-utils"
import QRCode from "react-qr-code"

export function BuyerHomeView({
  scope = "personal",
  ownerSiteId,
  basePath = "/buyer"
}: {
  scope?: "personal" | "site"
  ownerSiteId?: string
  basePath?: string
}) {
  const { t } = useLocalization()
  const { sites } = useSite()
  const managedSites = (sites || []).filter((site) => !isDemoSiteId(site.id))
  const hasBusinesses = managedSites.length > 0
  // Workspace (projects/create-site) lives on app; buyer commerce is proxied under www.
  const workspaceUrl = 'https://app.makinari.com'
  
  const { data, error, isLoading } = useSWR(
    { key: "buyer-portal-summary", scope, ownerSiteId },
    async (params) => {
      const res = await getBuyerPortalSummary({ scope: params.scope, ownerSiteId: params.ownerSiteId })
      if (res.error) throw new Error(res.error)
      return res
    }
  )

  if (error) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center h-full">
        <p className="text-red-500">{t('buyer.home.failedToLoad') || 'Failed to load account details.'}</p>
      </div>
    )
  }

  let settingsCards = [
    ...(scope === "personal" ? [{
      title: hasBusinesses
        ? (t("buyer.home.cards.businesses.title") || "Manage your businesses")
        : (t("buyer.home.cards.startSelling.title") || "Start selling"),
      description: hasBusinesses
        ? (t("buyer.home.cards.businesses.desc") || "Switch businesses or create a new one.")
        : (t("buyer.home.cards.startSelling.desc") || "Create your business and start selling on Makinari."),
      icon: <Store className="w-6 h-6 text-foreground/70" />,
      href: hasBusinesses ? `${workspaceUrl}/projects?manage=1` : `${workspaceUrl}/create-site`,
      isPrimary: true,
      count: hasBusinesses ? managedSites.length : undefined,
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
    {
      title: t("buyer.home.cards.visits.title") || "Register a visit",
      description: t("buyer.home.cards.visits.desc") || "Accept Visit Terms and check in online.",
      icon: <Calendar className="w-6 h-6 text-foreground/70" />,
      href: `${basePath}/visits/new`,
      alwaysShow: true
    }
  ]

  // Filter cards based on counts, always keep alwaysShow cards
  if (data) {
    settingsCards = settingsCards.filter(card => card.alwaysShow || (card.count !== undefined && card.count > 0))
  }

  const userName = data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || data?.user?.user_metadata?.first_name || 'User'
  const userEmail = data?.user?.email || ''
  const avatarUrl = data?.user?.user_metadata?.avatar_url || data?.user?.user_metadata?.picture
  const initial = userName.charAt(0).toUpperCase()

  return (
    <div className="flex flex-col w-full gap-8 py-4 md:py-8 px-4">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shrink-0 border shadow-sm overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-medium text-muted-foreground">
              {initial}
            </span>
          )}
        </div>
        <div className="flex-1">
          {isLoading ? (
            <>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32 mt-1" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">{userName}</h1>
              <p className="text-muted-foreground text-sm mt-1">{userEmail}</p>
            </>
          )}
        </div>
        {/* Digital Wallet Pass Modal */}
        {!isLoading && scope === "personal" && data?.user?.id && (
          <div className="ml-auto flex items-center shrink-0">
            <Dialog>
              <DialogTrigger asChild>
                <button className="group relative flex items-center gap-3 bg-white dark:bg-zinc-900 border shadow-sm hover:shadow-md pl-2 pr-4 h-16 rounded-2xl transition-all hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 shrink-0">
                  <div className="bg-white border rounded-md p-1 shadow-sm overflow-hidden flex-shrink-0 group-hover:scale-[1.02] transition-transform">
                    <QRCode value={`mf:user:${data.user.id}`} size={36} className="rounded-sm" />
                  </div>
                  <div className="flex flex-col text-left justify-center pr-1 whitespace-nowrap min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors leading-none mb-0.5">
                      {t("buyer.home.memberPass") || "Member Pass"}
                    </span>
                    <span className="text-sm font-semibold text-foreground leading-none">
                      {t("buyer.home.scanToUse") || "Tap to scan"}
                    </span>
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm p-0 border-0 bg-transparent shadow-none">
                {/* Badge Container */}
                <div className="relative bg-[#f9fafb] dark:bg-zinc-900 rounded-[1.5rem] shadow-2xl flex flex-col overflow-hidden border border-black/10 dark:border-white/10 mt-4 ring-1 ring-black/5 dark:ring-white/5">
                  {/* Glossy Plastic Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 pointer-events-none z-20 mix-blend-overlay"></div>

                  {/* Lanyard Hole (Simulated cutout) */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-14 h-3 rounded-full bg-black/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] z-30 border-b border-white/20"></div>
                  
                  {/* Top Color Band */}
                  <div className="bg-primary h-28 w-full relative border-b border-black/5 dark:border-white/5">
                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/20 to-transparent"></div>
                  </div>

                  {/* Profile Info */}
                  <div className="flex flex-col items-center px-6 pb-2 -mt-12 relative z-10">
                    <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)] border-4 border-white dark:border-zinc-800">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={userName} className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <span className="text-3xl font-medium text-foreground">
                          {initial}
                        </span>
                      )}
                    </div>
                    <DialogTitle className="text-2xl font-black text-foreground tracking-tight leading-none mb-1 text-center">
                      {userName}
                    </DialogTitle>
                    <p className="text-sm font-medium text-muted-foreground text-center">
                      {userEmail}
                    </p>
                  </div>

                  {/* ID/Role Label */}
                  <div className="flex justify-center mt-2 mb-6">
                    <div className="bg-foreground/5 dark:bg-foreground/20 px-4 py-1.5 rounded-md border border-foreground/10 shadow-inner">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/70">
                        {t("buyer.home.memberPass") || "MEMBER PASS"}
                      </span>
                    </div>
                  </div>

                  {/* QR Section */}
                  <div className="px-6 pb-10 flex flex-col items-center">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/10 ring-1 ring-black/5 mb-4">
                      <QRCode value={`mf:user:${data.user.id}`} size={180} className="rounded-md" />
                    </div>
                    <p className="text-xs text-center text-muted-foreground font-medium max-w-[200px]">
                      {t("buyer.home.qrHelper") || "Show this code at the venue"}
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Active Reservations */}
      {!isLoading && data?.activeReservations && data.activeReservations.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold tracking-tight">
            {t("buyer.home.reservations.title") || "Upcoming reservations"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.activeReservations.map((reservation: any) => {
              const imageUrl = reservation.entitlement?.catalog_item?.image_url || reservation.catalog_item?.image_url
              return (
                <Link key={reservation.id} href={`${basePath}/reservations/${reservation.id}`} className="block group">
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
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsCards.map((card, i) => (
          <Link key={i} href={card.href} className="block group" onClick={() => {
            if (card.href.endsWith('/create-site')) {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('intentional_create_site_access', 'true')
              }
            }
          }}>
            <Card className={`h-full shadow-sm hover:shadow-md transition-all duration-200 border-border/50 ${
              (card as any).isPrimary 
                ? 'bg-primary/5 dark:bg-primary/10' 
                : 'bg-white dark:bg-background'
            }`}>
              <CardContent className="p-5 flex flex-col h-full relative">
                <div className="mb-4 flex items-center justify-between">
                  {card.icon}
                  <div className="flex gap-2 items-center">
                    {(card.newCount ?? 0) > 0 && (
                      <span className="flex items-center justify-center bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {card.newCount} {t("common.new") || "Nuevos"}
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
          </Link>
        ))}
      </div>

      {/* Recent Reservations */}
      {!isLoading && data?.recentReservations && data.recentReservations.length > 0 && (
        <div className="flex flex-col gap-4 mt-4">
          <h2 className="text-lg font-bold tracking-tight">
            {t("buyer.home.reservations.recent") || "Recent reservations"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-80 hover:opacity-100 transition-opacity">
            {data.recentReservations.map((reservation: any) => {
              const imageUrl = reservation.entitlement?.catalog_item?.image_url || reservation.catalog_item?.image_url
              return (
                <Link key={reservation.id} href={`${basePath}/reservations/${reservation.id}`} className="block group">
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
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
