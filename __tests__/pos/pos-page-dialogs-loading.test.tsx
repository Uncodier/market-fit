import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import dynamic from "next/dynamic"
import { PosPageDialogs } from "@/app/pos/components/PosPageDialogs"
import { scheduleDialogChunkWarming, warmSelectedReservationAvailability } from "@/app/pos/components/pos-dialog-preload"

// Model a chunk that is still loading. The installed Next loader supplies no props
// to this fallback; cancellation must come from the surrounding dialog context.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: jest.fn((_loader, options) => options.loading),
}))
jest.mock("@/app/pos/components/pos-dialog-preload", () => ({
  scheduleDialogChunkWarming: jest.fn(() => jest.fn()),
  warmSelectedReservationAvailability: jest.fn(() => jest.fn()),
}))
jest.mock("@/app/pos/components/PosOptionsDialog", () => ({ PosOptionsDialog: () => null }))
jest.mock("@/app/pos/components/PosRequireLeadDialog", () => ({ PosRequireLeadDialog: () => null }))
jest.mock("@/app/components/commerce/DynamicQuoteFieldsModal", () => ({ DynamicQuoteFieldsModal: () => null }))
jest.mock("@/app/pos/components/PaymentConfirmationDialog", () => ({ PaymentConfirmationDialog: () => null }))
jest.mock("@/app/pos/components/PosReservationDialog", () => ({ PosReservationDialog: () => null }))
jest.mock("@/app/pos/components/PosDigitalAssetDialog", () => ({ PosDigitalAssetDialog: () => null }))
jest.mock("@/app/pos/components/PosSplitBillDialog", () => ({ PosSplitBillDialog: () => null }))

type Props = Parameters<typeof PosPageDialogs>[0]

function props(): Props {
  return {
    siteId: "site-1",
    cartApi: { cart: [], leadValue: null, priceListId: "none" },
    catalog: { catalogItems: [], leads: [], promotions: [], priceLists: [], priceListItems: [] },
    checkout: { isPaymentDialogOpen: false, setIsPaymentDialogOpen: jest.fn(), handleCheckout: jest.fn() },
    addApi: {
      optionsParentItem: null, reservationItem: null, digitalItem: null, dynamicQuoteItem: null,
      setReservationItem: jest.fn(), setDigitalItem: jest.fn(),
    },
    leadApi: {},
    leadGate: null,
    setLeadGate: jest.fn(),
    isSplitBillOpen: false,
    setIsSplitBillOpen: jest.fn(),
    t: (key: string) => key,
  } as unknown as Props
}

describe("POS lazy dialog feedback", () => {
  beforeEach(() => {
    jest.mocked(scheduleDialogChunkWarming).mockClear()
    jest.mocked(warmSelectedReservationAvailability).mockClear()
    jest.mocked(global.fetch).mockClear()
  })

  it("does not mount closed dynamic dialogs and cleans up code-only warming", async () => {
    const { unmount } = render(<PosPageDialogs {...props()} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(scheduleDialogChunkWarming).toHaveBeenCalledTimes(1)
    expect(warmSelectedReservationAvailability).not.toHaveBeenCalled()
    const [loaders] = jest.mocked(scheduleDialogChunkWarming).mock.calls[0]
    expect(loaders).toHaveLength(4)
    await Promise.all(loaders.map((load) => load()))
    expect(global.fetch).not.toHaveBeenCalled()
    const cleanup = jest.mocked(scheduleDialogChunkWarming).mock.results[0].value
    unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it.each(["payment", "reservation", "digital", "split"] as const)(
    "shows an immediate standard %s dialog with working Cancel before the chunk arrives",
    async (kind) => {
      const input = props()
      const cancel = jest.fn()
      let expectedTitle = ""
      if (kind === "payment") {
        input.checkout.isPaymentDialogOpen = true
        input.checkout.setIsPaymentDialogOpen = cancel
        expectedTitle = "Complete Payment"
      } else if (kind === "reservation") {
        input.addApi.reservationItem = { id: "service-1", name: "Massage" } as NonNullable<Props["addApi"]["reservationItem"]>
        input.addApi.setReservationItem = cancel
        expectedTitle = "Massage - Book service"
      } else if (kind === "digital") {
        input.addApi.digitalItem = { id: "asset-1", name: "E-book" } as NonNullable<Props["addApi"]["digitalItem"]>
        input.addApi.setDigitalItem = cancel
        expectedTitle = "E-book - Assign buyer"
      } else {
        input.isSplitBillOpen = true
        input.setIsSplitBillOpen = cancel
        expectedTitle = "Split Bill"
      }

      const { rerender } = render(<PosPageDialogs {...input} />)
      expect(screen.getByRole("dialog", { name: expectedTitle })).toBeInTheDocument()
      expect(screen.getByRole("status")).toHaveTextContent("Loading...")
      expect(screen.getByRole("button", { name: "Close" })).toBeEnabled()
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
      expect(cancel).toHaveBeenCalledWith(kind === "reservation" || kind === "digital" ? null : false)
      rerender(<PosPageDialogs {...props()} />)
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
      expect(scheduleDialogChunkWarming).toHaveBeenCalledTimes(1)
    },
  )

  it("keeps Escape dismissal available while loading", () => {
    const input = props()
    input.isSplitBillOpen = true
    render(<PosPageDialogs {...input} />)
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(input.setIsSplitBillOpen).toHaveBeenCalledWith(false)
  })

  it("warms only the selected reservable item while choosing options and cancels on change", () => {
    const input = props()
    input.addApi.optionsParentItem = { id: "service-1", is_reservation: true } as NonNullable<Props["addApi"]["optionsParentItem"]>
    const { rerender } = render(<PosPageDialogs {...input} />)
    expect(warmSelectedReservationAvailability).toHaveBeenCalledWith("service-1")
    const cancel = jest.mocked(warmSelectedReservationAvailability).mock.results[0].value

    // The same item moving from options to reservation reuses the same warming.
    rerender(<PosPageDialogs {...input} addApi={{ ...input.addApi,
      optionsParentItem: null, reservationItem: input.addApi.optionsParentItem,
    }} />)
    expect(warmSelectedReservationAvailability).toHaveBeenCalledTimes(1)

    rerender(<PosPageDialogs {...props()} />)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it.each([
    { id: "product-1", is_reservation: false },
    { id: "access-1", is_reservation: true, is_recurring: true },
  ])("does not prefetch options that need no checkout slot: $id", (item) => {
    const input = props()
    input.addApi.optionsParentItem = item as NonNullable<Props["addApi"]["optionsParentItem"]>
    render(<PosPageDialogs {...input} />)
    expect(warmSelectedReservationAvailability).not.toHaveBeenCalled()
  })

  it("does not prefetch without a site", () => {
    const input = props()
    input.siteId = undefined
    input.addApi.reservationItem = { id: "service-1" } as NonNullable<Props["addApi"]["reservationItem"]>
    render(<PosPageDialogs {...input} />)
    expect(warmSelectedReservationAvailability).not.toHaveBeenCalled()
  })

  it("keeps module-level Next loaders with matching explicit import paths", () => {
    const paths = ["PaymentConfirmationDialog", "PosReservationDialog", "PosDigitalAssetDialog", "PosSplitBillDialog"]
    const calls = jest.mocked(dynamic).mock.calls
    expect(calls).toHaveLength(4)
    calls.forEach(([load, options], index) => {
      expect(String(load)).toContain(`./${paths[index]}`)
      expect(options).toMatchObject({ ssr: false, loading: expect.any(Function) })
    })
  })
})