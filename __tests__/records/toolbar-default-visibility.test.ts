import fs from "node:fs"
import path from "node:path"

const source = fs.readFileSync(path.join(process.cwd(), "app/records/page.tsx"), "utf8")

describe("Records toolbar layout", () => {
  it("fits the categories sidebar below the top bar without extending past the viewport", () => {
    expect(source).toContain("top-[var(--topbar-height,64px)]")
    expect(source).toContain("h-[calc(100dvh-var(--topbar-height,64px))]")
    expect(source).not.toContain("fixed h-screen")
  })

  it("keeps the toolbar always visible on desktop and mobile", () => {
    expect(source).not.toContain("isToolbarVisible")
    expect(source).toContain("<RecordsPageHeader")
    expect(source).toContain("isMobile={isMobile}")
    expect(source).not.toContain("onToolbarVisibilityChange")
  })

  it("offsets both the sticky header and contents only for the open categories sidebar", () => {
    expect(source).toContain('!isSidebarCollapsed && "md:ml-[319px]"')
    expect(source).not.toContain('pt-[71px]')
    expect(source).toContain("flex-1 min-h-0 min-w-0")
  })
})