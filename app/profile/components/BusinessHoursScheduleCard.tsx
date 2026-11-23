"use client"

import { useLocalization } from "@/app/context/LocalizationContext"

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

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const

type DayId = (typeof DAYS)[number]
type Availability = NonNullable<CalendarSettings["availability"]>

function getScheduleDay(availability: CalendarSettings["availability"], day: DayId): Availability[string] {
  const stored = availability?.[day]
  return {
    ...stored,
    // Missing days in an existing schedule are closed; defaults are for a new schedule.
    enabled: stored?.enabled ?? (availability == null && day !== "saturday" && day !== "sunday"),
    start: stored?.start ?? "09:00",
    end: stored?.end ?? "17:00",
  }
}

function createDefaultAvailability(): Availability {
  return Object.fromEntries(DAYS.map((day) => [day, getScheduleDay(undefined, day)]))
}

interface BusinessHoursScheduleCardProps {
  formData: CalendarSettings
  onChange: (updater: (prev: CalendarSettings) => CalendarSettings) => void
  onSave: (settings: CalendarSettings) => Promise<void>
  isUpdating: boolean
}

export function BusinessHoursScheduleCard({
  formData,
  onChange,
  onSave,
  isUpdating,
}: BusinessHoursScheduleCardProps) {
  const { t } = useLocalization()
  const [isExpanded, setIsExpanded] = useState(false)

  const updateDay = (dayId: DayId, update: (day: Availability[string]) => Availability[string]) => {
    onChange((prev) => ({
      ...prev,
      availability: {
        ...(prev.availability ?? createDefaultAvailability()),
        [dayId]: update(getScheduleDay(prev.availability, dayId)),
      },
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t("account.calendar.hours")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("account.calendar.hoursHelp")}
          </p>
        </div>
        <Button variant="outline" className="gap-2 rounded-full">
          <Plus className="h-4 w-4" />
          {t("account.calendar.addSchedule")}
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
              aria-label={t("account.calendar.scheduleName")}
              placeholder={t("account.calendar.scheduleName")}
            />
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              value={formData.timezone || "America/Mexico_City"}
              onValueChange={(v) => onChange((prev) => ({ ...prev, timezone: v }))}
            >
              <SelectTrigger aria-label={t("timezone")} className="w-[280px]">
                <SelectValue placeholder={t("booking.timezone.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Mexico_City">{t("account.preferences.mexico")}</SelectItem>
                <SelectItem value="America/New_York">{t("account.preferences.ny")}</SelectItem>
                <SelectItem value="Europe/Madrid">{t("account.preferences.madrid")}</SelectItem>
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
                  <Label className="text-base font-semibold">{t("account.calendar.holidays")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("account.calendar.holidayHelp")}
                  </p>
                </div>
                <Switch
                  aria-label={t("account.calendar.holidays")}
                  checked={formData.respect_holidays || false}
                  onCheckedChange={(checked) =>
                    onChange((prev) => ({ ...prev, respect_holidays: checked }))
                  }
                />
              </div>

              <div className="space-y-3">
                {DAYS.map((day) => {
                  const { enabled, start, end } = getScheduleDay(formData.availability, day)
                  return (
                    <div key={day} className="flex items-center p-3 rounded-lg border border-border gap-8">
                      <div className="flex items-center gap-4 w-32">
                        <Switch
                          aria-label={t("account.calendar.dayEnabled", { day: t("account.calendar." + day) })}
                          checked={enabled}
                          onCheckedChange={(checked) => updateDay(day, (current) => ({ ...current, enabled: checked }))}
                        />
                        <span className="min-w-[80px] font-medium text-foreground">
                          {t("account.calendar." + day)}
                        </span>
                      </div>

                      {enabled ? (
                        <TimeRangeSelect
                          start={start}
                          end={end}
                          onStartChange={(value) => updateDay(day, (current) => ({ ...current, start: value }))}
                          onEndChange={(value) => updateDay(day, (current) => ({ ...current, end: value }))}
                          triggerClassName="h-10 bg-background shadow-none"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground italic">{t("booking.unavailable")}</span>
                      )}
                    </div>
                  )
                })}
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
                  {t("account.calendar.removeSchedule")}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onSave({
                    ...formData,
                    availability: formData.availability ?? createDefaultAvailability(),
                  })}
                  disabled={isUpdating}
                  className="rounded-full px-6 border-foreground/20 font-medium"
                  size="sm"
                >
                  {isUpdating ? t("common.saving") : t("account.calendar.saveSchedule")}
                </Button>
              </div>
            </ActionFooter>
          </>
        )}
      </SectionCard>
    </div>
  )
}
