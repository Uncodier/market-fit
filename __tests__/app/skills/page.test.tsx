import { fireEvent, render, screen, within } from "@testing-library/react"
import { useRouter, useSearchParams } from "next/navigation"
import SkillsPage from "@/app/skills/page"

jest.mock("@/app/components/ui/sticky-header", () => ({
  StickyHeader: ({ children }: { children: React.ReactNode }) => <header data-testid="sticky-header">{children}</header>,
}))
jest.mock("@/app/components/ui/quick-nav", () => ({
  QuickNav: ({ sections }: { sections: { id: string; title: string; children?: { id: string; title: string }[] }[] }) => (
    <aside data-testid="skills-quick-nav">
      {sections.map(section => (
        <div key={section.id}>
          <button type="button" onClick={() => document.getElementById(section.id)?.scrollIntoView()}>{section.title}</button>
          {section.children?.map(child => (
            <button type="button" key={child.id} onClick={() => document.getElementById(child.id)?.scrollIntoView()}>{child.title}</button>
          ))}
        </div>
      ))}
    </aside>
  ),
}))
jest.mock("@/app/components/settings/SkillManager", () => ({ SkillManager: () => <div>Manage site skills</div> }))
jest.mock("@/app/components/settings/SystemSkillsCatalog", () => ({
  SystemSkillsCatalog: ({ onSectionsChange }: {
    onSectionsChange?: (sections: { id: string; title: string; children?: { id: string; title: string }[] }[]) => void
  }) => <div>
    Current Makinari skills
    <button type="button" onClick={() => onSectionsChange?.([
      { id: "current-skills", title: "Current skills" },
      { id: "current-skill-roles", title: "Roles", children: [
        { id: "system-skill-makinari-rol-frontend", title: "frontend" },
      ] },
    ])}>Load role index</button>
    <div id="system-skill-makinari-rol-frontend">Frontend skill card</div>
  </div>,
}))
jest.mock("@/app/components/settings/CommunitySkillsBrowser", () => ({ CommunitySkillsBrowser: () => <div>Browse community</div> }))
jest.mock("@/app/components/settings/SkillsSection", () => ({ SkillsSection: () => <div>Makinari skill guides</div> }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))

const searchParamsMock = useSearchParams as jest.Mock
const routerMock = useRouter as jest.Mock

describe("Skills screen", () => {
  const replace = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    routerMock.mockReturnValue({ replace })
    searchParamsMock.mockReturnValue({ get: () => null })
  })

  it("uses StickyHeader and keeps Manage, Browse and Makinari Skills separate", () => {
    render(<SkillsPage />)
    expect(screen.getByTestId("sticky-header")).toContainElement(screen.getByRole("tablist"))
    expect(screen.getAllByRole("tab")).toHaveLength(3)
    expect(screen.getByRole("tab", { name: "Manage" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Manage site skills")).toBeVisible()
    expect(screen.getByTestId("skills-quick-nav")).toHaveTextContent("Upload or editYour skills")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Browse" }), { button: 0 })
    fireEvent.click(screen.getByRole("tab", { name: "Browse" }))
    expect(screen.getByText("Browse community")).toBeVisible()
    expect(screen.queryByText("Manage site skills")).not.toBeInTheDocument()
    expect(screen.getByTestId("skills-quick-nav")).toHaveTextContent("Search skillsSearch resultsImport from URL")
    expect(replace).toHaveBeenCalledWith("/skills?tab=browse", { scroll: false })
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Makinari Skills" }), { button: 0 })
    fireEvent.click(screen.getByRole("tab", { name: "Makinari Skills" }))
    expect(screen.getByText("Current Makinari skills")).toBeVisible()
    expect(screen.getByText("Makinari skill guides")).toBeVisible()
    expect(screen.getByTestId("skills-quick-nav")).toHaveTextContent("Current skills")
    expect(screen.queryByText("Browse community")).not.toBeInTheDocument()
  })

  it("opens Browse directly from the URL", () => {
    searchParamsMock.mockReturnValue({ get: (key: string) => key === "tab" ? "browse" : null })
    render(<SkillsPage />)
    expect(screen.getByRole("tab", { name: "Browse" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Browse community")).toBeVisible()
  })

  it("adds loaded roles to the Makinari quick navigation and navigates to their cards", () => {
    searchParamsMock.mockReturnValue({ get: (key: string) => key === "tab" ? "makinari-skills" : null })
    render(<SkillsPage />)
    const quickNav = screen.getByTestId("skills-quick-nav")
    expect(within(quickNav).queryByRole("button", { name: "frontend" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Load role index" }))
    expect(within(quickNav).getByRole("button", { name: "Roles" })).toBeInTheDocument()
    const target = document.getElementById("system-skill-makinari-rol-frontend")!
    const scrollIntoView = jest.fn()
    target.scrollIntoView = scrollIntoView
    fireEvent.click(within(quickNav).getByRole("button", { name: "frontend" }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it("opens Manage from the robot selector deep link", () => {
    searchParamsMock.mockReturnValue({ get: (key: string) => key === "tab" ? "manage" : null })
    render(<SkillsPage />)
    expect(screen.getByRole("tab", { name: "Manage" })).toHaveAttribute("aria-selected", "true")
  })
})
