import fs from "node:fs"
import path from "node:path"

const source = fs.readFileSync(path.join(process.cwd(), "app/records/page.tsx"), "utf8")

describe("Records toolbar layout", () => {
  it("keeps the toolbar always visible on desktop and mobile", () => {
    expect(source).not.toContain("isToolbarVisible")
    expect(source).toContain("<RecordsPageHeader")
    expect(source).toContain("isMobile={isMobile}")
    expect(source).not.toContain("onToolbarVisibilityChange")
  })

  it("always reserves fixed-header space on desktop", () => {
    expect(source).toContain('!isMobile && "pt-[71px]"')
    expect(source).toContain("flex-1 min-h-0 min-w-0")
  })
})