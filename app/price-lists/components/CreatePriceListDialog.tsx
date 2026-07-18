"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Checkbox } from "@/app/components/ui/checkbox"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { upsertPriceList } from "../actions"

interface CreatePriceListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FormData = {
  name: string
  code: string
  currency: string
  is_default: boolean
  is_active: boolean
}

export function CreatePriceListDialog({ open, onOpenChange, onSuccess }: CreatePriceListDialogProps) {
  const { currentSite } = useSite()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: '',
      code: '',
      currency: 'USD',
      is_default: false,
      is_active: true
    }
  })

  const isDefault = watch('is_default')
  const isActive = watch('is_active')

  const onSubmit = async (data: FormData) => {
    if (!currentSite) return
    setIsSubmitting(true)

    try {
      const res = await upsertPriceList({
        site_id: currentSite.id,
        name: data.name,
        code: data.code || undefined,
        currency: data.currency,
        is_default: data.is_default,
        is_active: data.is_active
      })

      if (res.error) throw new Error(res.error)

      toast.success('Price list created successfully')
      reset()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create list')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Price List</DialogTitle>
          <DialogDescription>
            Add a new pricing tier for your catalog items.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              placeholder="e.g. Wholesale, VIP, Retail" 
              {...register("name", { required: "Name is required" })} 
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code (Optional)</Label>
              <Input id="code" placeholder="WHOLESALE" {...register("code")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" placeholder="USD" {...register("currency", { required: "Currency is required" })} />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center space-x-3">
              <Checkbox 
                id="is_default" 
                checked={isDefault}
                onCheckedChange={(checked) => setValue('is_default', checked as boolean)}
              />
              <Label htmlFor="is_default">Set as default price list</Label>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox 
                id="is_active" 
                checked={isActive}
                onCheckedChange={(checked) => setValue('is_active', checked as boolean)}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create List"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
