import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { PayoutAdminClient } from "@/app/admin/payouts/components/PayoutAdminClient"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import { toast } from "sonner"

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const payout = {
  id: "payout-fixture",
  requested_credits: 25,
  created_at: "2026-10-01T12:00:00Z",
  site: { name: "Fixture site" },
  bank_details: { accountName: "Fixture name", bankName: "Fixture bank", accountNumber: "fixture-account", routingNumber: "fixture-routing" },
}

describe("payout administration localization", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(window, "confirm").mockReturnValue(true)
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
  })

  afterEach(() => jest.restoreAllMocks())

  it("switches labels without changing banking data or performing a request", () => {
    const view = render(<LocalizationProvider preferredLocale="en"><PayoutAdminClient initialPayouts={[payout]} /></LocalizationProvider>)
    expect(screen.getByRole("button", { name: "Mark as Paid" })).toBeInTheDocument()
    view.rerender(<LocalizationProvider preferredLocale="es"><PayoutAdminClient initialPayouts={[payout]} /></LocalizationProvider>)
    expect(screen.getByRole("button", { name: "Marcar como pagado" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Datos bancarios" })).toBeInTheDocument()
    for (const value of ["Fixture site", "fixture-account", "fixture-routing", "$25.00"]) expect(screen.getByText(value, { exact: false })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("translates confirmation and feedback while preserving the resolve payload", async () => {
    render(<LocalizationProvider preferredLocale="es"><PayoutAdminClient initialPayouts={[payout]} /></LocalizationProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Marcar como pagado" }))
    expect(window.confirm).toHaveBeenCalledWith("¿Confirmas que has completado esta transferencia en el banco?")
    expect(fetch).toHaveBeenCalledWith("/api/payouts/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutId: payout.id, status: "completed" }),
    })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Pago marcado como completado"))
    expect(screen.getByText("No hay pagos pendientes en este momento.")).toBeInTheDocument()
  })

  it("does not resolve a payout when the user cancels confirmation", () => {
    jest.mocked(window.confirm).mockReturnValue(false)
    render(<LocalizationProvider preferredLocale="es"><PayoutAdminClient initialPayouts={[payout]} /></LocalizationProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Marcar como pagado" }))
    expect(fetch).not.toHaveBeenCalled()
  })
})