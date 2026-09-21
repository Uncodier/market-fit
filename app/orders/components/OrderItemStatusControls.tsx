"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { ChevronDown, ClipboardList, Loader2 } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { ORDER_LINE_STATUS_STYLES } from "./order-invoice-helpers"

const STATUS_OPTIONS = [
  "draft",
  "new",
  "preparing",
  "completed",
  "returned",
  "cancelled",
] as const

type Props = {
  value: string
  disabled?: boolean
  className?: string
  onValueChange: (status: string) => void
}

export function OrderItemStatusSelect({
  value,
  disabled,
  className,
  onValueChange,
}: Props) {
  const { t } = useLocalization()
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          "h-8 text-[10px] uppercase tracking-wider",
          ORDER_LINE_STATUS_STYLES[value || "draft"],
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((status) => (
          <SelectItem key={status} value={status} className="text-xs">
            {t(`orders.status.${status}`) || status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function OrderItemsBulkStatusMenu({
  disabled,
  loading,
  onValueChange,
}: {
  disabled?: boolean
  loading?: boolean
  onValueChange: (status: string) => void
}) {
  const { t } = useLocalization()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-full px-3 text-xs"
          disabled={disabled || loading}
          aria-label={t("orders.detail.setAllItemStatuses")}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ClipboardList className="h-3.5 w-3.5" />
          )}
          {t("orders.detail.setAllStatus")}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {t("orders.detail.setAllItemStatuses")}
        </DropdownMenuLabel>
        {STATUS_OPTIONS.map((status) => (
          <DropdownMenuItem
            key={status}
            onSelect={() => onValueChange(status)}
          >
            {t(`orders.status.${status}`) || status}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
