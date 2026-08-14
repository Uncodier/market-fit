import { toEndIso, toStartIso } from "@/app/api/recent-activity/build-feed"

describe("recent activity date bounds", () => {
  it("keeps date-only starts at the beginning of that UTC day", () => {
    expect(toStartIso("2026-08-13")).toBe("2026-08-13T00:00:00.000Z")
  })

  it("extends date-only ends by one UTC day so evening local sales stay in range", () => {
    expect(toEndIso("2026-08-13")).toBe("2026-08-14T23:59:59.999Z")
  })

  it("preserves explicit timestamps", () => {
    expect(toStartIso("2026-08-13T06:00:00.000Z")).toBe("2026-08-13T06:00:00.000Z")
    expect(toEndIso("2026-08-14T05:59:59.999Z")).toBe("2026-08-14T05:59:59.999Z")
  })
})
