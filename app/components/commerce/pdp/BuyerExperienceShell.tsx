"use client"

import Link from "next/link"
import { ArrowLeft, User } from "@/app/components/ui/icons"
import { CommerceShellHeader } from "@/app/components/commerce/CommerceShellHeader"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useLocalization } from "@/app/context/LocalizationContext"

export type BuyerExperienceVariant =
  | "book"
  | "course"
  | "ticket"
  | "downloads"
  | "reservation"

const VARIANT_COPY: Record<
  BuyerExperienceVariant,
  { titleKey: string; titleFallback: string; backKey: string; backFallback: string }
> = {
  book: {
    titleKey: "booking.redeemTitle",
    titleFallback: "Book with Pass",
    backKey: "buyer.experience.backToLibrary",
    backFallback: "Back to library",
  },
  course: {
    titleKey: "buyer.experience.courseTitle",
    titleFallback: "Course",
    backKey: "buyer.experience.backToLibrary",
    backFallback: "Back to library",
  },
  ticket: {
    titleKey: "buyer.experience.ticketTitle",
    titleFallback: "Ticket",
    backKey: "buyer.experience.backToLibrary",
    backFallback: "Back to library",
  },
  downloads: {
    titleKey: "buyer.experience.downloadsTitle",
    titleFallback: "Downloads",
    backKey: "buyer.experience.backToLibrary",
    backFallback: "Back to library",
  },
  reservation: {
    titleKey: "buyer.reservations.title",
    titleFallback: "Reservation Details",
    backKey: "buyer.reservations.back",
    backFallback: "Back to Home",
  },
}

export function BuyerExperienceShell({
  backUrl,
  variant,
  title,
  backLabel,
  children,
  actions,
}: {
  backUrl: string
  variant: BuyerExperienceVariant
  title?: string
  backLabel?: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  const { user } = useAuth()
  const { t } = useLocalization()
  const session = user ? { user } : null
  const copy = VARIANT_COPY[variant]

  const resolvedTitle = title || t(copy.titleKey) || copy.titleFallback
  const resolvedBackLabel = backLabel || t(copy.backKey) || copy.backFallback

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col relative md:max-w-none max-w-[100vw] overflow-x-hidden">
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        brand={
          <Link
            href={backUrl}
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="font-medium">{resolvedBackLabel}</span>
          </Link>
        }
        center={
          <span className="font-black text-xl tracking-tight uppercase truncate">
            {resolvedTitle}
          </span>
        }
        actions={
          actions ??
          (session ? (
            <Link href="/buyer/profile" className="hover:opacity-80 transition-opacity shrink-0">
              {session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture ? (
                <img
                  src={
                    session.user.user_metadata?.avatar_url ||
                    session.user.user_metadata?.picture
                  }
                      alt="Avatar"
                      className="w-8 h-8 min-w-8 rounded-full object-cover border border-border shadow-sm shrink-0"
                />
              ) : (
                <div className="w-8 h-8 min-w-8 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </Link>
          ) : (
            <div />
          ))
        }
      />
      {children}
    </div>
  )
}
