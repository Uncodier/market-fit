"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogForm,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { createSale } from "@/app/sales/actions"
import { useSite } from "@/app/context/SiteContext"
import { getLeads } from "@/app/leads/actions"
import { getSegments } from "@/app/segments/actions"
import { listLocations } from "@/app/inventory/actions"
import { Location } from "@/app/types"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { findOrCreateLeadForBuyer } from "@/app/commerce/resolve-buyer-lead"
import { BuyerUser } from "@/app/components/commerce/BuyerUserEmailField"
import {
  CreateSaleFields,
  type CreateSaleFormData,
} from "./create-sale-fields"

interface CreateSaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface Lead {
  id: string
  name: string
  email: string
  buyer_user_id?: string | null
}

interface Segment {
  id: string
  name: string
}

export function CreateSaleDialog({ open, onOpenChange, onSuccess }: CreateSaleDialogProps) {
  const { currentSite } = useSite()
  const [loading, setLoading] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [buyerUser, setBuyerUser] = useState<BuyerUser | null>(null)
  const [formData, setFormData] = useState<CreateSaleFormData>({
    title: "",
    productName: "",
    productType: "",
    amount: 0,
    amount_due: 0,
    status: "pending",
    source: "retail",
    leadValue: null,
    segmentValue: null,
    saleDate: new Date(),
    paymentMethod: "cash",
    locationId: null
  })

  useEffect(() => {
    if (open && currentSite?.id) {
      loadLeadsAndSegments()
    }
  }, [open, currentSite?.id])

  const loadLeadsAndSegments = async () => {
    if (!currentSite?.id) return

    setLoadingData(true)
    try {
      const leadsResult = await getLeads(currentSite.id)
      if (leadsResult.error) {
        console.error("Error loading leads:", leadsResult.error)
      } else {
        setLeads(leadsResult.leads?.map(lead => ({
          id: lead.id,
          name: lead.name || lead.email,
          email: lead.email,
          buyer_user_id: (lead as any).buyer_user_id || null
        })) || [])
      }

      const segmentsResult = await getSegments(currentSite.id)
      if (segmentsResult.error) {
        console.error("Error loading segments:", segmentsResult.error)
      } else {
        setSegments(segmentsResult.segments?.map(segment => ({
          id: segment.id,
          name: segment.name
        })) || [])
      }
      const locationsResult = await listLocations(currentSite.id)
      if (locationsResult.error) {
        console.error("Error loading locations:", locationsResult.error)
      } else {
        const loadedLocations = locationsResult.data || []
        setLocations(loadedLocations)

        if (loadedLocations.length === 1) {
          setFormData(prev => ({ ...prev, locationId: loadedLocations[0].id }))
        }
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' || name === 'amount_due' ? parseFloat(value) || 0 : value
    }))
  }

  const handleDateChange = (date: Date) => {
    setFormData(prev => ({
      ...prev,
      saleDate: date
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSite?.id) return

    setLoading(true)
    try {
      let finalLeadId: string | null = null
      let finalBuyerUserId: string | null = null

      if (buyerUser) {
        const res = await findOrCreateLeadForBuyer({
          siteId: currentSite.id,
          email: buyerUser.email,
          name: buyerUser.name,
          buyerUserId: buyerUser.buyerUserId
        })
        if (res.error) throw new Error(`Buyer lead error: ${res.error}`)
        finalLeadId = res.lead?.id || null
        finalBuyerUserId = res.lead?.buyer_user_id || null
      }

      if (!finalLeadId) {
        const { id: resolvedLeadId, error: leadError } = await resolveRelationId("lead", formData.leadValue, currentSite.id)
        if (leadError) throw new Error(`Lead error: ${leadError}`)
        finalLeadId = resolvedLeadId

        if (finalLeadId) {
          const matchingLead = leads.find(l => l.id === finalLeadId)
          if (matchingLead?.buyer_user_id) {
            finalBuyerUserId = matchingLead.buyer_user_id
          }
        }
      }

      const { id: resolvedSegmentId, error: segmentError } = await resolveRelationId("segment", formData.segmentValue, currentSite.id)
      if (segmentError) throw new Error(`Segment error: ${segmentError}`)

      const result = await createSale({
        ...formData,
        saleDate: formData.saleDate.toISOString(),
        leadId: finalLeadId || undefined,
        buyerUserId: finalBuyerUserId || undefined,
        segmentId: resolvedSegmentId || undefined,
        siteId: currentSite.id,
        campaignId: null
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Sale created successfully")
      onOpenChange(false)

      setBuyerUser(null)
      setFormData({
        title: "",
        productName: "",
        productType: "",
        amount: 0,
        amount_due: 0,
        status: "pending",
        source: "retail",
        leadValue: null,
        segmentValue: null,
        saleDate: new Date(),
        paymentMethod: "cash",
        locationId: locations.length === 1 ? locations[0].id : null
      })

      onSuccess?.()
    } catch (error: any) {
      console.error("Error creating sale:", error)
      toast.error(error.message || "Error creating sale")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" busy={loading}>
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Sale</DialogTitle>
            <DialogDescription>
              Add a new sale to your records.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <CreateSaleFields
              formData={formData}
              setFormData={setFormData}
              onChange={handleChange}
              onDateChange={handleDateChange}
              buyerUser={buyerUser}
              setBuyerUser={setBuyerUser}
              leads={leads}
              segments={segments}
              locations={locations}
              loadingData={loadingData}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || loadingData}>
              {loading ? "Creating..." : "Create sale"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
