import { render, screen } from "@testing-library/react"
import { AssetsLoadingPage } from "@/app/assets/components/AssetsLoadingPage"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))
jest.mock("@/app/components/ui/sticky-header", () => ({
  StickyHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

it("renders the Suspense fallback without unavailable content sort state", () => {
  render(<AssetsLoadingPage />)
  expect(screen.getByRole("button", { name: "Sort assets" })).toBeDisabled()
  expect(screen.getByPlaceholderText("assets.searchPlaceholder")).toBeDisabled()
  expect(screen.getByRole("tab", { name: "assets.tabs.all" })).toBeInTheDocument()
})