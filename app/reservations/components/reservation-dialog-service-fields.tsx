"use client"

import type { Dispatch, SetStateAction } from "react"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { RelationSelect, type RelationSelectValue } from "@/app/components/ui/relation-select"
import { PosCustomerSelect } from "@/app/pos/components/PosCustomerSelect"
import { Combobox } from "@/app/components/ui/combobox"
import { VariantPicker } from "@/app/components/commerce/pdp/VariantPicker"
import { ModifierPickerPanel } from "@/app/components/commerce/ModifierPickerPanel"
import { ReservationSlotPicker } from "@/app/components/commerce/ReservationSlotPicker"
import { formatSlotDateTime } from "@/app/components/commerce/reservation-slot-utils"
import type { CatalogItem, VariantAxis } from "@/app/types"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import type { CartModifier } from "@/app/commerce/cart-modifiers"
import { resolveProductCurrency } from "@/app/commerce/checkout-currency"

export function ReservationDialogFormSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mx-auto h-6 w-52" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  )
}

export function ReservationServiceFields({
  items,
  catalogItemValue,
  setCatalogItemValue,
  catalogItemId,
  loadingVariants,
  loadingModifiers,
  needsVariant,
  modifierGroups,
  axes,
  selectedOptions,
  setSelectedOptions,
  children,
  parentItemObj,
  selectedModifiers,
  setSelectedModifiers,
  t,
  leads,
  leadValue,
  setLeadValue,
  siteId,
  members,
  taskAssignee,
  setTaskAssignee,
  selectedSlot,
  setSelectedSlot,
  sellableItem,
  resolvedChild,
  reservationId,
  initialSlotStart,
  notes,
  setNotes,
  siteCurrency,
}: {
  items: { id: string; name: string }[]
  catalogItemValue: RelationSelectValue
  setCatalogItemValue: (value: RelationSelectValue) => void
  catalogItemId: string
  loadingVariants: boolean
  loadingModifiers: boolean
  needsVariant: boolean
  modifierGroups: ModifierGroupWithItems[]
  axes: VariantAxis[]
  selectedOptions: Record<string, string>
  setSelectedOptions: Dispatch<SetStateAction<Record<string, string>>>
  children: CatalogItem[]
  parentItemObj: CatalogItem | null
  selectedModifiers: CartModifier[]
  setSelectedModifiers: (value: CartModifier[]) => void
  t: (key: string, params?: Record<string, string | number>) => string
  leads: any[]
  leadValue: RelationSelectValue
  setLeadValue: (value: RelationSelectValue) => void
  siteId: string
  members: { user_id: string; name?: string; email?: string }[]
  taskAssignee: string
  setTaskAssignee: (value: string) => void
  selectedSlot: { start: string; end: string; timezone?: string } | null
  setSelectedSlot: (slot: { start: string; end: string; timezone?: string } | null) => void
  sellableItem: CatalogItem | null
  resolvedChild: CatalogItem | null
  reservationId?: string
  initialSlotStart?: string
  notes: string
  setNotes: (value: string) => void
  siteCurrency?: string | null
}) {
  const displayCurrency = resolveProductCurrency(
    sellableItem?.currency || parentItemObj?.currency,
    siteCurrency,
  )
  return (
    <>
      <div className="space-y-2">
        <Label>{t("reservations.field.service") || "Service"}</Label>
        <RelationSelect
          options={items.map((item) => ({
            id: item.id,
            label: item.name,
          }))}
          value={catalogItemValue}
          onValueChange={(value) => {
            setCatalogItemValue(value)
            if (!reservationId && !initialSlotStart) setSelectedSlot(null)
          }}
          allowCreate={false}
          placeholder={t("reservations.placeholder.selectService") || "Select a reservable service..."}
          emptyMessage={t("reservations.placeholder.noServices") || "No reservable services found"}
        />
      </div>

      {catalogItemId && (loadingVariants || loadingModifiers) ? (
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        </div>
      ) : catalogItemId && (needsVariant || modifierGroups.length > 0) ? (
        <>
          {needsVariant && (
            <div className="[&_.mb-8]:mb-0 [&_.space-y-8]:space-y-4 [&_section]:p-4 [&_section]:rounded-2xl [&_.grid]:!grid-cols-1">
              <VariantPicker
                axes={axes}
                selectedOptions={selectedOptions}
                onOptionSelect={(axisId, valueId) =>
                  setSelectedOptions((prev) => ({ ...prev, [axisId]: valueId }))
                }
                childrenItems={children}
                presentation="pdp"
                currency={displayCurrency}
              />
            </div>
          )}
          {modifierGroups.length > 0 && (
            <div className="space-y-2">
              {!needsVariant ? null : (
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("pos.modifiers.title") || "Add extras"}
                </h4>
              )}
              <ModifierPickerPanel
                groups={modifierGroups}
                value={selectedModifiers}
                onChange={setSelectedModifiers}
                resolvePrice={(id, price) => price}
                currency={displayCurrency}
              />
            </div>
          )}
        </>
      ) : null}

      <div className="space-y-2">
        <Label>{t("reservations.field.customer") || "Customer"}</Label>
        <PosCustomerSelect
          leads={leads}
          leadValue={leadValue}
          setLeadValue={setLeadValue}
          siteId={siteId}
          t={t}
          clearable={false}
          placeholder={t("reservations.placeholder.selectCustomer") || "Select customer..."}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("reservations.field.assigneeOptional") || "Assignee (Optional)"}</Label>
        <Combobox
          options={members.map((m) => ({ value: m.user_id, label: m.name || m.email || m.user_id }))}
          value={taskAssignee}
          onValueChange={setTaskAssignee}
          placeholder={t("reservations.placeholder.assignMember") || "Assign to team member..."}
          emptyMessage={t("reservations.placeholder.noMembers") || "No members found"}
        />
      </div>
      {selectedSlot && !sellableItem ? (
        <p className="text-sm text-muted-foreground">
          {t("reservations.slot.selected") || "Selected:"} {formatSlotDateTime(selectedSlot.start, selectedSlot.timezone, "PPP p", "system")} – {formatSlotDateTime(selectedSlot.end, selectedSlot.timezone, "p", "system")}
        </p>
      ) : null}
      {sellableItem ? (
        <div className="space-y-2">
          <Label>{t("reservations.field.timeSlot") || "Time slot"}</Label>
          <ReservationSlotPicker
            key={`${sellableItem.id}-${reservationId || "new"}-${initialSlotStart || ""}`}
            catalogItemId={sellableItem.id}
            hideDetailsStep
            ignoreReservationId={reservationId}
            selectedStartIso={selectedSlot?.start}
            selectedEndIso={selectedSlot?.end}
            onSelect={(start, end, extra) =>
              setSelectedSlot({ start, end, timezone: extra?.timezone })
            }
          />
          {selectedSlot ? (
            <p className="text-sm text-muted-foreground">
              {t("reservations.slot.selected") || "Selected:"} {formatSlotDateTime(selectedSlot.start, selectedSlot.timezone, "PPP p", "system")} – {formatSlotDateTime(selectedSlot.end, selectedSlot.timezone, "p", "system")}
            </p>
          ) : null}
        </div>
      ) : catalogItemId && needsVariant && !resolvedChild ? (
        <div className="space-y-2">
          <Label>{t("reservations.field.timeSlot") || "Time slot"}</Label>
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {t("reservations.slot.selectOptions") || "Please select options above to see available times."}
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="reservation-notes">{t("reservations.field.notes") || "Notes"}</Label>
        <Textarea
          id="reservation-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t("reservations.placeholder.notes") || "Any special requirements?"}
        />
      </div>
    </>
  )
}
