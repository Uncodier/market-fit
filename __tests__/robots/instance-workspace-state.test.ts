import {
  instanceWorkspaceStorageKey,
  loadInstanceWorkspaceState,
  parseInstanceWorkspaceState,
  resolveAvailableBrowserTab,
  saveInstanceWorkspaceState,
  type InstanceWorkspaceState,
} from "@/app/robots/instance-workspace-state"

describe("instance workspace state", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("stores workspace state independently for each instance", () => {
    const firstState: InstanceWorkspaceState = {
      activeBrowserTab: { kind: "artifact", screen: "database" },
      layout: "chat",
    }
    const secondState: InstanceWorkspaceState = {
      activeBrowserTab: { kind: "source" },
      layout: "preview",
    }

    saveInstanceWorkspaceState("instance-one", firstState)
    saveInstanceWorkspaceState("instance-two", secondState)

    expect(loadInstanceWorkspaceState("instance-one")).toEqual(firstState)
    expect(loadInstanceWorkspaceState("instance-two")).toEqual(secondState)
  })

  it("serializes state under the versioned instance key", () => {
    const state: InstanceWorkspaceState = {
      activeBrowserTab: { kind: "preview" },
      layout: "split",
    }

    saveInstanceWorkspaceState("instance-one", state)

    expect(window.localStorage.getItem(instanceWorkspaceStorageKey("instance-one"))).toBe(
      JSON.stringify(state),
    )
  })

  it.each([
    null,
    "not-json",
    JSON.stringify({ activeBrowserTab: { kind: "unknown" }, layout: "split" }),
    JSON.stringify({ activeBrowserTab: { kind: "artifact", screen: "" }, layout: "split" }),
    JSON.stringify({ activeBrowserTab: { kind: "preview" }, layout: "hidden" }),
  ])("rejects malformed or unsupported storage values", (storedValue) => {
    expect(parseInstanceWorkspaceState(storedValue)).toBeNull()
  })

  it("falls back when a saved artifact is no longer available", () => {
    expect(
      resolveAvailableBrowserTab({
        requestedTab: { kind: "artifact", screen: "deleted-screen" },
        hasRequirementPreview: true,
        artifactScreens: ["database"],
      }),
    ).toEqual({ kind: "preview" })

    expect(
      resolveAvailableBrowserTab({
        requestedTab: { kind: "artifact", screen: "deleted-screen" },
        hasRequirementPreview: false,
        artifactScreens: ["reports", "database"],
      }),
    ).toEqual({ kind: "artifact", screen: "reports" })
  })
})
