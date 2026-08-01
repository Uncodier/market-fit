"use client"

import React, { useEffect } from "react"
import { useForm, FormProvider, Controller } from "react-hook-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { toast } from "sonner"
import { upsertReservationSchedule } from "../schedule-actions"
import { ReservationSchedule } from "@/app/types"
import { Trash2, Plus } from "@/app/components/ui/icons"

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

interface ScheduleEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: Partial<ReservationSchedule> | null
  onSaved: () => void
}

export function ScheduleEditorDialog({ open, onOpenChange, schedule, onSaved }: ScheduleEditorDialogProps) {
  const defaultDays = DAYS.reduce((acc, day) => {
    acc[day] = { enabled: false, timeBlocks: [{ start: "09:00", end: "17:00" }] }
    return acc
  }, {} as any)

  const methods = useForm({
    defaultValues: {
      name: schedule?.name || "",
      duration_minutes: 60,
      capacity: 1,
      timezone: "America/Mexico_City",
      days: defaultDays
    }
  })

  const { reset, handleSubmit, control, watch, setValue } = methods

  useEffect(() => {
    if (schedule && open) {
      const loadedDays = schedule.days || {}
      const mappedDays = DAYS.reduce((acc, day) => {
        const d = loadedDays[day]
        if (d) {
          if (d.timeBlocks && d.timeBlocks.length > 0) {
            acc[day] = d
          } else if (d.start && d.end) {
            acc[day] = { enabled: d.enabled, timeBlocks: [{ start: d.start, end: d.end }] }
          } else {
            acc[day] = { enabled: d.enabled, timeBlocks: [{ start: "09:00", end: "17:00" }] }
          }
        } else {
          acc[day] = { enabled: false, timeBlocks: [{ start: "09:00", end: "17:00" }] }
        }
        return acc
      }, {} as any)

      reset({
        name: schedule.name || "",
        duration_minutes: schedule.duration_minutes || 60,
        capacity: schedule.capacity || 1,
        timezone: schedule.timezone || "America/Mexico_City",
        days: mappedDays
      })
    } else if (!schedule && open) {
      reset({
        name: "",
        duration_minutes: 60,
        capacity: 1,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City",
        days: defaultDays
      })
    }
  }, [schedule, open, reset])

  const onSubmit = async (data: any) => {
    if (!schedule?.catalog_item_id) return

    const { error } = await upsertReservationSchedule({
      id: schedule.id,
      name: data.name,
      catalog_item_id: schedule.catalog_item_id,
      site_id: schedule.site_id,
      duration_minutes: parseInt(data.duration_minutes),
      capacity: parseInt(data.capacity),
      timezone: data.timezone,
      days: data.days
    })

    if (error) {
      toast.error(error)
    } else {
      toast.success("Schedule saved")
      onSaved()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Schedule</DialogTitle>
        </DialogHeader>
        
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Schedule Name</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input placeholder="e.g. Standard" {...field} />
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Controller
                  name="duration_minutes"
                  control={control}
                  render={({ field }) => (
                    <Input type="number" min="1" {...field} />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity (seats per slot)</Label>
                <Controller
                  name="capacity"
                  control={control}
                  render={({ field }) => (
                    <Input type="number" min="1" {...field} />
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Controller
                name="timezone"
                control={control}
                render={({ field }) => (
                  <Input {...field} />
                )}
              />
            </div>

            <div className="space-y-4">
              <Label>Weekly Schedule</Label>
              {DAYS.map((day) => (
                <div key={day} className="flex items-center gap-4 border p-3 rounded-md">
                  <div className="w-28 flex items-center gap-2">
                    <Controller
                      name={`days.${day}.enabled`}
                      control={control}
                      render={({ field }) => (
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange} 
                        />
                      )}
                    />
                    <span className="capitalize text-sm font-medium">{day.slice(0,3)}</span>
                  </div>
                  
                  {watch(`days.${day}.enabled`) ? (
                    <div className="flex flex-1 flex-col gap-2">
                      {watch(`days.${day}.timeBlocks`)?.map((_: any, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <Controller
                            name={`days.${day}.timeBlocks.${index}.start`}
                            control={control}
                            render={({ field }) => (
                              <Input type="time" className="h-8 w-24" {...field} />
                            )}
                          />
                          <span className="text-muted-foreground">-</span>
                          <Controller
                            name={`days.${day}.timeBlocks.${index}.end`}
                            control={control}
                            render={({ field }) => (
                              <Input type="time" className="h-8 w-24" {...field} />
                            )}
                          />
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const currentBlocks = watch(`days.${day}.timeBlocks`) || [];
                              if (currentBlocks.length > 1) {
                                setValue(`days.${day}.timeBlocks`, currentBlocks.filter((_: any, i: number) => i !== index));
                              }
                            }}
                            disabled={(watch(`days.${day}.timeBlocks`) || []).length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-muted-foreground w-full justify-start mt-1"
                        onClick={() => {
                          const currentBlocks = watch(`days.${day}.timeBlocks`) || [];
                          setValue(`days.${day}.timeBlocks`, [...currentBlocks, { start: "09:00", end: "17:00" }]);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add hours
                      </Button>
                    </div>
                  ) : (
                    <div className="flex-1 text-sm text-muted-foreground">Closed</div>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
