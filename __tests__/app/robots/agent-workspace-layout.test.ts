import { readFileSync } from "node:fs"
import { join } from "node:path"

const robotsPageSource = readFileSync(
  join(process.cwd(), "app/robots/page.tsx"),
  "utf8",
)

describe("agent workspace layout", () => {
  it("uses the responsive selector with Agent as the first section", () => {
    expect(robotsPageSource).toContain("<ResponsiveTabsList")
    expect(robotsPageSource.indexOf("value: 'agent'")).toBeLessThan(
      robotsPageSource.indexOf("...allArtifactItems.map"),
    )
    expect(robotsPageSource).toContain(
      "border border-border/40 bg-background/35 shadow-sm backdrop-blur-md",
    )
    expect(robotsPageSource).toContain('containerClassName="justify-center"')
    expect(robotsPageSource).toContain(
      "!isCanvasMode && workspaceTabs.length > 1 && (",
    )
  })

  it("keeps desktop preview controls out of the mobile layout", () => {
    expect(robotsPageSource).toContain("setViewportSize")
    expect(robotsPageSource).toContain("displayedIframeUrl")
    expect(robotsPageSource).toContain("hidden h-11 shrink-0 lg:grid grid-cols-")
    expect(robotsPageSource).toContain("lg:grid-rows-[auto_1fr]")
  })

  it("keeps pin and close actions on artifact tabs", () => {
    expect(robotsPageSource).toContain("leadingAction: canManageArtifact")
    expect(robotsPageSource).toContain("trailingAction: canManageArtifact")
    expect(robotsPageSource).toContain("pinArtifact(item.screen!)")
    expect(robotsPageSource).toContain("closeArtifact(item.screen!)")
  })

  it("shrinks the address or file field before the view selector", () => {
    expect(robotsPageSource).toContain(
      "grid-cols-[minmax(33%,1fr)_auto_auto_auto]",
    )
    expect(robotsPageSource).toContain("const minimumAddressWidth = contentWidth * 0.33")
    expect(robotsPageSource).toContain("desktopTabsPreferredWidth")
    expect(robotsPageSource).toContain('className="w-full min-w-0"')
    expect(robotsPageSource).toContain('className="w-auto rounded-full !h-7 !p-0.5"')
    expect(robotsPageSource).toContain(
      'triggerClassName="!h-6 !px-1 !py-0 text-xs"',
    )
  })

  it("keeps split panes on desktop and single-section visibility on mobile", () => {
    expect(robotsPageSource).toContain('"lg:w-2/3"')
    expect(robotsPageSource).toContain('"lg:w-1/3"')
    expect(robotsPageSource).toContain('isMobileBrowserVisible ? "flex" : "hidden"')
  })
})
