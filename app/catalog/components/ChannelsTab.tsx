"use client"

import type { Dispatch, SetStateAction } from "react"
import { CatalogItem } from "@/app/types"
import { isAccessOnlyItem } from "@/app/catalog/product-details"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { ReservationScheduleCard } from "./ReservationScheduleCard"

interface ChannelsTabProps {
  item: CatalogItem | null
  formData: Partial<CatalogItem>
  setFormData: Dispatch<SetStateAction<Partial<CatalogItem>>>
  handleSave: () => void
  saving: boolean
}

export function ChannelsTab({
  item,
  formData,
  setFormData,
  handleSave,
  saving,
}: ChannelsTabProps) {
  const { t } = useLocalization()
  // Passes/plans are access-only: purchase grants access; booking happens later against this calendar.
  // Drop-in services require picking a slot at checkout.
  const isAccessOnly = isAccessOnlyItem(formData as CatalogItem)
  const isPass = formData.kind === "digital_asset" && formData.digital_subtype === "pass"

  return (
    <div className="mx-auto max-w-[800px] space-y-6">
      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>{t("catalog.channels.title") || "Channels & Behavior"}</SectionCardTitle>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_pos_available" className="text-base cursor-pointer">
                {t("catalog.channels.availableInPos") || "Available in POS"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("catalog.channels.availableInPosHelp") || "Show in Point of Sale screens"}
              </p>
            </div>
            <Switch
              id="is_pos_available"
              checked={formData.is_pos_available ?? true}
              onCheckedChange={(checked) => setFormData({...formData, is_pos_available: checked as boolean})}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <Label htmlFor="is_recurring" className="text-base cursor-pointer">
                {t("catalog.channels.recurring") || "Recurring Subscription"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("catalog.channels.recurringHelp") || "Billed on a schedule instead of one-time"}
              </p>
            </div>
            <Switch
              id="is_recurring"
              checked={formData.is_recurring || false}
              onCheckedChange={(checked) => setFormData({...formData, is_recurring: checked as boolean})}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <Label htmlFor="is_reservation" className="text-base cursor-pointer">
                {isAccessOnly
                  ? (t("catalog.channels.masterCalendar") || "Master Calendar")
                  : (t("catalog.channels.requiresReservation") || "Requires Reservation")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {isAccessOnly
                  ? (t("catalog.channels.masterCalendarHelp") || "Owns the schedule members book after purchase — checkout does not require a slot")
                  : (t("catalog.channels.requiresReservationHelp") || "Customer must book a time slot at purchase")}
              </p>
            </div>
            <Switch
              id="is_reservation"
              checked={formData.is_reservation || false}
              onCheckedChange={(checked) => setFormData({...formData, is_reservation: checked as boolean})}
            />
          </div>

          {isPass && (
            <div className="pt-4 border-t space-y-4">
              <div className="space-y-2">
                <Label>{t("catalog.channels.totalUses") || "Total Uses (Empty = Unlimited)"}</Label>
                <Input
                  type="number"
                  value={formData.pass_uses || ''}
                  onChange={e => setFormData({...formData, pass_uses: e.target.value ? parseInt(e.target.value) : null})}
                  placeholder={t("catalog.channels.totalUsesPlaceholder") || "e.g. 10 sessions"}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("catalog.channels.validityDays") || "Validity Days (Empty = Never expires)"}</Label>
                <Input
                  type="number"
                  value={formData.pass_validity_days || ''}
                  onChange={e => setFormData({...formData, pass_validity_days: e.target.value ? parseInt(e.target.value) : null})}
                  placeholder={t("catalog.channels.validityDaysPlaceholder") || "e.g. 30 days"}
                />
              </div>
            </div>
          )}
        </SectionCardContent>
        <ActionFooter>
          <Button variant="outline" onClick={handleSave} disabled={saving} size="sm">
            {t("catalog.channels.saveBehaviors") || "Save Behaviors"}
          </Button>
        </ActionFooter>
      </SectionCard>

      {formData.is_reservation && item && (
        <div className="space-y-4">
          {isAccessOnly && (
            <div className="p-4 bg-muted/30 rounded-xl border text-sm text-muted-foreground flex gap-3">
              <div className="mt-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </div>
              <div>
                <span className="font-medium text-foreground block mb-1">
                  {isPass
                    ? (t("catalog.channels.passAsCalendar") || "Pass as calendar")
                    : (t("catalog.channels.planAsCalendar") || "Plan as calendar")}
                </span>
                {t("catalog.channels.masterCalendarInfo") ||
                  "This item is the master calendar — purchase grants access only; members book slots afterward. Add a separate reservable service only if you also want drop-in sales against the same capacity."}
              </div>
            </div>
          )}
          <ReservationScheduleCard catalogItemId={item.id} />
        </div>
      )}
    </div>
  )
}
