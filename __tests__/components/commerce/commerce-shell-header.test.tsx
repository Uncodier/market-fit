import Link from "next/link"
import { render, within } from "@testing-library/react"
import { CommerceShellHeader } from "@/app/components/commerce/CommerceShellHeader"

jest.mock("@/app/components/commerce/ExitDemoMode", () => ({ ExitDemoMode: () => null }))

describe("CommerceShellHeader green glass", () => {
  afterEach(() => document.documentElement.classList.remove("dark"))

  it.each([false, true])("keeps light glass and uses dark olive in dark mode (dark=%s)", dark => {
    document.documentElement.classList.toggle("dark", dark)
    const { container } = render(
      <CommerceShellHeader
        brand={<Link href="/marketplace">Makinari</Link>}
        center={<input aria-label="Search products" />}
        actions={<button type="button">Cart</button>}
      />,
    )
    const header = container.querySelector<HTMLElement>("[data-commerce-shell-header]")!

    expect(header).toHaveClass(
      "bg-white/80", "supports-[backdrop-filter]:bg-white/60", "border-black/5",
      "dark:bg-[#2c3523]/80", "dark:supports-[backdrop-filter]:bg-[#2c3523]/60",
      "dark:border-[#d8edaf]/15", "backdrop-blur-md", "rounded-full", "min-h-[56px]",
    )
    expect(header).not.toHaveClass("dark:bg-background/80", "dark:bg-black-paper")
    expect(within(header).getByRole("link", { name: "Makinari" })).toHaveAttribute("href", "/marketplace")
    expect(within(header).getByRole("textbox", { name: "Search products" })).toBeInTheDocument()
    expect(within(header).getByRole("button", { name: "Cart" })).toBeInTheDocument()
  })

  it("retains the green surface when mobile search is expanded", () => {
    const { container } = render(
      <CommerceShellHeader
        brand="Makinari"
        actions={<button type="button">Cart</button>}
        mobileExpanded={<input aria-label="Mobile search" />}
      />,
    )
    const header = container.querySelector<HTMLElement>("[data-commerce-shell-header]")!

    expect(header).toHaveClass("backdrop-blur-md", "dark:bg-[#2c3523]/80", "dark:supports-[backdrop-filter]:bg-[#2c3523]/60")
    expect(within(header).getByRole("textbox", { name: "Mobile search" }).parentElement).toHaveClass("md:hidden")
    expect(header.querySelector(".md\\:contents")).toBeInTheDocument()
  })
})