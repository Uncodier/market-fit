import { selectOrdersLinkedToUnpaidSales } from "@/app/pos/list-open-orders";

describe("selectOrdersLinkedToUnpaidSales", () => {
  it("drops orders whose sale has no remaining balance", () => {
    const selected = selectOrdersLinkedToUnpaidSales(
      [
        {
          id: "paid-pending",
          sale_id: "sale-paid",
          status: "pending",
          created_at: "2026-08-13T12:00:00.000Z",
        },
        {
          id: "unpaid-pending",
          sale_id: "sale-open",
          status: "pending",
          created_at: "2026-08-13T11:00:00.000Z",
        },
        {
          id: "unpaid-completed",
          sale_id: "sale-tab",
          status: "completed",
          created_at: "2026-08-13T10:00:00.000Z",
        },
        {
          id: "orphan",
          sale_id: "sale-missing",
          status: "pending",
          created_at: "2026-08-13T09:00:00.000Z",
        },
      ],
      [
        { id: "sale-paid", amount_due: 0, status: "completed" },
        { id: "sale-open", amount_due: 18, status: "pending" },
        { id: "sale-tab", amount_due: 9, status: "completed" },
      ],
    );

    expect(selected.map((o) => o.id)).toEqual([
      "unpaid-pending",
      "unpaid-completed",
    ]);
    expect(selected[0]?.sales?.amount_due).toBe(18);
  });

  it("hides kitchen tickets when payments cover amount even if amount_due is stale", () => {
    const selected = selectOrdersLinkedToUnpaidSales(
      [
        {
          id: "stale-due",
          sale_id: "sale-stale",
          status: "pending",
          created_at: "2026-08-13T12:00:00.000Z",
        },
      ],
      [
        {
          id: "sale-stale",
          amount: 20,
          amount_due: 20,
          status: "pending",
          payments: [{ amount: 20 }],
        },
      ],
    );

    expect(selected).toEqual([]);
  });
});
