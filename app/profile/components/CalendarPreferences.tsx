"use client"

import { useLocalization } from "@/app/context/LocalizationContext"

import React, { useState } from "react"
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
import { BusinessHoursScheduleCard } from "./BusinessHoursScheduleCard"
import { EventTypesSection } from "./EventTypesSection"

interface CalendarPreferencesProps {
  settings?: CalendarSettings
  onSave: (settings: CalendarSettings) => Promise<void>
  isUpdating: boolean
  userEmail?: string
}

function getFormData(settings?: CalendarSettings): CalendarSettings {
  if (settings) return { ...settings, event_types: settings.event_types ?? [] }
  return {
    enabled: false,
    event_types: [],
    respect_holidays: false,
    timezone: "America/Mexico_City",
    schedule_name: "Sinergia México"
  }
}

export function CalendarPreferences({ settings, onSave, isUpdating, userEmail }: CalendarPreferencesProps) {
  const { t } = useLocalization()
  const { sites } = useSite()

  const [previousSettings, setPreviousSettings] = useState(settings)
  const [formData, setFormData] = useState(() => getFormData(settings))
  if (settings !== previousSettings) {
    setPreviousSettings(settings)
    setFormData(getFormData(settings))
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
              <Label className="text-base font-medium">{t("account.calendar.enabled")}</Label>
              <p className="text-sm text-muted-foreground">{t("account.calendar.masterHelp")}</p>
            </div>
            <Switch
              aria-label={t("account.calendar.enabled")}
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
            />
          </div>
        </SectionCardContent>
        <ActionFooter>
          <div className="flex items-center justify-end w-full">
            <Button variant="outline"
              type="button"
              onClick={() => onSave(formData)}
              disabled={isUpdating}
              className="rounded-full px-6 border-foreground/20 font-medium" size="sm">
              {isUpdating ? t("common.saving") : t("account.preferences.save")}
            </Button>
          </div>
        </ActionFooter>
      </SectionCard>

      <BusinessHoursScheduleCard
        formData={formData}
        onChange={setFormData}
        onSave={onSave}
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
