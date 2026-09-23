import { pinArtifactToNavigation } from "@/app/robots/artifact-navigation-shortcut"
import { getShortcutStorageKey } from "@/app/components/navigation/shortcut-storage"

describe("pinArtifactToNavigation", () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem("currentSiteId", "site-a")
  })

  it("pins a known application route and notifies the sidebar", () => {
    const listener = jest.fn()
    window.addEventListener("shortcuts-updated", listener)

    pinArtifactToNavigation({
      artifactUrl: "/people?artifact=true&theme=dark",
      title: "People",
    })

    expect(
      JSON.parse(
        localStorage.getItem(getShortcutStorageKey("site-a")) || "[]",
      ),
    ).toEqual([{ id: "people", pinned: true }])
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener("shortcuts-updated", listener)
  })

  it("pins an unknown artifact as a custom clean URL", () => {
    pinArtifactToNavigation({
      artifactUrl: "/custom-report?artifact=true&theme=dark&range=30d",
      title: "Custom report",
    })

    expect(
      JSON.parse(
        localStorage.getItem(getShortcutStorageKey("site-a")) || "[]",
      ),
    ).toEqual([
      {
        id: "custom--custom-report",
        title: "Custom report",
        href: "/custom-report?range=30d",
        isCustom: true,
        pinned: true,
      },
    ])
  })

  it("does not change another site's shortcuts", () => {
    localStorage.setItem(
      getShortcutStorageKey("site-b"),
      JSON.stringify([{ id: "orders", pinned: true }]),
    )

    pinArtifactToNavigation({
      artifactUrl: "/people?artifact=true",
      title: "People",
    })

    expect(
      JSON.parse(localStorage.getItem(getShortcutStorageKey("site-b")) || "[]"),
    ).toEqual([{ id: "orders", pinned: true }])
  })
})
