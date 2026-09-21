"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { Button } from "@/app/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { ChevronDown, Loader2, Users } from "@/app/components/ui/icons"
import type { OrderLineAssignee } from "../types"

interface OrderLineAssigneePickerProps {
  members: OrderLineAssignee[]
  value?: string | null
  bulk?: boolean
  disabled?: boolean
  loading?: boolean
  onValueChange: (assigneeId: string | null) => void
}

function avatarName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name
}

export function OrderLineAssigneePicker({
  members,
  value,
  bulk = false,
  disabled = false,
  loading = false,
  onValueChange,
}: OrderLineAssigneePickerProps) {
  const { t } = useLocalization()
  const selected = members.find((member) => member.id === value)
  const selectedLabel = selected?.name || t("orderLines.assignee.unassigned")
  const triggerLabel = bulk
    ? selected
      ? `${t("orderLines.assignee.assignAll")}: ${selected.name}`
      : t("orderLines.assignee.assignAll")
    : selectedLabel

  return (
    <div
      data-row-interactive="true"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={bulk ? "outline" : "ghost"}
            size="sm"
            className={
              bulk
                ? "h-8 max-w-[210px] gap-1.5 rounded-full px-3 text-xs"
                : "h-8 max-w-[160px] gap-1.5 px-2 text-xs"
            }
            disabled={disabled || loading}
            aria-label={
              bulk
                ? t("orderLines.assignee.assignAll")
                : `${t("orderLines.assignee.assignedTo")}: ${selectedLabel}`
            }
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : selected ? (
              <EntityAvatar
                name={avatarName(selected.name)}
                className="h-5 w-5 text-[9px]"
              />
            ) : (
              <Users className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={bulk ? "end" : "start"} className="w-64">
          <DropdownMenuLabel>
            {bulk
              ? t("orderLines.assignee.assignAllTitle")
              : t("orderLines.assignee.select")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={value || (bulk ? "__bulk__" : "unassigned")}
            onValueChange={(nextValue) =>
              onValueChange(nextValue === "unassigned" ? null : nextValue)
            }
          >
            <DropdownMenuRadioItem
              value="unassigned"
              className="gap-2"
              aria-label={t("orderLines.assignee.unassigned")}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              {t("orderLines.assignee.unassigned")}
            </DropdownMenuRadioItem>
            {members.map((member) => (
              <DropdownMenuRadioItem
                key={member.id}
                value={member.id}
                className="gap-2"
                aria-label={member.name}
              >
                <EntityAvatar
                  name={avatarName(member.name)}
                  className="h-6 w-6 text-[9px]"
                />
                <span className="truncate">{member.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
