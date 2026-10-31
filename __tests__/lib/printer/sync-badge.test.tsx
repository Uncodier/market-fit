import { fireEvent, render, screen } from "@testing-library/react"
import { PrinterSyncBadge } from "@/app/components/printer/PrinterSyncBadge"
import { usePrinterStationStatus, type LivePrinterStatus } from "@/lib/printer/hooks/use-printer-station-status"

jest.mock("@/lib/printer/hooks/use-printer-station-status", () => ({ usePrinterStationStatus: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/components/printer/PrinterFirstAidDialog", () => ({
  PrinterFirstAidDialog: ({ open }: { open: boolean }) => open ? <div>Printer assistance</div> : null,
}))

describe("printer status badge", () => {
  it.each(["disconnected", "unpaired", "unsupported"] as const)("shows %s in red without opening automatic assistance", (state) => {
    const status: LivePrinterStatus = {
      state, configured: 1, ready: 0,
      reconnect: jest.fn(), confirm: jest.fn(), reconnecting: false,
    }
    jest.mocked(usePrinterStationStatus).mockReturnValue(status)
    render(<PrinterSyncBadge module="pos" />)

    const badge = screen.getByRole("button")
    expect(badge).toHaveClass("text-red-800")
    expect(screen.queryByText("Printer assistance")).not.toBeInTheDocument()
    expect(status.confirm).not.toHaveBeenCalled()
    expect(status.reconnect).not.toHaveBeenCalled()

    fireEvent.click(badge)
    expect(screen.getByText("Printer assistance")).toBeInTheDocument()
  })
})