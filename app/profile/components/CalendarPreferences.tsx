"use client"

import React, { useState, useEffect } from "react"
import {
  SectionCard,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"
import { Switch } from "@/app/components/ui/switch"
import { Label } from "@/app/components/ui/label"
import { CalendarSettings, EventType } from "@/app/services/profile.service"
import { useSite } from "@/app/context/SiteContext"
import { DAYS, BusinessHoursScheduleCard } from "./BusinessHoursScheduleCard"
import { EventTypesSection } from "./EventTypesSection"

interface CalendarPreferencesProps {
  settings?: CalendarSettings
  onSave: (settings: CalendarSettings) => Promise<void>
  isUpdating: boolean
  userEmail?: string
}

export function CalendarPreferences({ settings, onSave, isUpdating, userEmail }: CalendarPreferencesProps) {
  const { sites } = useSite()

  const [formData, setFormData] = useState<CalendarSettings>({
    enabled: false,
    availability: DAYS.reduce((acc, day) => ({
      ...acc,
      [day.id]: { enabled: day.id !== "saturday" && day.id !== "sunday", start: "09:00", end: "17:00" }
    }), {}),
    event_types: [],
    respect_holidays: false,
    timezone: "America/Mexico_City",
    schedule_name: "Sinergia México"
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        ...settings,
        event_types: settings.event_types || []
      })
    }
  }, [settings])

  const handleSave = async () => {
    await onSave(formData)
  }

  const handleSaveEventTypes = async (eventTypes: EventType[]) => {
    const newFormData = { ...formData, event_types: eventTypes }
    setFormData(newFormData)
    await onSave(newFormData)
  }

  return (
    <div className="space-y-12">
      <SectionCard className="border border-border shadow-sm overflow-hidden">
        <SectionCardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Global Calendar Enabled</Label>
              <p className="text-sm text-muted-foreground">Master switch for all your booking links</p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
            />
          </div>
        </SectionCardContent>
        <ActionFooter>
          <div className="flex items-center justify-end w-full">
            <Button variant="outline"
              type="button"
              onClick={handleSave}
              disabled={isUpdating}
              className="rounded-full px-6 border-foreground/20 font-medium" size="sm">
              {isUpdating ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </ActionFooter>
      </SectionCard>

      <BusinessHoursScheduleCard
        formData={formData}
        onChange={setFormData}
        onSave={handleSave}
        isUpdating={isUpdating}
      />

      <EventTypesSection
        eventTypes={formData.event_types || []}
        sites={sites}
        userEmail={userEmail}
        isUpdating={isUpdating}
        onSaveEventTypes={handleSaveEventTypes}
      />
    </div>
  )
}
