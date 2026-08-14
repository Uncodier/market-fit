"use client"

import React, { useState } from "react"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Switch } from "@/app/components/ui/switch"
import { Label } from "@/app/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { TimeRangeSelect } from "@/app/components/ui/time-select"
import { Plus, Trash2, ChevronDown, ChevronRight } from "@/app/components/ui/icons"
import { CalendarSettings } from "@/app/services/profile.service"

export const DAYS = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
]

interface BusinessHoursScheduleCardProps {
  formData: CalendarSettings
  onChange: (updater: (prev: CalendarSettings) => CalendarSettings) => void
  onSave: () => Promise<void>
  isUpdating: boolean
}

export function BusinessHoursScheduleCard({
  formData,
  onChange,
  onSave,
  isUpdating,
}: BusinessHoursScheduleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggleDay = (dayId: string) => {
    onChange((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [dayId]: { ...prev.availability[dayId], enabled: !prev.availability[dayId].enabled },
      },
    }))
  }

  const handleTimeChange = (dayId: string, field: "start" | "end", value: string) => {
    onChange((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [dayId]: { ...prev.availability[dayId], [field]: value },
      },
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Business Hours</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define your business hours for different regions and locations
          </p>
        </div>
        <Button variant="outline" className="gap-2 rounded-full">
          <Plus className="h-4 w-4" />
          Add Schedule
        </Button>
      </div>

      <SectionCard className="border border-border shadow-sm overflow-hidden">
        <SectionCardHeader
          className="p-4 bg-background flex flex-row items-center gap-4 space-y-0 cursor-pointer hover:bg-muted/40"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div className="flex-1 max-w-[300px]" onClick={(e) => e.stopPropagation()}>
            <Input
              value={formData.schedule_name || ""}
              onChange={(e) => onChange((prev) => ({ ...prev, schedule_name: e.target.value }))}
              placeholder="Schedule Name"
            />
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              value={formData.timezone || "America/Mexico_City"}
              onValueChange={(v) => onChange((prev) => ({ ...prev, timezone: v }))}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Mexico_City">Mexico City (GMT-6)</SelectItem>
                <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                <SelectItem value="Europe/Madrid">Madrid (GMT+1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
        </SectionCardHeader>
        {isExpanded && (
          <>
            <SectionCardContent className="space-y-8 p-8 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Respect Holidays</Label>
                  <p className="text-sm text-muted-foreground">
                    Agents will not work on regional holidays when enabled
                  </p>
                </div>
                <Switch
                  checked={formData.respect_holidays || false}
                  onCheckedChange={(checked) =>
                    onChange((prev) => ({ ...prev, respect_holidays: checked }))
                  }
                />
              </div>

              <div className="space-y-3">
                {DAYS.map((day) => (
                  <div key={day.id} className="flex items-center p-3 rounded-lg border border-border gap-8">
                    <div className="flex items-center gap-4 w-32">
                      <Switch
                        checked={formData.availability[day.id]?.enabled}
                        onCheckedChange={() => handleToggleDay(day.id)}
                      />
                      <span className="min-w-[80px] font-medium text-foreground">
                        {day.label}
                      </span>
                    </div>

                    {formData.availability[day.id]?.enabled ? (
                      <TimeRangeSelect
                        start={formData.availability[day.id].start}
                        end={formData.availability[day.id].end}
                        onStartChange={(value) => handleTimeChange(day.id, "start", value)}
                        onEndChange={(value) => handleTimeChange(day.id, "end", value)}
                        triggerClassName="h-10 bg-background shadow-none"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Unavailable</span>
                    )}
                  </div>
                ))}
              </div>
            </SectionCardContent>
            <ActionFooter>
              <div className="flex items-center justify-end gap-4 w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive border-destructive/20 hover:text-destructive hover:bg-destructive/10 rounded-full px-6"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Schedule
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={onSave}
                  disabled={isUpdating}
                  className="rounded-full px-6 border-foreground/20 font-medium"
                  size="sm"
                >
                  {isUpdating ? "Saving..." : "Save Schedule"}
                </Button>
              </div>
            </ActionFooter>
          </>
        )}
      </SectionCard>
    </div>
  )
}
