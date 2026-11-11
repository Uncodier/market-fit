import { render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { TopBar } from "@/app/components/navigation/TopBar"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: null }) }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key === "layout.sidebar.profile" ? "Profile" : key }),
}))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/components/navigation/TopBarTitle", () => ({ TopBarTitle: () => null }))
jest.mock("@/app/components/navigation/PosTopBarActions", () => ({ PosTopBarActions: () => null }))
jest.mock("@/app/components/navigation/PosTopBarSync", () => ({ PosTopBarSync: () => null }))
jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }))

test("does not show a profile or menu shortcut in the mobile top bar", () => {
  jest.mocked(usePathname).mockReturnValue("/robots")
  render(<TopBar title="AI Workspace" isCollapsed onCollapse={jest.fn()} />)
  expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})