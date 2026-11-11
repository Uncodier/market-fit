import fs from "node:fs"
import path from "node:path"

const source = fs.readFileSync(path.join(process.cwd(), "app/records/page.tsx"), "utf8")

describe("Records toolbar layout", () => {
  it("keeps desktop visibility separate from the mobile header", () => {
    expect(source).toContain("const [isToolbarVisible, setIsToolbarVisible] = useState(false)")
    expect(source).toContain("<RecordsPageHeader")
    expect(source).toContain("isMobile={isMobile}")
    expect(source).toContain("onToolbarVisibilityChange={setIsToolbarVisible}")
  })

  it("reserves fixed-header space only for the visible desktop toolbar", () => {
    expect(source).toContain('!isMobile && isToolbarVisible && "pt-[71px]"')
    expect(source).toContain("flex-1 min-h-0 min-w-0")
  })
})