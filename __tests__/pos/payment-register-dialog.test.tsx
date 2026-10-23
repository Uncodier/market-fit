import { useState } from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { PaymentConfirmationDialog } from "@/app/pos/components/PaymentConfirmationDialog"
import { PaymentCashRegisterDialog } from "@/app/pos/register/CashRegisterOptions"
import RegisterDashboard from "@/app/pos/register/RegisterDashboard"
import { fetchRegisterDashboard, openPosRegister } from "@/app/pos/operation-client"
import { registerSession } from "./register-ui-fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: null }) }))
jest.mock("@/app/pos/operation-client", () => ({ fetchRegisterDashboard: jest.fn(), openPosRegister: jest.fn() }))
jest.mock("@/app/pos/register/queue-guard", () => ({ withRegisterCloseLock: jest.fn() }))

const locations = [{ id: "store-1", name: "Main store" }]
const empty = { active: null, history: [], hasMore: false, role: "owner", userId: "cashier-1" }
const confirmed = jest.fn()

function Checkout() {
  const [registerOpen, setRegisterOpen] = useState(false)
  const [locationId, setLocationId] = useState("")
  return (
    <PaymentConfirmationDialog open onOpenChange={jest.fn()} totalAmount={19.9} currency="USD"
      onConfirm={(...args) => { confirmed(...args); setRegisterOpen(true) }}>
      <PaymentCashRegisterDialog open={registerOpen} onOpenChange={setRegisterOpen}
        siteId="site-1" locationId={locationId} onLocationChange={setLocationId} locations={locations} currency="USD" />
    </PaymentConfirmationDialog>
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(fetchRegisterDashboard).mockResolvedValue({ data: empty })
  jest.mocked(openPosRegister).mockResolvedValue({ data: registerSession })
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => "11111111-1111-4111-8111-111111111111" })
})

function addPayment(method: string, amount: string) {
  fireEvent.click(screen.getByRole("button", { name: method }))
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: amount } })
  fireEvent.click(screen.getByRole("button", { name: "Add Payment" }))
}

describe("register setup over payment", () => {
  it("selects the sole location and returns to unchanged mixed payments after opening without collecting", async () => {
    render(<Checkout />)
    addPayment("Credit Card", "10")
    addPayment("Cash", "10")
    fireEvent.click(screen.getByRole("button", { name: "Pay & Complete" }))
    const register = await screen.findByRole("dialog", { name: "Cash Register" })
    expect(screen.getByText("Complete Payment").closest('[role="dialog"]')).toHaveAttribute("aria-hidden", "true")
    expect(await within(register).findByLabelText("Opening cash (USD)")).toBeVisible()
    expect(within(register).getByLabelText("Register location")).toHaveValue("store-1")
    expect(fetchRegisterDashboard).toHaveBeenCalledWith({ siteId: "site-1", locationId: "store-1", page: 0 })
    fireEvent.change(within(register).getByLabelText("Opening cash (USD)"), { target: { value: "0" } })
    fireEvent.click(within(register).getByRole("button", { name: "Open register" }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cash Register" })).not.toBeInTheDocument())
    expect(openPosRegister).toHaveBeenCalledWith(expect.objectContaining({ locationId: "store-1", openingAmount: 0 }))
    expect(confirmed).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Fully Paid")).toBeInTheDocument()
    expect(screen.getByText("$0.10")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Pay & Complete" }))
    expect(confirmed.mock.calls[1]).toEqual(confirmed.mock.calls[0])
    await screen.findByLabelText("Opening cash (USD)")
  })

  it("Escape closes only register setup and preserves a partial payment", async () => {
    render(<Checkout />)
    addPayment("Cash", "5")
    fireEvent.click(screen.getByRole("button", { name: "Register Payment Only" }))
    const register = await screen.findByRole("dialog", { name: "Cash Register" })
    await within(register).findByLabelText("Opening cash (USD)")
    fireEvent.keyDown(register, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cash Register" })).not.toBeInTheDocument())
    expect(screen.getByRole("dialog", { name: "Complete Payment" })).toBeInTheDocument()
    expect(screen.getByRole("spinbutton")).toHaveValue(14.9)
    expect(openPosRegister).not.toHaveBeenCalled()
    expect(confirmed).toHaveBeenCalledTimes(1)
  })

  it("requires a location choice when there are multiple locations and no selection", async () => {
    const change = jest.fn()
    render(<RegisterDashboard siteId="site-1" locationId="" onLocationChange={change}
      locations={[...locations, { id: "store-2", name: "Second store" }]} currency="USD" />)
    expect(screen.getByLabelText("Register location")).toHaveValue("")
    expect(fetchRegisterDashboard).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("Register location"), { target: { value: "store-2" } })
    await screen.findByLabelText("Opening cash (USD)")
    expect(change).toHaveBeenCalledWith("store-2")
  })

  it("keeps setup and the payment draft after a rejected register opening", async () => {
    jest.mocked(openPosRegister).mockResolvedValue({ error: "Register access denied" })
    render(<Checkout />)
    addPayment("Cash", "20")
    fireEvent.click(screen.getByRole("button", { name: "Pay & Complete" }))
    const register = await screen.findByRole("dialog", { name: "Cash Register" })
    const opening = await within(register).findByLabelText("Opening cash (USD)")
    fireEvent.change(opening, { target: { value: "10" } })
    await act(async () => { fireEvent.click(within(register).getByRole("button", { name: "Open register" })) })
    expect(await within(register).findByRole("alert")).toHaveTextContent("Register access denied")
    expect(opening).toHaveValue("10")
    expect(confirmed).toHaveBeenCalledTimes(1)
  })
})