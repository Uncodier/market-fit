"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Checkbox } from "@/app/components/ui/checkbox"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { upsertCatalogItem } from "../actions"

interface CreateCatalogItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FormData = {
  name: string
  kind: 'product' | 'service'
  sku: string
  target_sale_price: string
  cost: string
  availability_mode: 'manual' | 'inventory' | 'always'
  track_inventory: boolean
}

export function CreateCatalogItemDialog({ open, onOpenChange, onSuccess }: CreateCatalogItemDialogProps) {
  const { currentSite } = useSite()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      kind: 'product',
      availability_mode: 'manual',
      track_inventory: false,
      sku: '',
      target_sale_price: '',
      cost: ''
    }
  })

  const kind = watch('kind')
  const mode = watch('availability_mode')
  const trackInventory = watch('track_inventory')

  const onSubmit = async (data: FormData) => {
    if (!currentSite) return
    setIsSubmitting(true)

    try {
      const res = await upsertCatalogItem({
        site_id: currentSite.id,
        name: data.name,
        kind: data.kind,
        sku: data.sku || undefined,
        target_sale_price: data.target_sale_price ? parseFloat(data.target_sale_price) : undefined,
        cost: data.cost ? parseFloat(data.cost) : undefined,
        availability_mode: data.availability_mode,
        track_inventory: data.track_inventory,
        status: 'active',
        availability_status: 'available'
      })

      if (res.error) throw new Error(res.error)

      toast.success('Catalog item created successfully')
      reset()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create item')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add to Catalog</DialogTitle>
          <DialogDescription>
            Create a new product or service for your catalog.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label htmlFor="kind">Type</Label>
              <Select 
                value={kind} 
                onValueChange={(val: any) => setValue('kind', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product (Physical/Digital)</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 col-span-2 md:col-span-1">
              <Label htmlFor="sku">SKU / Code (Optional)</Label>
              <Input id="sku" placeholder="e.g. TSHIRT-01" {...register("sku")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              placeholder={kind === 'product' ? "e.g. Classic T-Shirt" : "e.g. 1hr Consultation"} 
              {...register("name", { required: "Name is required" })} 
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_sale_price">Default Sale Price</Label>
              <Input 
                id="target_sale_price" 
                type="number" 
                step="0.01" 
                min="0"
                placeholder="0.00" 
                {...register("target_sale_price")} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Unit Cost</Label>
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
            <h4 className="text-sm font-medium">Availability & Inventory</h4>
            
            <div className="space-y-2">
              <Label htmlFor="availability_mode">How is availability determined?</Label>
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

            <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <Checkbox 
                id="track_inventory" 
                checked={trackInventory}
                onCheckedChange={(checked) => setValue('track_inventory', checked as boolean)}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="track_inventory">Track inventory levels</Label>
                <p className="text-sm text-gray-500">
                  Keep a count of how many items are in stock at each location.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
