"use client"

import React, { useEffect, useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { upsertCalendarBlock } from "../calendar-blocks-actions"
import { toast } from "sonner"
import type { CalendarBlock } from "@/app/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { DatePicker } from "@/app/components/ui/date-picker"
import { TimeSelect } from "@/app/components/ui/time-select"
import useSWR from "swr"
import { listCatalogItems } from "@/app/catalog/actions"

interface CreateCalendarBlockDialogProps {
  open: boolean
  block?: CalendarBlock | null
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateCalendarBlockDialog({
  open,
  block,
  onOpenChange,
  onSuccess,
}: CreateCalendarBlockDialogProps) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEdit = !!block

  const [entityType, setEntityType] = useState<"catalog_item" | "user" | "global">("global")
  const [entityValue, setEntityValue] = useState<RelationSelectValue>(null)
  
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [startTime, setStartTime] = useState("09:00")
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [endTime, setEndTime] = useState("17:00")
  const [reason, setReason] = useState("")

  const { data: catalogData } = useSWR(
    open && currentSite && entityType === "catalog_item" ? ["catalog", currentSite.id, "reservable"] : null,
    () => listCatalogItems({ siteId: currentSite!.id, isReservation: true, pageSize: 100 })
  )

  const { data: membersData } = useSWR(
    open && currentSite && entityType === "user" ? ["site_members", currentSite.id] : null,
    async () => {
      const res = await fetch(`/api/site-members/${currentSite!.id}`)
      if (!res.ok) throw new Error("Failed to fetch members")
      return res.json()
    }
  )

  const catalogOptions = useMemo(() => {
    return (catalogData?.data || []).map((item: any) => ({
      id: item.id,
      label: item.name
    }))
  }, [catalogData])

  const memberOptions = useMemo(() => {
    return (membersData?.members || []).map((m: any) => ({
      id: m.user_id,
      label: m.name || m.email || "Unknown User"
    }))
  }, [membersData])

  useEffect(() => {
    if (open) {
      if (block) {
        setEntityType(block.entity_type)
        if (block.entity_id) {
           setEntityValue({ mode: 'existing', id: block.entity_id, query: '' })
        } else {
           setEntityValue(null)
        }
        
        const start = new Date(block.start_time)
        const end = new Date(block.end_time)
        setStartDate(start)
        setStartTime(start.toTimeString().slice(0,5))
        setEndDate(end)
        setEndTime(end.toTimeString().slice(0,5))
        setReason(block.reason || "")
      } else {
        setEntityType("global")
        setEntityValue(null)
        const now = new Date()
        setStartDate(now)
        setStartTime("09:00")
        setEndDate(now)
        setEndTime("17:00")
        setReason("")
      }
    }
  }, [open, block])

  const handleSubmit = async () => {
    if (!currentSite) return
    if (!startDate || !startTime || !endDate || !endTime) {
      toast.error("Please fill in all date and time fields")
      return
    }

    const startIso = new Date(`${startDate.toISOString().split("T")[0]}T${startTime}:00`).toISOString()
    const endIso = new Date(`${endDate.toISOString().split("T")[0]}T${endTime}:00`).toISOString()
    
    if (new Date(startIso) >= new Date(endIso)) {
      toast.error("End time must be after start time")
      return
    }

    let entityId = null
    if (entityType !== "global") {
      if (!entityValue || entityValue.mode !== "existing") {
         toast.error("Please select the target for the block")
         return
      }
      entityId = entityValue.id
    }

    setIsSubmitting(true)
    try {
      const payload: Partial<CalendarBlock> = {
        site_id: currentSite.id,
        entity_type: entityType,
        entity_id: entityId,
        start_time: startIso,
        end_time: endIso,
        reason: reason.trim() || undefined,
      }
      
      if (block) payload.id = block.id

      const res = await upsertCalendarBlock(payload)
      if (res.error) throw new Error(res.error)

      toast.success(isEdit ? "Block updated" : "Block created successfully")
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast.error(error.message || "Failed to save block")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Calendar Block" : "Create Calendar Block"}</DialogTitle>
          <DialogDescription>
            Block time in your calendar for holidays, maintenance, or personal time. This will prevent new reservations from being created during this time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Block Type</Label>
            <Select value={entityType} onValueChange={(val: any) => setEntityType(val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Entire Business (Global)</SelectItem>
                <SelectItem value="catalog_item">Specific Service</SelectItem>
                <SelectItem value="user">Specific User/Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {entityType === "catalog_item" && (
            <div className="space-y-2">
              <Label>Service to Block</Label>
              <RelationSelect
                options={catalogOptions}
                value={entityValue}
                onValueChange={setEntityValue}
                placeholder="Select service..."
              />
            </div>
          )}

          {entityType === "user" && (
            <div className="space-y-2">
              <Label>Staff Member to Block</Label>
              <RelationSelect
                options={memberOptions}
                value={entityValue}
                onValueChange={setEntityValue}
                placeholder="Select user..."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <DatePicker 
                date={startDate} 
                setDate={(date: Date) => setStartDate(date)} 
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Start Time</Label>
              <TimeSelect 
                value={startTime} 
                onValueChange={setStartTime} 
                step={30}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>End Date</Label>
              <DatePicker 
                date={endDate} 
                setDate={(date: Date) => setEndDate(date)} 
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <TimeSelect 
                value={endTime} 
                onValueChange={setEndTime} 
                step={30}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason (Optional)</Label>
            <Input 
              placeholder="e.g. Vacation, Holiday, Cleaning..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : (isEdit ? "Save Changes" : "Create Block")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
