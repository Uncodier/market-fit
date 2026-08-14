import {
  isPosOpenOrder,
  isPosOrderPaid,
  selectPosOpenOrders,
} from "@/app/pos/open-orders";

describe("POS open orders", () => {
  it("treats amount_due 0 as paid", () => {
    expect(
      isPosOrderPaid({
        status: "pending",
        sales: { amount_due: 0 },
      }),
    ).toBe(true);
    expect(
      isPosOpenOrder({
        status: "in_progress",
        sales: { amount_due: 0 },
      }),
    ).toBe(false);
  });

  it("keeps pending and completed unpaid orders", () => {
    expect(
      isPosOpenOrder({
        status: "pending",
        sales: { amount_due: 18 },
      }),
    ).toBe(true);
    expect(
      isPosOpenOrder({
        status: "completed",
        sales: { amount_due: 12 },
      }),
    ).toBe(true);
  });

  it("hides paid completed orders even when listed together", () => {
    const selected = selectPosOpenOrders([
      {
        id: "paid-pending",
        status: "pending",
        created_at: "2026-08-13T12:00:00.000Z",
        sales: { amount_due: 0, status: "completed" },
      },
      {
        id: "open-pending",
        status: "pending",
        created_at: "2026-08-13T11:00:00.000Z",
        sales: { amount_due: 20 },
      },
      {
        id: "completed-unpaid",
        status: "completed",
        created_at: "2026-08-13T13:00:00.000Z",
        sales: { amount_due: 9 },
      },
      {
        id: "completed-paid",
        status: "completed",
        created_at: "2026-08-13T14:00:00.000Z",
        sales: { amount_due: 0 },
      },
    ] as any[]);

    expect(selected.map((o: any) => o.id)).toEqual([
      "open-pending",
      "completed-unpaid",
    ]);
  });

  it("sorts pending, in progress, then completed unpaid", () => {
    const selected = selectPosOpenOrders([
      {
        id: "completed",
        status: "completed",
        created_at: "2026-08-13T15:00:00.000Z",
        sales: { amount_due: 4 },
      },
      {
        id: "pending-new",
        status: "pending",
        created_at: "2026-08-13T16:00:00.000Z",
        sales: { amount_due: 8 },
      },
      {
        id: "in-progress",
        status: "in_progress",
        created_at: "2026-08-13T14:00:00.000Z",
        sales: { amount_due: 6 },
      },
      {
        id: "pending-old",
        status: "pending",
        created_at: "2026-08-13T10:00:00.000Z",
        sales: { amount_due: 8 },
      },
    ] as any[]);

    expect(selected.map((o: any) => o.id)).toEqual([
      "pending-new",
      "pending-old",
      "in-progress",
      "completed",
    ]);
  });

  it("respects local payment_status when sales are missing", () => {
    expect(
      isPosOpenOrder({ status: "completed", payment_status: "paid" }),
    ).toBe(false);
    expect(
      isPosOpenOrder({ status: "completed", payment_status: "unpaid" }),
    ).toBe(true);
  });

  it("hides pending kitchen orders whose sale is already completed", () => {
    expect(
      isPosOpenOrder({
        status: "pending",
        sales: { status: "completed" },
      }),
    ).toBe(false);
  });

  it("hides pending orders when payments already cover the sale", () => {
    expect(
      isPosOpenOrder({
        status: "pending",
        sales: {
          amount: 20,
          amount_due: 20,
          payments: [{ amount: 20 }],
        },
      }),
    ).toBe(false);
  });

  it("keeps completed unpaid even when the sale status is completed", () => {
    expect(
      isPosOpenOrder({
        status: "completed",
        sales: { status: "completed", amount_due: 15, amount: 15 },
      }),
    ).toBe(true);
  });
});
