"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Switch } from "@/app/components/ui/switch"
import { toast } from "sonner"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { useDirtyDialogClose } from "@/app/components/ui/use-dirty-dialog-close"
import { useSite } from "@/app/context/SiteContext"
import { upsertCatalogItem, listCatalogCategories } from "../actions"
import { CatalogCategory } from "@/app/types"
import { ImageUpload } from "@/app/components/ui/image-upload"
import { useLocalization } from "@/app/context/LocalizationContext"
import { COMMON_CURRENCIES } from "@/app/lib/currencies"

import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"

interface CreateCatalogItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FormData = {
  name: string
  kind: 'product' | 'service' | 'digital_asset'
  digital_subtype?: 'ticket' | 'course' | 'file' | 'pass' | 'license' | 'none'
  is_marketplace_listed: boolean
  sku: string
  target_sale_price: string
  currency: string
  cost: string
  availability_mode: 'manual' | 'inventory' | 'always'
  track_inventory: boolean
  category_value: RelationSelectValue
  is_pos_available: boolean
  is_recurring: boolean
  is_reservation: boolean
  image_url?: string
}

function emptyCreateCatalogForm(currency: string): FormData {
  return {
    name: '',
    kind: 'product',
    digital_subtype: 'none',
    is_marketplace_listed: true,
    sku: '',
    target_sale_price: '',
    currency,
    cost: '',
    availability_mode: 'manual',
    track_inventory: false,
    category_value: null,
    is_pos_available: true,
    is_recurring: false,
    is_reservation: false,
  }
}

export function CreateCatalogItemDialog({ open, onOpenChange, onSuccess }: CreateCatalogItemDialogProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [image, setImage] = useState<string>('')
  const siteCurrency = currentSite?.settings?.currency || 'USD'
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<FormData>({
    defaultValues: emptyCreateCatalogForm(siteCurrency),
  })

  const { discardOpen, setDiscardOpen, handleOpenChange, confirmDiscard } =
    useDirtyDialogClose({
      dirty: isDirty || Boolean(image),
      busy: isSubmitting,
      onOpenChange,
    })

  useEffect(() => {
    if (!open) return
    setValue('currency', siteCurrency, { shouldDirty: false })
  }, [open, siteCurrency, setValue])

  useEffect(() => {
    if (!open || !currentSite) return
    listCatalogCategories(currentSite.id).then(res => {
      if (res.data) setCategories(res.data as CatalogCategory[])
    })
  }, [open, currentSite])

  const kind = watch('kind')
  const mode = watch('availability_mode')
  const trackInventory = watch('track_inventory')
  const categoryValue = watch('category_value')
  const isPos = watch('is_pos_available')
  const isRecurring = watch('is_recurring')
  const isReservation = watch('is_reservation')

  const onSubmit = async (data: FormData) => {
    if (!currentSite) return
    setIsSubmitting(true)

    try {
      const { id: resolvedCategoryId, error: catError } = await resolveRelationId("catalog_category", data.category_value, currentSite.id)
      if (catError) throw new Error(`Category error: ${catError}`)

      const res = await upsertCatalogItem({
        site_id: currentSite.id,
        name: data.name,
        kind: data.kind,
        digital_subtype: data.digital_subtype === 'none' ? undefined : (data.digital_subtype || undefined),
        is_marketplace_listed: data.is_marketplace_listed,
        sku: data.sku || undefined,
        target_sale_price: data.target_sale_price ? parseFloat(data.target_sale_price) : undefined,
        currency: data.currency || siteCurrency,
        cost: data.cost ? parseFloat(data.cost) : undefined,
        availability_mode: data.availability_mode,
        track_inventory: data.track_inventory,
        status: 'active',
        availability_status: 'available',
        category_id: resolvedCategoryId || undefined,
        is_pos_available: data.is_pos_available,
        is_recurring: data.is_recurring,
        is_reservation: data.is_reservation,
        image_url: image || undefined,
        metadata: {
          delivery_options: data.kind === 'product' ? ['pickup', 'ship'] : ['none'],
        }
      })

      if (res.error) throw new Error(res.error)

      toast.success('Catalog item created successfully')
      reset(emptyCreateCatalogForm(siteCurrency))
      setImage('')
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create item')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" busy={isSubmitting}>
        <DialogHeader>
          <DialogTitle>{t("catalog.create.title") || "Add to Catalog"}</DialogTitle>
          <DialogDescription>
            Create a new product or service for your catalog.
          </DialogDescription>
        </DialogHeader>

        <DialogForm onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-6">
          <div className="space-y-2">
            <Label>{t("catalog.create.image") || "Image"}</Label>
            <ImageUpload 
              value={image} 
              onChange={setImage} 
              onRemove={() => setImage('')} 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label htmlFor="kind">{t("catalog.create.type") || "Type"}</Label>
              <Select 
                value={kind} 
                onValueChange={(val: any) => setValue('kind', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">{t("catalog.create.product") || "Physical Product"}</SelectItem>
                  <SelectItem value="service">{t("catalog.create.service") || "Service"}</SelectItem>
                  <SelectItem value="digital_asset">{t("catalog.create.digitalAsset") || "Digital Asset"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {kind === 'digital_asset' && (
              <div className="space-y-2 col-span-2 md:col-span-1">
                <Label htmlFor="digital_subtype">{t("catalog.create.digitalSubtype") || "Digital Subtype"}</Label>
                <Select 
                  value={watch('digital_subtype')} 
                  onValueChange={(val: any) => setValue('digital_subtype', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("common.none") || "None"}</SelectItem>
                    <SelectItem value="ticket">{t("catalog.create.ticket") || "Ticket"}</SelectItem>
                    <SelectItem value="course">{t("catalog.create.course") || "Course"}</SelectItem>
                    <SelectItem value="file">{t("catalog.create.file") || "File"}</SelectItem>
                    <SelectItem value="pass">{t("catalog.create.pass") || "Pass"}</SelectItem>
                    <SelectItem value="license">{t("catalog.create.license") || "License"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className={`space-y-2 col-span-2 ${kind === 'digital_asset' ? 'md:col-span-2' : 'md:col-span-1'}`}>
              <Label htmlFor="category_value">{t("catalog.create.category") || "Category"}</Label>
              <RelationSelect 
                options={categories.map(cat => ({ id: cat.id, label: cat.name }))}
                value={categoryValue} 
                onValueChange={(val) => setValue('category_value', val, { shouldValidate: true })}
                placeholder="Select category..."
                emptyMessage="No categories found"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label htmlFor="name">{t("catalog.create.name") || "Name"}</Label>
              <Input 
                id="name" 
                placeholder={kind === 'product' ? "e.g. Classic T-Shirt" : "e.g. 1hr Consultation"} 
                {...register("name", { required: "Name is required" })} 
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label htmlFor="sku">{t("catalog.create.sku") || "SKU / Code (Optional)"}</Label>
              <Input id="sku" placeholder="e.g. TSHIRT-01" {...register("sku")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2 flex flex-col justify-start">
              <div className="min-h-[40px] flex items-end">
                <Label htmlFor="target_sale_price" className="leading-tight">{t("catalog.create.defaultSalePrice") || "Default Sale Price"}</Label>
              </div>
              <Input 
                id="target_sale_price" 
                type="number" 
                step="0.01" 
                min="0"
                placeholder="0.00" 
                {...register("target_sale_price")} 
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("catalog.item.priceHint") || "If left blank, pricing might be dynamic."}
              </p>
            </div>
            <div className="space-y-2 flex flex-col justify-start">
              <div className="min-h-[40px] flex items-end">
                <Label htmlFor="currency" className="leading-tight">{t("catalog.create.currency") || "Currency"}</Label>
              </div>
              <Select 
                value={watch('currency')} 
                onValueChange={(val: string) => setValue('currency', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex flex-col justify-start">
              <div className="min-h-[40px] flex items-end">
                <Label htmlFor="cost" className="leading-tight">{t("catalog.create.unitCost") || "Unit Cost"}</Label>
              </div>
              <Input 
                id="cost" 
                type="number" 
                step="0.01" 
                min="0"
                placeholder="0.00" 
                {...register("cost")} 
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium">{t("catalog.create.features") || "Features"}</h4>
            <div className="flex flex-col gap-4">
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is_pos_available" className="text-base cursor-pointer">{t("catalog.create.availableInPos") || "Available in POS"}</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow this item to be sold through the Point of Sale interface.
                  </p>
                </div>
                <Switch 
                  id="is_pos_available" 
                  checked={isPos}
                  onCheckedChange={(checked) => setValue('is_pos_available', checked as boolean)}
                />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is_recurring" className="text-base cursor-pointer">{t("catalog.create.recurring") || "Recurring"}</Label>
                  <p className="text-sm text-muted-foreground">
                    Set up this item as a subscription or recurring payment plan.
                  </p>
                </div>
                <Switch 
                  id="is_recurring" 
                  checked={isRecurring}
                  onCheckedChange={(checked) => setValue('is_recurring', checked as boolean)}
                />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is_reservation" className="text-base cursor-pointer">{t("catalog.create.reservable") || "Reservable"}</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable scheduling and bookings for this item.
                  </p>
                </div>
                <Switch 
                  id="is_reservation" 
                  checked={isReservation}
                  onCheckedChange={(checked) => setValue('is_reservation', checked as boolean)}
                />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is_marketplace_listed" className="text-base cursor-pointer">{t("catalog.create.marketplace") || "Marketplace"}</Label>
                  <p className="text-sm text-muted-foreground">
                    List this item on the public marketplace for customers to purchase.
                  </p>
                </div>
                <Switch 
                  id="is_marketplace_listed" 
                  checked={watch('is_marketplace_listed') ?? true}
                  onCheckedChange={(checked) => setValue('is_marketplace_listed', checked as boolean)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium">{t("catalog.create.availabilityAndInventory") || "Availability & Inventory"}</h4>
            
            <div className="space-y-2">
              <Label htmlFor="availability_mode">{t("catalog.create.availabilityMode") || "How is availability determined?"}</Label>
              <Select 
                value={mode} 
                onValueChange={(val: any) => setValue('availability_mode', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (I toggle Available/Sold Out)</SelectItem>
                  <SelectItem value="inventory">Inventory (Based on stock levels)</SelectItem>
                  <SelectItem value="always">Always Sellable (Never sold out)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="track_inventory" className="text-base cursor-pointer">{t("catalog.create.trackInventory") || "Track inventory levels"}</Label>
                <p className="text-sm text-muted-foreground">
                  Keep a count of how many items are in stock at each location.
                </p>
              </div>
              <Switch 
                id="track_inventory" 
                checked={trackInventory}
                onCheckedChange={(checked) => setValue('track_inventory', checked as boolean)}
              />
            </div>
          </div>

          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (t("common.creating") || "Creating...") : (t("catalog.create.submit") || "Create item")}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard changes?"
        description="Your changes will be lost."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={confirmDiscard}
        dataPermission="allow"
      />
    </Dialog>
  )
}
