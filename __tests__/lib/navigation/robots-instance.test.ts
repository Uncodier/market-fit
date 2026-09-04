import {
  resolveInstanceIdParam,
  robotsInstanceHref,
  sortRobotInstances,
  resolveSelectedInstanceId,
  isActiveInstanceStatus,
  splitVisibleInstances,
  shouldIgnoreInstanceTabChange,
} from "@/lib/navigation/robots-instance"

function params(entries: Record<string, string>) {
  const search = new URLSearchParams(entries)
  return { get: (key: string) => search.get(key) }
}

describe("resolveInstanceIdParam", () => {
  it("prefers the canonical instance param", () => {
    expect(
      resolveInstanceIdParam(
        params({ instance: "a", instance_id: "b", instanceId: "c" })
      )
    ).toBe("a")
  })

  it("accepts instance_id and instanceId aliases", () => {
    expect(resolveInstanceIdParam(params({ instance_id: "paused-1" }))).toBe("paused-1")
    expect(resolveInstanceIdParam(params({ instanceId: "paused-2" }))).toBe("paused-2")
  })

  it("returns null when no instance param is present", () => {
    expect(resolveInstanceIdParam(params({ name: "req" }))).toBeNull()
  })
})

describe("robotsInstanceHref", () => {
  it("always uses the canonical instance query key", () => {
    expect(robotsInstanceHref("inst-9")).toBe("/robots?instance=inst-9")
  })
})

describe("isActiveInstanceStatus", () => {
  it("keeps paused instances in the active group", () => {
    expect(isActiveInstanceStatus("paused")).toBe(true)
    expect(isActiveInstanceStatus("running")).toBe(true)
    expect(isActiveInstanceStatus("error")).toBe(false)
  })
})

describe("sortRobotInstances", () => {
  it("does not bury a recently paused instance under older stopped ones", () => {
    const sorted = sortRobotInstances([
      { id: "old-stopped", status: "error", updated_at: "2026-09-03T20:00:00.000Z" },
      { id: "paused-req", status: "paused", updated_at: "2026-09-04T05:00:00.000Z" },
      { id: "running", status: "running", updated_at: "2026-09-04T04:00:00.000Z" },
    ])
    expect(sorted.map((item) => item.id)).toEqual(["paused-req", "running", "old-stopped"])
  })
})

describe("resolveSelectedInstanceId", () => {
  it("honors a deep-linked instance even when it is not in the visible list yet", () => {
    expect(
      resolveSelectedInstanceId({
        requestedId: "paused-req",
        localId: null,
        instanceIds: ["other-running"],
        isLoading: false,
      })
    ).toBe("paused-req")
  })

  it("does not swap to another instance while the list is loading", () => {
    expect(
      resolveSelectedInstanceId({
        requestedId: "paused-req",
        localId: null,
        instanceIds: [],
        isLoading: true,
      })
    ).toBe("paused-req")
  })

  it("prefers the deep-linked instance over a stale local selection", () => {
    expect(
      resolveSelectedInstanceId({
        requestedId: "paused-req",
        localId: "other",
        instanceIds: ["paused-req", "other"],
        isLoading: false,
      })
    ).toBe("paused-req")
  })

  it("falls back to the first instance only when nothing was requested", () => {
    expect(
      resolveSelectedInstanceId({
        requestedId: null,
        localId: null,
        instanceIds: ["first", "second"],
        isLoading: false,
      })
    ).toBe("first")
  })
})

describe("splitVisibleInstances", () => {
  it("pins the selected instance into the visible tabs", () => {
    const items = [
      { id: "a" },
      { id: "b" },
      { id: "paused-req" },
    ]
    const { visible, hidden } = splitVisibleInstances(items, "paused-req", 2)
    expect(visible.map((item) => item.id)).toEqual(["a", "paused-req"])
    expect(hidden.map((item) => item.id)).toEqual(["b"])
  })
})

describe("shouldIgnoreInstanceTabChange", () => {
  it("ignores Radix falling back to another tab before the requested instance is loaded", () => {
    expect(
      shouldIgnoreInstanceTabChange({
        nextId: "other-running",
        currentId: "paused-req",
        requestedId: "paused-req",
        instanceIds: [],
        isLoading: true,
      })
    ).toBe(true)
  })

  it("allows a real user change once the requested instance is available", () => {
    expect(
      shouldIgnoreInstanceTabChange({
        nextId: "other-running",
        currentId: "paused-req",
        requestedId: "paused-req",
        instanceIds: ["paused-req", "other-running"],
        isLoading: false,
      })
    ).toBe(false)
  })
})
