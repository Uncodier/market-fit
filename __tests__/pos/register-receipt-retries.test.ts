import { newRegisterReceipts } from "@/app/pos/register/receipt-retries"

const receipt = { payment_id: "receipt", register_session_id: "session", recorded_by: "actor", method: "cash",
  amount: 10, tendered: 20, change: 10, status: "completed", date: "2026-10-18" }
describe("Register receipt retry preservation", () => {
  it("does not double apply a committed receipt when its retry has a later processing date", () => {
    expect(newRegisterReceipts([receipt], [{ ...receipt, date: "2026-10-19" }])).toEqual([])
  })
  it("retains distinct receipts and compatibility untagged payments", () => {
    const fresh = { ...receipt, payment_id: "new" }
    const legacy = { method: "cash", amount: 10 }
    expect(newRegisterReceipts([receipt], [fresh, legacy])).toEqual([fresh, legacy])
  })
  it.each(["register_session_id", "recorded_by", "method", "amount", "tendered", "change", "status"])
  ("rejects altered %s on replay", (field) => {
    expect(() => newRegisterReceipts([receipt], [{ ...receipt, [field]: "forged" }])).toThrow("cannot be changed")
  })
})