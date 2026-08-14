"use client"

import { useState } from "react"
import { Button } from "../../ui/button"
import { Input } from "../../ui/input"
import { Switch } from "../../ui/switch"
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../../ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select"
import { Trash2, ChevronRight, PlusCircle, ChevronDown } from "../../ui/icons"
import { TimeRangeSelect } from "../../ui/time-select"
import { TIMEZONES, DAYS_OF_WEEK } from "../constants/onboarding-constants"

function createDefaultDays() {
  return {
    monday: { enabled: true, start: "09:00", end: "18:00" },
    tuesday: { enabled: true, start: "09:00", end: "18:00" },
    wednesday: { enabled: true, start: "09:00", end: "18:00" },
    thursday: { enabled: true, start: "09:00", end: "18:00" },
    friday: { enabled: true, start: "09:00", end: "18:00" },
    saturday: { enabled: false, start: "09:00", end: "14:00" },
    sunday: { enabled: false, start: "09:00", end: "14:00" },
  }
}

interface BusinessHoursStepProps {
  form: any
}

export function BusinessHoursStep({ form }: BusinessHoursStepProps) {
  const [expandedBusinessHours, setExpandedBusinessHours] = useState<Set<number>>(new Set())

  const addBusinessHour = () => {
    const current = form.getValues("business_hours") || []
    const newHours = {
      name: "",
      timezone: "America/Mexico_City",
      respectHolidays: true,
      days: createDefaultDays(),
    }
    const newList = [...current, newHours]
    form.setValue("business_hours", newList)

    const newExpanded = new Set(expandedBusinessHours)
    newExpanded.add(newList.length - 1)
    setExpandedBusinessHours(newExpanded)
  }

  const removeBusinessHour = (index: number) => {
    const current = form.getValues("business_hours") || []
    form.setValue("business_hours", current.filter((_: unknown, i: number) => i !== index))
  }

  const updateBusinessHour = (index: number, field: string, value: unknown) => {
    const current = form.getValues("business_hours") || []
    const newList = [...current]
    if (field.includes(".")) {
      const parts = field.split(".")
      let currentObj = newList[index] as any
      for (let i = 0; i < parts.length - 1; i++) {
        currentObj = currentObj[parts[i]]
      }
      currentObj[parts[parts.length - 1]] = value
    } else {
      (newList[index] as any)[field] = value
    }
    form.setValue("business_hours", newList)
  }

  const toggleBusinessHourExpanded = (index: number) => {
    const newExpanded = new Set(expandedBusinessHours)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedBusinessHours(newExpanded)
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">
          Define your business hours for different regions. Most agent activities will start on those time ranges.
        </p>
      </div>

      {form.watch("business_hours")?.map((hours: any, index: number) => {
        const isExpanded = expandedBusinessHours.has(index)
        const days = hours.days || createDefaultDays()

        return (
          <div key={index} className="border dark:border-white/5 border-black/5 rounded-lg overflow-hidden">
            <div className="p-4 bg-muted/30">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => toggleBusinessHourExpanded(index)}
                  className="p-1 hover:bg-muted/50 rounded transition-colors h-10 w-10 flex items-center justify-center"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`business_hours.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="e.g., Main Office, Europe Branch"
                            value={hours.name}
                            onChange={(e) => {
                              field.onChange(e)
                              updateBusinessHour(index, "name", e.target.value)
                            }}
                            className="bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`business_hours.${index}.timezone`}
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          value={hours.timezone || undefined}
                          onValueChange={(value) => {
                            field.onChange(value)
                            updateBusinessHour(index, "timezone", value)
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => removeBusinessHour(index)}
                  className="h-10 w-10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="p-6 space-y-4 border-t dark:border-white/5 border-black/5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Respect Holidays</label>
                    <p className="text-xs text-muted-foreground">
                      Agents will not work on regional holidays when enabled
                    </p>
                  </div>
                  <Switch
                    checked={hours.respectHolidays || false}
                    onCheckedChange={(checked) => {
                      updateBusinessHour(index, "respectHolidays", checked)
                    }}
                  />
                </div>

                <div className="space-y-3">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.key} className="flex items-center gap-4">
                      <div className="w-32">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={days[day.key as keyof typeof days]?.enabled || false}
                            onCheckedChange={(checked) => {
                              updateBusinessHour(index, `days.${day.key}.enabled`, checked)
                            }}
                          />
                          <label className="text-sm font-medium">
                            {day.label}
                          </label>
                        </div>
                      </div>

                      {days[day.key as keyof typeof days]?.enabled ? (
                        <TimeRangeSelect
                          start={days[day.key as keyof typeof days]?.start || "09:00"}
                          end={days[day.key as keyof typeof days]?.end || "18:00"}
                          onStartChange={(value) => {
                            updateBusinessHour(index, `days.${day.key}.start`, value)
                          }}
                          onEndChange={(value) => {
                            updateBusinessHour(index, `days.${day.key}.end`, value)
                          }}
                        />
                      ) : (
                        <div className="flex-1 text-sm text-muted-foreground">
                          Closed
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={addBusinessHour}
      >
        <PlusCircle className="h-4 w-4 mr-2" />
        Add Business Hours Schedule
      </Button>
    </div>
  )
}
