"use client"

import { useProfile } from "@/app/hooks/use-profile"
import type { WorkflowTriggerConfig } from "./types"
import { WF_FIELD_CLASS } from "./types"
import { WorkflowSearchSelect } from "./workflow-search-select"
import {
  CRON_HOUR_OPTIONS,
  CRON_PRESET_OPTIONS,
  CRON_WEEKDAY_OPTIONS,
  buildCronExpression,
  cronNeedsHour,
  cronNeedsWeekday,
  parseCronSchedule,
  type CronPreset,
} from "./workflow-cron"

function resolveSchedule(trigger: WorkflowTriggerConfig) {
  const parsed = parseCronSchedule(trigger.cron)
  if (trigger.cron_preset === "custom") {
    return { ...parsed, preset: "custom" as const, expression: (trigger.cron || parsed.expression).trim() }
  }
  return parsed
}

export function WorkflowCronFields({
  trigger,
  onPersist,
}: {
  trigger: WorkflowTriggerConfig
  onPersist: (patch: Record<string, unknown>) => Promise<unknown>
}) {
  const { timezone: profileTimezone } = useProfile()
  const timezone = trigger.timezone || profileTimezone || "America/Mexico_City"

  const schedule = resolveSchedule(trigger)
  const showHour = cronNeedsHour(schedule.preset)
  const showWeekday = cronNeedsWeekday(schedule.preset)

  const persistCron = (next: { preset: CronPreset; hour: number; weekday: number }, custom?: string) => {
    const nextTrigger: WorkflowTriggerConfig = {
      ...trigger,
      cron: buildCronExpression(next, custom ?? trigger.cron),
      timezone,
    }
    if (next.preset === "custom") nextTrigger.cron_preset = "custom"
    else delete nextTrigger.cron_preset
    void onPersist({ trigger: nextTrigger })
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium">Schedule</span>
        <WorkflowSearchSelect
          options={CRON_PRESET_OPTIONS}
          value={schedule.preset}
          placeholder="Schedule"
          allowCreate={false}
          onChange={(next) =>
            persistCron({
              preset: next as CronPreset,
              hour: schedule.hour,
              weekday: schedule.weekday,
            })
          }
        />
      </label>

      {(showHour || showWeekday) && (
        <div className={`grid gap-2 ${showWeekday ? "grid-cols-2" : "grid-cols-1"}`}>
          {showWeekday && (
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] font-medium">Day</span>
              <WorkflowSearchSelect
                options={CRON_WEEKDAY_OPTIONS}
                value={String(schedule.weekday)}
                placeholder="Day"
                allowCreate={false}
                onChange={(next) =>
                  persistCron({
                    preset: schedule.preset,
                    hour: schedule.hour,
                    weekday: Number(next),
                  })
                }
              />
            </label>
          )}
          {showHour && (
            <label className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] font-medium">Hour</span>
              <WorkflowSearchSelect
                options={CRON_HOUR_OPTIONS}
                value={String(schedule.hour)}
                placeholder="Hour"
                allowCreate={false}
                onChange={(next) =>
                  persistCron({
                    preset: schedule.preset,
                    hour: Number(next),
                    weekday: schedule.weekday,
                  })
                }
              />
            </label>
          )}
        </div>
      )}

      {schedule.preset === "custom" && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium">Cron expression</span>
          <input
            className={`w-full font-mono ${WF_FIELD_CLASS}`}
            defaultValue={schedule.expression}
            key={schedule.expression}
            placeholder="0 * * * *"
            onBlur={(event) =>
              persistCron(
                { preset: "custom", hour: schedule.hour, weekday: schedule.weekday },
                event.target.value,
              )
            }
          />
        </label>
      )}

      <div className="flex justify-between items-center px-1">
        <p className="text-[10px] text-muted-foreground font-mono">{schedule.expression}</p>
        <p className="text-[10px] text-muted-foreground">Times in {timezone}</p>
      </div>
    </div>
  )
}
