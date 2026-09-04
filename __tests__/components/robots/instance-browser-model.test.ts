import {
  countInstancesByTab,
  filterAndSortInstances,
  getInstanceDisplayName,
  getInstanceStatusKey,
  type InstanceStats,
  type RobotInstance,
} from "../../../app/components/robots/instance-browser-model"

const emptyStats: InstanceStats = {
  nodes: 0,
  workflows: 0,
  assets: 0,
  requirements: 0,
  recentAssets: [],
  avatarUrl: null,
}

function instance(partial: Partial<RobotInstance> & { id: string }): RobotInstance {
  return { name: `Instance ${partial.id}`, ...partial }
}

describe("instance browser model", () => {
  it("prefers requirement title for the display name", () => {
    expect(getInstanceDisplayName(instance({
      id: "abcd1234",
      name: "Fallback",
      requirement_title: "Launch campaign",
    }))).toBe("Launch campaign")
  })

  it("maps running statuses to the active status key", () => {
    expect(getInstanceStatusKey("running")).toBe("active")
    expect(getInstanceStatusKey("paused")).toBe("paused")
    expect(getInstanceStatusKey("starting")).toBe("pending")
  })

  it("filters instances by tab using loaded stats", () => {
    const instances = [
      instance({ id: "nodes-only" }),
      instance({ id: "files-only" }),
      instance({ id: "empty" }),
    ]
    const stats = {
      "nodes-only": { ...emptyStats, nodes: 4 },
      "files-only": { ...emptyStats, assets: 2 },
      empty: emptyStats,
    }

    expect(filterAndSortInstances(instances, "", "nodes", "newest", stats).map((item) => item.id)).toEqual(["nodes-only"])
    expect(filterAndSortInstances(instances, "", "files", "newest", stats).map((item) => item.id)).toEqual(["files-only"])
    expect(filterAndSortInstances(instances, "", "all", "newest", stats)).toHaveLength(3)
  })

  it("sorts by name and newest without mutating the original list", () => {
    const older = instance({ id: "a", name: "Zebra", updated_at: "2026-01-01T00:00:00.000Z" })
    const newer = instance({ id: "b", name: "Alpha", updated_at: "2026-08-01T00:00:00.000Z" })
    const input = [older, newer]

    expect(filterAndSortInstances(input, "", "all", "newest", {}).map((item) => item.id)).toEqual(["b", "a"])
    expect(filterAndSortInstances(input, "", "all", "name_asc", {}).map((item) => item.id)).toEqual(["b", "a"])
    expect(input.map((item) => item.id)).toEqual(["a", "b"])
  })

  it("counts instances that match each tab", () => {
    const instances = [instance({ id: "one" }), instance({ id: "two" })]
    const stats = {
      one: { ...emptyStats, nodes: 1, assets: 3 },
      two: { ...emptyStats, workflows: 2, requirements: 1 },
    }

    expect(countInstancesByTab(instances, stats)).toEqual({
      all: 2,
      nodes: 1,
      workflows: 1,
      files: 1,
      requirements: 1,
    })
  })
})
