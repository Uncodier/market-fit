"use client"

import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { assignShipmentCourier } from "@/app/shipments/actions"
import { Card, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { User } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { listSiteCouriers, SiteCourier } from "../site-couriers"

interface AssigneeCardProps {
  shipmentId: string
  initialAssignee: string | null | undefined
  onUpdate: (assignee: string | null, name: string | null) => void
}

export function AssigneeCard({ shipmentId, initialAssignee, onUpdate }: AssigneeCardProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()

  const [assignee, setAssignee] = useState<string>(initialAssignee || "unassigned")
  const [saving, setSaving] = useState(false)
  const [siteMembers, setSiteMembers] = useState<SiteCourier[]>([])

  useEffect(() => {
    setAssignee(initialAssignee || "unassigned")
  }, [initialAssignee])

  useEffect(() => {
    if (currentSite) {
      listSiteCouriers(currentSite.id).then(setSiteMembers)
    }
  }, [currentSite])

  const handleSave = async () => {
    if (!currentSite) return
    setSaving(true)
    const newAssignee = assignee === "unassigned" ? null : assignee
    const { data, error } = await assignShipmentCourier(currentSite.id, shipmentId, newAssignee)

    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success(t("shipments.assigneeUpdated") || "Assignee updated")
      const newName = newAssignee
        ? siteMembers.find((m) => m.id === newAssignee)?.name || null
        : null
      onUpdate(newAssignee, newName)
    }
    setSaving(false)
  }

  const isDirty = (initialAssignee || "unassigned") !== assignee

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <div className="text-xs text-muted-foreground font-medium mb-2 flex items-center justify-between">
            {t("shipments.assignedTo") || "COURIER"}
            {isDirty && (
              <Button
                size="sm"
                variant="secondary"
                className="h-6 text-xs px-2"
                onClick={handleSave}
                disabled={saving}
              >
                {t("common.save") || "Save"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="h-8 border-none bg-transparent hover:bg-muted/50 focus:ring-0 shadow-none px-2 -ml-2 font-medium w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {siteMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
