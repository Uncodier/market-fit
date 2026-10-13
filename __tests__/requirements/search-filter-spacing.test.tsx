import { readFileSync } from "node:fs"
import path from "node:path"
import { fireEvent, render, screen } from "@testing-library/react"
import { FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))

const pageSource = readFileSync(path.join(process.cwd(), "app/requirements/page.tsx"), "utf8")
const desktopSectionClassName = pageSource.match(/<FilterSection desktopOnly className="([^"]+)"/)?.[1]

describe("Requirements search and filter spacing", () => {
  it("overrides the shared zero desktop gap for both collapsed and expanded search", () => {
    expect(desktopSectionClassName).toBeDefined()

    render(
      <FilterSection desktopOnly className={desktopSectionClassName}>
        <SearchInput placeholder="Search requirements..." containerClassName="w-64" />
        <button type="button">Filters</button>
      </FilterSection>,
    )

    const filters = screen.getByRole("button", { name: "Filters" })
    const section = filters.parentElement
    expect(section).toHaveClass("flex-row", "items-center", "md:gap-2", "max-md:hidden")
    expect(section).not.toHaveClass("md:gap-0")
    expect(section?.firstElementChild).toHaveClass("w-9", "h-9")

    fireEvent.click(screen.getByTitle("Search requirements..."))

    expect(section?.firstElementChild).toHaveClass("w-64")
    expect(section).toHaveClass("md:gap-2")
    expect(section).not.toHaveClass("md:gap-0")
    expect(filters).toBeInTheDocument()
  })

  it("preserves the default spacing for other filter sections", () => {
    const { container } = render(<FilterSection title="Status">Status options</FilterSection>)

    expect(container.firstElementChild).toHaveClass("flex-col", "gap-2.5", "md:gap-0")
  })
})