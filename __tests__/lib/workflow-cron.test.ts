import {
  DEFAULT_CRON,
  buildCronExpression,
  cronNeedsHour,
  cronNeedsWeekday,
  parseCronSchedule,
} from "@/app/components/workflows/workflow-cron"

describe("parseCronSchedule", () => {
  it("defaults empty cron to every hour", () => {
    expect(parseCronSchedule()).toEqual({
      preset: "hourly",
      hour: 9,
      weekday: 1,
      expression: DEFAULT_CRON,
    })
  })

  it("maps hour interval presets", () => {
    expect(parseCronSchedule("0 */6 * * *").preset).toBe("every_6h")
    expect(parseCronSchedule("0 */12 * * *").preset).toBe("every_12h")
  })

  it("maps daily, weekdays and weekly hour selections", () => {
    expect(parseCronSchedule("0 9 * * *")).toMatchObject({ preset: "daily", hour: 9 })
    expect(parseCronSchedule("0 18 * * 1-5")).toMatchObject({ preset: "weekdays", hour: 18 })
    expect(parseCronSchedule("0 8 * * 1")).toMatchObject({ preset: "weekly", hour: 8, weekday: 1 })
  })

  it("keeps unknown expressions as custom", () => {
    expect(parseCronSchedule("*/5 * * * *")).toMatchObject({
      preset: "custom",
      expression: "*/5 * * * *",
    })
  })
})

describe("buildCronExpression", () => {
  it("serializes hour presets", () => {
    expect(buildCronExpression({ preset: "hourly", hour: 9, weekday: 1 })).toBe("0 * * * *")
    expect(buildCronExpression({ preset: "every_2h", hour: 9, weekday: 1 })).toBe("0 */2 * * *")
    expect(buildCronExpression({ preset: "daily", hour: 9, weekday: 1 })).toBe("0 9 * * *")
    expect(buildCronExpression({ preset: "weekdays", hour: 7, weekday: 1 })).toBe("0 7 * * 1-5")
    expect(buildCronExpression({ preset: "weekly", hour: 8, weekday: 1 })).toBe("0 8 * * 1")
  })

  it("round-trips daily hour changes", () => {
    const expression = buildCronExpression({ preset: "daily", hour: 21, weekday: 1 })
    expect(parseCronSchedule(expression)).toMatchObject({ preset: "daily", hour: 21, expression })
  })
})

describe("cron field visibility", () => {
  it("shows hour for calendar presets only", () => {
    expect(cronNeedsHour("daily")).toBe(true)
    expect(cronNeedsHour("hourly")).toBe(false)
    expect(cronNeedsWeekday("weekly")).toBe(true)
    expect(cronNeedsWeekday("daily")).toBe(false)
  })
})
