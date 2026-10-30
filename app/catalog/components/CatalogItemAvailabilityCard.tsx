"use client"

import type { Dispatch, SetStateAction } from "react"
import type { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent } from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/app/components/ui/select"
import { Switch } from "@/app/components/ui/switch"

export function CatalogItemAvailabilityCard({ formData, setFormData, handleSave, saving }: {
  formData: Partial<CatalogItem>
  setFormData: Dispatch<SetStateAction<Partial<CatalogItem>>>
  handleSave: () => Promise<void>
  saving: boolean
}) {
  const { t } = useLocalization()
  return (
              <SectionCard>
                <SectionCardHeader>
                  <SectionCardTitle>{t('catalog.form.availabilityInventory') || 'Availability & Inventory'}</SectionCardTitle>
                </SectionCardHeader>
                <SectionCardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('catalog.form.availabilityMode') || 'Availability Mode'}</Label>
                    <Select
                      value={formData.availability_mode || 'always'}
                      onValueChange={(val: NonNullable<CatalogItem["availability_mode"]>) => setFormData({...formData, availability_mode: val})}
                    >
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">{t('catalog.form.availability.always') || 'Always Available'}</SelectItem>
                        <SelectItem value="inventory">{t('catalog.form.availability.inventory') || 'Based on Inventory'}</SelectItem>
                        <SelectItem value="manual">{t('catalog.form.availability.manual') || 'Manual Status'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.availability_mode === 'manual' && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label>{t('catalog.form.manualStatus') || 'Manual Status'}</Label>
                      <Select
                        value={formData.availability_status || 'available'}
                        onValueChange={(val: NonNullable<CatalogItem["availability_status"]>) => setFormData({...formData, availability_status: val})}
                      >
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">{t('catalog.status.available') || 'Available'}</SelectItem>
                          <SelectItem value="unavailable">{t('catalog.status.unavailable') || 'Unavailable'}</SelectItem>
                          <SelectItem value="sold_out">{t('catalog.status.soldOut') || 'Sold Out'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-4 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="track_inventory" className="text-base cursor-pointer">{t('catalog.form.trackInventory') || 'Track inventory levels'}</Label>
                        <p className="text-sm text-muted-foreground">{t('catalog.form.trackInventoryHint') || 'Keep counts per location'}</p>
                      </div>
                      <Switch
                        id="track_inventory"
                        checked={formData.track_inventory || false}
                        onCheckedChange={(checked) => setFormData({...formData, track_inventory: checked as boolean})} />
                    </div>
                  </div>
                </SectionCardContent>
                <ActionFooter>
                  <Button variant="outline" onClick={handleSave} disabled={saving} size="sm">{saving ? (t('common.saving') || 'Saving...') : (t('common.saveChanges') || 'Save Changes')}</Button>
                </ActionFooter>
              </SectionCard>
  )
}
