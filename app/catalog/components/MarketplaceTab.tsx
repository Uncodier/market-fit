"use client"

import type { Dispatch, SetStateAction } from "react"
import { CatalogItem } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { ProductPaymentOptionsCard } from "./ProductPaymentOptionsCard"
import { ItemSpecsEditor } from "./ItemSpecsEditor"
import { ReservationScheduleCard } from "./ReservationScheduleCard"

interface MarketplaceTabProps {
  item: CatalogItem | null
  formData: Partial<CatalogItem>
  setFormData: Dispatch<SetStateAction<Partial<CatalogItem>>>
  handleSave: () => void
  saving: boolean
}

export function MarketplaceTab({
  item,
  formData,
  setFormData,
  handleSave,
  saving,
}: MarketplaceTabProps) {
  return (
    <div className="mx-auto max-w-[800px] space-y-6">
      {item && (
        <ProductPaymentOptionsCard
          formData={formData}
          setFormData={setFormData}
        />
      )}

      {item && (
        <ItemSpecsEditor
          catalogItemId={item.id}
          item={item}
          handleSave={handleSave}
          saving={saving}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Marketplace Listing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_marketplace_listed" className="text-base cursor-pointer">List in Marketplace</Label>
              <p className="text-sm text-muted-foreground">Make visible on the public marketplace</p>
            </div>
            <Switch
              id="is_marketplace_listed"
              checked={formData.is_marketplace_listed ?? true}
              onCheckedChange={(checked) => setFormData({...formData, is_marketplace_listed: checked as boolean})}
            />
          </div>
        </CardContent>
        <ActionFooter>
          <Button variant="outline" onClick={handleSave} disabled={saving}>Save Listing</Button>
        </ActionFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channels & Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_pos_available" className="text-base cursor-pointer">Available in POS</Label>
              <p className="text-sm text-muted-foreground">Show in Point of Sale screens</p>
            </div>
            <Switch
              id="is_pos_available"
              checked={formData.is_pos_available ?? true}
              onCheckedChange={(checked) => setFormData({...formData, is_pos_available: checked as boolean})}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <Label htmlFor="is_recurring" className="text-base cursor-pointer">Recurring Subscription</Label>
              <p className="text-sm text-muted-foreground">Billed on a schedule instead of one-time</p>
            </div>
            <Switch
              id="is_recurring"
              checked={formData.is_recurring || false}
              onCheckedChange={(checked) => setFormData({...formData, is_recurring: checked as boolean})}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <Label htmlFor="is_reservation" className="text-base cursor-pointer">Requires Reservation</Label>
              <p className="text-sm text-muted-foreground">Customer must book a time slot</p>
            </div>
            <Switch
              id="is_reservation"
              checked={formData.is_reservation || false}
              onCheckedChange={(checked) => setFormData({...formData, is_reservation: checked as boolean})}
            />
          </div>

          {formData.kind === 'digital_asset' && formData.digital_subtype === 'pass' && (
            <div className="pt-4 border-t space-y-4">
              <div className="space-y-2">
                <Label>Total Uses (Empty = Unlimited)</Label>
                <Input
                  type="number"
                  value={formData.pass_uses || ''}
                  onChange={e => setFormData({...formData, pass_uses: e.target.value ? parseInt(e.target.value) : null})}
                  placeholder="e.g. 10 sessions"
                />
              </div>
              <div className="space-y-2">
                <Label>Validity Days (Empty = Never expires)</Label>
                <Input
                  type="number"
                  value={formData.pass_validity_days || ''}
                  onChange={e => setFormData({...formData, pass_validity_days: e.target.value ? parseInt(e.target.value) : null})}
                  placeholder="e.g. 30 days"
                />
              </div>
            </div>
          )}
        </CardContent>
        <ActionFooter>
          <Button variant="outline" onClick={handleSave} disabled={saving}>Save Behaviors</Button>
        </ActionFooter>
      </Card>

      {formData.is_reservation && item && (
        <div className="space-y-4">
          {(formData.is_recurring || (formData.kind === 'digital_asset' && formData.digital_subtype === 'pass')) && (
            <div className="p-4 bg-muted/30 rounded-xl border text-sm text-muted-foreground flex gap-3">
              <div className="mt-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              </div>
              <div>
                <span className="font-medium text-foreground block mb-1">Plan as calendar</span>
                This item will act as the master calendar. Members book against this schedule after purchase. You don't need a separate reservable service unless you want to share this capacity with drop-in sales.
              </div>
            </div>
          )}
          <ReservationScheduleCard catalogItemId={item.id} />
        </div>
      )}
    </div>
  )
}
