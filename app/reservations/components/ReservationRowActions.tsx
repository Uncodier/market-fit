"use client"

import { useRouter } from "next/navigation"
import useSWR from "swr"
import type { Reservation } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import {
  MoreHorizontal,
  CalendarCheck,
  Ban,
  CheckCircle,
  ClipboardList,
  Pencil,
  RotateCcw,
} from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getVisitsSettings } from "@/app/visits/actions"
import { reservationCanRegisterVisitor } from "@/app/visits/visit-helpers"
import { reservationCanEdit, reservationCanRestore } from "../reservation-helpers"

export function ReservationRowActions({
  reservation,
  siteId,
  updating,
  onStatusChange,
  onEdit,
}: {
  reservation: Reservation
  siteId: string
  updating: boolean
  onStatusChange: (id: string, status: Reservation["status"]) => void
  onEdit?: (reservation: Reservation) => void
}) {
  const { t } = useLocalization()
  const router = useRouter()
  const { data: settingsData } = useSWR(siteId ? ["visits-settings", siteId] : null, () =>
    getVisitsSettings(siteId)
  )
  const settings = settingsData?.data
  const canRegister =
    Boolean(settings) && reservationCanRegisterVisitor(settings!, reservation)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          disabled={updating}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{t("reservations.table.actions") || "Actions"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit && reservationCanEdit(reservation) && (
          <DropdownMenuItem onClick={() => onEdit(reservation)}>
            <Pencil className="h-4 w-4 mr-2" /> {t("reservations.actions.edit") || "Edit"}
          </DropdownMenuItem>
        )}
        {reservation.status === "pending" && (
          <DropdownMenuItem onClick={() => onStatusChange(reservation.id, "confirmed")}>
            <CalendarCheck className="h-4 w-4 mr-2" /> {t("reservations.actions.confirm")}
          </DropdownMenuItem>
        )}
        {canRegister && (
          <DropdownMenuItem
            onClick={() => router.push(`/visits?reservationId=${reservation.id}`)}
          >
            <ClipboardList className="h-4 w-4 mr-2" /> {t("reservations.actions.registerVisitor")}
          </DropdownMenuItem>
        )}
        {reservation.status === "confirmed" && (
          <DropdownMenuItem onClick={() => onStatusChange(reservation.id, "completed")}>
            <CheckCircle className="h-4 w-4 mr-2" /> {t("reservations.actions.markCompleted")}
          </DropdownMenuItem>
        )}
        {reservation.status !== "cancelled" && (
          <DropdownMenuItem
            onClick={() => onStatusChange(reservation.id, "cancelled")}
            className="text-red-600 focus:text-red-600"
          >
            <Ban className="h-4 w-4 mr-2" /> {t("reservations.actions.cancel")}
          </DropdownMenuItem>
        )}
        {reservationCanRestore(reservation) && (
          <DropdownMenuItem onClick={() => onStatusChange(reservation.id, "confirmed")}>
            <RotateCcw className="h-4 w-4 mr-2" /> {t("reservations.actions.restore") || "Restore"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
