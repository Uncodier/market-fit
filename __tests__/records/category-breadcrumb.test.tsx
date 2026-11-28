import { fireEvent, render, screen } from "@testing-library/react"
import { TopBarTitle } from "@/app/components/navigation/TopBarTitle"

let mockPath = "/records"
jest.mock("next/navigation", () => ({ usePathname: () => mockPath, useSearchParams: () => new URLSearchParams() }))
jest.mock("@/app/hooks/use-breadcrumb-history", () => ({ useNavigationHistory: () => ({ items: [], hasHistory: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/components/ui/help-button", () => ({ HelpButton: () => null }))

it("updates the category breadcrumb, returns to all records, and scopes the title to Records", () => {
  const title = <TopBarTitle title="Records" isCollapsed={false} onCollapse={jest.fn()} />
  const view = render(title)
  const publish = (name?: string) => fireEvent(window, new CustomEvent("breadcrumb:update", {
    detail: { path: "/records", title: name || "Records", parentTitle: name ? "Records" : undefined },
  }))
  publish("Sales Weekly Results")
  expect(screen.getByRole("heading", { name: "Sales Weekly Results" })).toHaveAttribute("aria-current", "page")
  publish("Ideas")
  expect(screen.getByRole("heading", { name: "Ideas" })).toBeInTheDocument()
  const onReturn = jest.fn(() => publish())
  window.addEventListener("records:return-to-all", onReturn)
  try {
    fireEvent.click(screen.getByRole("button", { name: "Records" }))
    expect(onReturn).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument()
    publish("Ideas")
    mockPath = "/records/record-id"
    view.rerender(<TopBarTitle title="Records" isCollapsed={false} onCollapse={jest.fn()} />)
    expect(screen.queryByRole("heading", { name: "Ideas" })).not.toBeInTheDocument()
  } finally {
    window.removeEventListener("records:return-to-all", onReturn)
    mockPath = "/records"
  }
})