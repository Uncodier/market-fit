import type { RegisterSession, RegisterSummary } from "@/app/pos/register/types";

export const registerSummary: RegisterSummary = {
  opening_amount: 100, cash_received: 50, cash_in: 20, cash_out: 10,
  cash_refunds: 5, expected_amount: 155, total_received: 120,
  payment_totals: { cash: 50, card: 70 }, receipt_count: 2,
  movements: [{ id: "movement-1", kind: "cash_in", amount: 20, reason: "Float replenishment", actor_id: "cashier-1", created_at: "2026-10-01T12:00:00Z" }],
  receipts: [{ id: "receipt-1", sale_id: "sale-1", method: "cash", amount: 50, tendered: 60, change: 10, actor_id: "cashier-1", received_at: "2026-10-01T13:00:00Z" }],
};

export const registerSession: RegisterSession = {
  id: "session-1", site_id: "site-1", location_id: "store-1", currency: "USD",
  opened_by: "cashier-1", closed_by: null, opened_at: "2026-10-01T10:00:00Z", closed_at: null,
  opening_amount: 100, counted_amount: null, expected_amount: null, difference: null,
  notes: "", status: "open", snapshot: null,
};

export const closedRegisterSession: RegisterSession = {
  ...registerSession, status: "closed", closed_by: "manager-1", closed_at: "2026-10-01T18:00:00Z",
  counted_amount: 150, expected_amount: 155, difference: -5, notes: "Short by five", snapshot: registerSummary,
};