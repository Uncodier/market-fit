"use client"

import { Badge } from "@/app/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Reservation } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  reservationCustomerName,
  reservationServiceColor,
  reservationServiceName,
} from "../reservation-helpers"

function ReservationStatusDot({ status }: { status: Reservation["status"] }) {
  return (
    <div
      className={cn(
        "w-2 h-2 rounded-full shrink-0",
        status === "completed" && "bg-green-500",
        status === "confirmed" && "bg-blue-500",
        status === "pending" && "bg-yellow-500",
        status === "cancelled" && "bg-red-500"
      )}
    />
  )
}

function getLeadInitials(name: string | undefined | null) {
  if (!name) return "L"
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("")
}

export function ReservationItem({
  reservation,
  onClick,
  showDay,
  showTime,
}: {
  reservation: Reservation
  onClick: (res: Reservation) => void
  showDay?: boolean
  showTime?: boolean
}) {
  const { t } = useLocalization()
  const resDate = new Date(reservation.start_time)
  const timeStr = resDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const dayStr = resDate.getDate().toString()
  const customerName = reservationCustomerName(
    reservation,
    t("reservations.customer.unknown") || "Unknown customer"
  )
  const serviceName = reservationServiceName(
    reservation,
    t("reservations.resource.unknownService") || "Unknown service"
  )
  const serviceColor = reservationServiceColor(reservation)

  return (
    <div
      data-reservation-item
      onClick={() => onClick(reservation)}
      className="cursor-pointer group"
    >
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-2 text-xs w-full pr-2 pl-1 h-auto py-1",
          serviceColor.badge
        )}
      >
        <Avatar className="h-5 w-5 mr-1.5 shrink-0">
          {reservation.buyer_profile?.avatar_url ? (
            <AvatarImage
              src={reservation.buyer_profile.avatar_url}
              alt={customerName}
              className="object-cover"
            />
          ) : null}
          <AvatarFallback className="text-[10px] bg-primary/10">
            {getLeadInitials(customerName)}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 min-w-0 flex flex-col items-start leading-tight">
          <span className="truncate w-full font-medium">{customerName}</span>
          <span className="truncate w-full text-[10px] text-muted-foreground">{serviceName}</span>
        </span>
        {(showDay || showTime) && (
          <span className="text-muted-foreground mr-2 shrink-0">
            {showDay && dayStr}
            {showTime && timeStr}
          </span>
        )}
        <ReservationStatusDot status={reservation.status} />
      </Badge>
    </div>
  )
}
