import { fireEvent, render, screen } from "@testing-library/react"
import { PaymentConfirmationDialog } from "@/app/pos/components/PaymentConfirmationDialog"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: null }) }))

function openDialog(totalAmount: number) {
  const onConfirm = jest.fn()
  render(<PaymentConfirmationDialog open onOpenChange={jest.fn()} totalAmount={totalAmount} onConfirm={onConfirm} currency="USD" />)
  return onConfirm
}

function addPayment(amount: string) {
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: amount } })
  fireEvent.click(screen.getByRole("button", { name: "Add Payment" }))
}

describe("POS payment confirmation precision", () => {
  it.each([
    ["Pay & Complete", "pay"],
    ["Register Payment Only", "send"],
  ])("passes rounded fractional cash change to %s before queueing", (button, intent) => {
    const onConfirm = openDialog(19.9)
    addPayment("20")
    expect(screen.getByText("Fully Paid")).toBeInTheDocument()
    expect(screen.getByText("$0.10")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: button }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith([
      { method: "cash", amount: 19.9, tendered: 20, change: 0.1 },
    ], undefined, intent)
  })

  it("prefills a rounded split balance and confirms mixed payments", () => {
    const onConfirm = openDialog(19.9)
    fireEvent.click(screen.getByRole("button", { name: "Credit Card" }))
    addPayment("10")
    expect(screen.getByRole("spinbutton")).toHaveValue(9.9)
    fireEvent.click(screen.getByRole("button", { name: "Cash" }))
    addPayment("10")
    fireEvent.click(screen.getByRole("button", { name: "Pay & Complete" }))
    expect(onConfirm).toHaveBeenCalledWith([
      { method: "credit_card", amount: 10, tendered: 10, change: 0 },
      { method: "cash", amount: 9.9, tendered: 10, change: 0.1 },
    ], undefined, "pay")
  })

  it("enables completion with no phantom remainder after fractional splits", () => {
    const onConfirm = openDialog(0.8)
    addPayment("0.1")
    expect(screen.getByRole("spinbutton")).toHaveValue(0.7)
    addPayment("0.7")
    expect(screen.queryByRole("button", { name: "Add Payment" })).not.toBeInTheDocument()
    expect(screen.queryByText("Remaining Balance")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pay & Complete" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Pay & Complete" }))
    expect(onConfirm).toHaveBeenCalledWith([
      { method: "cash", amount: 0.1, tendered: 0.1, change: 0 },
      { method: "cash", amount: 0.7, tendered: 0.7, change: 0 },
    ], undefined, "pay")
  })

  it("normalizes entered precision before confirming even a partial payment", () => {
    const onConfirm = openDialog(19.9)
    addPayment("5.555")
    expect(screen.getByRole("spinbutton")).toHaveValue(14.34)
    expect(screen.getByRole("button", { name: "Pay & Complete" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Register Payment Only" }))
    expect(onConfirm).toHaveBeenCalledWith([
      { method: "cash", amount: 5.56, tendered: 5.56, change: 0 },
    ], undefined, "send")
  })

  it.each(["", "-1", "0", "0.001", "1e309", "1e308"])("cannot add invalid input %j", (input) => {
    const onConfirm = openDialog(19.9)
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: input } })
    expect(screen.getByRole("button", { name: "Add Payment" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Add Payment" }))
    expect(screen.getByText("No payments applied yet.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Register Payment Only" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Pay & Complete" })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})