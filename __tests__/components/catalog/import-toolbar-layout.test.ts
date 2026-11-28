import fs from "node:fs"
import path from "node:path"

const source = fs.readFileSync(path.join(process.cwd(), "app/catalog/page.tsx"), "utf8")
const toolbar = source.split("<MobileFiltersDrawer")[1].split("</MobileFiltersDrawer>")[0]

it("keeps a single import icon in the action slot, separate from sort and view", () => {
  const [actions, controlsAndFilters] = toolbar.split("controls={")
  expect(actions).toContain("actions={<ToolbarIconButton")
  expect(actions).toContain("onClick={() => setIsImportOpen(true)}")
  expect(actions).toContain("disabled={!currentSite?.id}")
  expect(actions).not.toContain("<span>Import</span>")
  expect(controlsAndFilters).toContain("<SortDropdown")
  expect(controlsAndFilters).toContain("<ViewSelector")
  expect(actions).toContain("mobileActions={null}")
  const drawer = controlsAndFilters.split("<FilterContainer>")[1]
  expect(drawer).toContain("<FilterSection mobileOnly>")
  expect(drawer).toContain("setIsImportOpen(true)")
})
