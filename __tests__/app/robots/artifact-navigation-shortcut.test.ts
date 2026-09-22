import { pinArtifactToNavigation } from "@/app/robots/artifact-navigation-shortcut"

describe("pinArtifactToNavigation", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("pins a known application route and notifies the sidebar", () => {
    const listener = jest.fn()
    window.addEventListener("shortcuts-updated", listener)

    pinArtifactToNavigation({
      artifactUrl: "/people?artifact=true&theme=dark",
      title: "People",
    })

    expect(JSON.parse(localStorage.getItem("navigationShortcuts_v3") || "[]")).toEqual([
      { id: "people", pinned: true },
    ])
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener("shortcuts-updated", listener)
  })

  it("pins an unknown artifact as a custom clean URL", () => {
    pinArtifactToNavigation({
      artifactUrl: "/custom-report?artifact=true&theme=dark&range=30d",
      title: "Custom report",
    })

    expect(JSON.parse(localStorage.getItem("navigationShortcuts_v3") || "[]")).toEqual([
      {
        id: "custom--custom-report",
        title: "Custom report",
        href: "/custom-report?range=30d",
        isCustom: true,
        pinned: true,
      },
    ])
  })
})
