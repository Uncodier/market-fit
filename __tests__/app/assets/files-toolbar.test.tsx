import { fireEvent, render, screen } from "@testing-library/react"
import AssetsPage from "@/app/assets/page"
import { UploadAssetDialog } from "@/app/components/upload-asset-dialog"
import { localeMessages } from "@/app/context/locale-catalog"

let mockLoadingSite = true

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: { id: "site" }, isLoading: mockLoadingSite }),
}))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => localeMessages.es[key] ?? key }),
}))
jest.mock("@/app/components/ui/sticky-header", () => ({
  StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
}))
jest.mock("@/app/assets/actions", () => ({}))
jest.mock("@/app/assets/components/AssetsTabBody", () => ({ AssetsTabBody: () => null }))
jest.mock("swr", () => ({ __esModule: true, default: () => ({ data: [] }) }))

it("keeps the filters and view switcher together when files finish loading", () => {
  mockLoadingSite = true
  const { rerender } = render(<AssetsPage />)
  const row = screen.getByRole("banner").firstElementChild
  const tabs = screen.getByRole("tablist")
  const listView = screen.getByRole("radio", { name: "Toggle list view" })

  expect(row).toHaveClass("flex", "items-center")
  expect(row?.children[0]).toContainElement(tabs)
  expect(row?.children[1]).toContainElement(listView)
  expect(screen.getByRole("button", { name: "Filtros" })).toBeVisible()
  expect(screen.getByRole("tab", { name: "Todos los archivos", selected: true })).toBeVisible()

  mockLoadingSite = false
  rerender(<AssetsPage />)
  expect(screen.getByRole("tablist")).toBe(tabs)
  expect(screen.getByRole("radio", { name: "Toggle list view" })).toBe(listView)
  fireEvent.click(listView)
  expect(listView).toBeChecked()
})

it.each([["es", "Archivos", "Subir archivo"], ["en", "Files", "Upload File"]] as const)(
  "uses the same file terminology in workspace navigation and Purchases (%s)",
  (locale, title, uploadLabel) => {
    const messages = localeMessages[locale]
    expect(messages["layout.sidebar.assets"]).toBe(title)
    expect(messages["layout.nav.assets.title"]).toBe(title)
    expect(messages["layout.sidebar.purchasesLibrary"]).toBe(title)
    expect(messages["assets.upload.action"]).toBe(uploadLabel)
  },
)

it("uses the file terminology in the upload button and dialog", () => {
  render(<UploadAssetDialog />)
  fireEvent.click(screen.getByRole("button", { name: "Subir archivo" }))
  expect(screen.getByRole("dialog", { name: "Subir un archivo nuevo" })).toBeVisible()
  expect(screen.getByRole("button", { name: "Subir archivo" })).toBeDisabled()
})