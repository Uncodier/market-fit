import { fireEvent, render, screen } from "@testing-library/react"
import { ShopHeroTrust } from "@/app/shop/[siteSlug]/ShopHeroTrust"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    locale: "en",
    t: (key: string, vars?: { time?: string }) => {
      if (key === "shop.closed") return "Closed"
      if (key === "shop.closedOpens") return `Closed · Opens ${vars?.time}`
      if (key === "shop.unavailableInYourArea") return "Unavailable in your area"
      return key
    },
  }),
}))

jest.mock("@/app/components/commerce/ProgressiveImage", () => ({
  ProgressiveImage: () => <div data-testid="hero-image" />,
}))

jest.mock("@/app/components/ui/date-picker", () => ({
  DatePicker: ({
    trigger,
    setDate,
  }: {
    trigger: React.ReactNode
    setDate: (date: Date) => void
  }) => (
    <div>
      {trigger}
      <button type="button" onClick={() => setDate(new Date("2026-08-27T10:00:00"))}>
        pick-schedule
      </button>
    </div>
  ),
}))

const site = {
  name: "Clemente",
  settings: {
    shop: {
      hero_title: "Barbershop and bar CLEMENTE",
    },
  },
}

describe("ShopHeroTrust search visibility", () => {
  it.each([true, false])("hides the order bar during search and restores it (configured hero=%s)", (hasHero) => {
    const searchSite = {
      settings: {
        shop: {
          ...(hasHero ? site.settings.shop : {}),
          trust_badges: [{ title: "Secure checkout" }],
        },
      },
    }
    const fulfillment = jest.fn((tone: string) => <div data-testid="order-bar">{tone}</div>)
    const { rerender } = render(<ShopHeroTrust site={searchSite} searchQuery="" fulfillment={fulfillment} />)

    expect(screen.getByTestId("order-bar")).toHaveTextContent(hasHero ? "hero" : "default")
    expect(screen.getAllByText("Secure checkout").length).toBeGreaterThan(0)
    fulfillment.mockClear()

    rerender(<ShopHeroTrust site={searchSite} searchQuery="  coffee  " fulfillment={fulfillment} />)

    expect(screen.queryByText(site.settings.shop.hero_title)).not.toBeInTheDocument()
    expect(screen.queryByText("Secure checkout")).not.toBeInTheDocument()
    expect(screen.queryByTestId("order-bar")).not.toBeInTheDocument()
    expect(fulfillment).not.toHaveBeenCalled()

    rerender(<ShopHeroTrust site={searchSite} searchQuery="" fulfillment={fulfillment} />)

    expect(screen.getByTestId("order-bar")).toHaveTextContent(hasHero ? "hero" : "default")
    if (hasHero) expect(screen.getByText(site.settings.shop.hero_title)).toBeInTheDocument()
  })

  it("does not hide the hero or order bar for whitespace-only input", () => {
    render(<ShopHeroTrust site={site} searchQuery="   " fulfillment={() => <div data-testid="order-bar" />} />)

    expect(screen.getByText(site.settings.shop.hero_title)).toBeInTheDocument()
    expect(screen.getByTestId("order-bar")).toBeInTheDocument()
  })
})

describe("ShopHeroTrust status chips", () => {
  it("opens the schedule picker from the closed chip", () => {
    const setScheduledFor = jest.fn()
    const setOrderTiming = jest.fn()

    render(
      <ShopHeroTrust
        site={site}
        searchQuery=""
        isOpen={false}
        nextOpenSlot={{ at: new Date("2026-08-27T10:00:00"), label: "10:00 AM" }}
        locationAvailable
        scheduledFor={null}
        setScheduledFor={setScheduledFor}
        setOrderTiming={setOrderTiming}
      />
    )

    expect(screen.getByRole("button", { name: /Closed · Opens 10:00 AM/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "pick-schedule" }))
    expect(setScheduledFor).toHaveBeenCalledTimes(1)
    expect(setOrderTiming).toHaveBeenCalledWith("scheduled")
  })

  it("opens the location sheet from the unavailable chip", () => {
    const onUnavailableClick = jest.fn()

    render(
      <ShopHeroTrust
        site={site}
        searchQuery=""
        locationAvailable={false}
        onUnavailableClick={onUnavailableClick}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Unavailable in your area/i }))
    expect(onUnavailableClick).toHaveBeenCalledTimes(1)
  })
})
