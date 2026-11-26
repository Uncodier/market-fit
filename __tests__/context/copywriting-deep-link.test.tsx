import { render, screen } from "@testing-library/react"
import { useSearchParams } from "next/navigation"
import ContextPage from "@/app/context/page"

jest.mock("next/navigation", () => ({ useSearchParams: jest.fn() }))
jest.mock("@/app/hooks/use-prevent-refresh", () => ({ useSimpleRefreshPrevention: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({}) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({}) }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: "header" }))
jest.mock("@/app/components/ui/quick-nav", () => ({ QuickNav: () => null }))
jest.mock("@/app/components/settings/data-adapter", () => ({ adaptSiteToForm: () => ({}) }))
jest.mock("@/app/components/settings/save-handlers", () => ({}))
jest.mock("@/app/components/settings/context-form", () => ({
  ContextForm: ({ activeSegment }: { activeSegment: string }) => <p>Editor: {activeSegment}</p>,
}))

const mockSite = { id: "site-1", name: "Test Site" }

describe("Context Copy Sequences deep link", () => {
  it.each([
    ["tab=copywriting", "Copy Sequences", "copywriting"],
    ["", "Branding", "branding"],
    ["tab=unknown", "Branding", "branding"],
  ])("selects the correct editor for query %j", (query, tab, editor) => {
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query))
    render(<ContextPage />)

    expect(screen.getByRole("tab", { name: tab, selected: true })).toBeInTheDocument()
    expect(screen.getByText(`Editor: ${editor}`)).toBeInTheDocument()
  })
})