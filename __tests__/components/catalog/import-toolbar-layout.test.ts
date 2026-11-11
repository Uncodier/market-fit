import fs from "node:fs"
import path from "node:path"

const source = fs.readFileSync(path.join(process.cwd(), "app/catalog/page.tsx"), "utf8")
const drawer = source.split("<MobileFiltersDrawer")[1].split("</MobileFiltersDrawer>")[0]
const toolbar = source.split("</MobileFiltersDrawer>")[1].split("</StickyHeader>")[0]

describe("Catalog import action placement", () => {
  it("places a full-width import action in the mobile filters panel", () => {
    const mobileSections = Array.from(drawer.matchAll(/<FilterSection mobileOnly>([\s\S]*?)<\/FilterSection>/g))
    const importSection = mobileSections.find((section) => section[1].includes('title="Import"'))?.[1]

    expect(importSection).toBeDefined()
    expect(importSection).toContain('className="flex h-11 w-full items-center justify-start gap-2 rounded-md"')
    expect(importSection).toContain("<span>Import</span>")
    expect(importSection).toContain("onClick={() => setIsImportOpen(true)}")
    expect(importSection).toContain("disabled={!currentSite?.id}")
  })

  it("keeps the toolbar import action and its separator desktop-only", () => {
    const desktopActions = toolbar.match(/<div className="hidden shrink-0 items-center md:flex">([\s\S]*?)<\/div>/)?.[1]
    expect(desktopActions).toBeDefined()
    expect(desktopActions).toContain('title="Import"')
    expect(desktopActions).toContain('className="w-px h-6 bg-border mx-1"')
    expect(toolbar).toContain("onClick={() => setIsImportOpen(true)}")
    expect(toolbar).toContain("disabled={!currentSite?.id}")
    expect(toolbar).toContain("<SortDropdown")
    expect(toolbar).toContain("<ViewSelector")
  })
})