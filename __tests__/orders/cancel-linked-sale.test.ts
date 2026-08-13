import {
  hasPriorPayments,
  shouldCancelLinkedSale,
} from "../../app/orders/cancel-linked-sale";

describe("hasPriorPayments", () => {
  it("returns false when there are no payments and nothing has been collected", () => {
    expect(
      hasPriorPayments({
        status: "pending",
        payments: [],
        amount: 100,
        amount_due: 100,
      })
    ).toBe(false);
  });

  it("returns false when payments is missing", () => {
    expect(
      hasPriorPayments({
        status: "pending",
        amount: 50,
        amount_due: 50,
      })
    ).toBe(false);
  });

  it("returns true when a payment with amount was recorded", () => {
    expect(
      hasPriorPayments({
        status: "pending",
        payments: [{ amount: 20 }],
        amount: 100,
        amount_due: 80,
      })
    ).toBe(true);
  });

  it("returns true when amount_due is lower than amount even without a payments array", () => {
    expect(
      hasPriorPayments({
        status: "pending",
        payments: [],
        amount: 100,
        amount_due: 40,
      })
    ).toBe(true);
  });

  it("ignores zero-amount payment entries", () => {
    expect(
      hasPriorPayments({
        status: "pending",
        payments: [{ amount: 0 }],
        amount: 0,
        amount_due: 0,
      })
    ).toBe(false);
  });
});

describe("shouldCancelLinkedSale", () => {
  const unpaidPendingSale = {
    status: "pending",
    payments: [],
    amount: 80,
    amount_due: 80,
  };

  it("cancels the sale when the order is pending and the sale is unpaid", () => {
    expect(shouldCancelLinkedSale("pending", unpaidPendingSale)).toBe(true);
  });

  it("does not cancel when the order was not pending", () => {
    expect(shouldCancelLinkedSale("in_progress", unpaidPendingSale)).toBe(false);
    expect(shouldCancelLinkedSale("completed", unpaidPendingSale)).toBe(false);
  });

  it("does not cancel when there is no linked sale", () => {
    expect(shouldCancelLinkedSale("pending", null)).toBe(false);
  });

  it("does not cancel when the sale is not pending", () => {
    expect(
      shouldCancelLinkedSale("pending", {
        ...unpaidPendingSale,
        status: "completed",
      })
    ).toBe(false);
    expect(
      shouldCancelLinkedSale("pending", {
        ...unpaidPendingSale,
        status: "cancelled",
      })
    ).toBe(false);
  });

  it("does not cancel when the sale already has payments", () => {
    expect(
      shouldCancelLinkedSale("pending", {
        status: "pending",
        payments: [{ amount: 10 }],
        amount: 80,
        amount_due: 70,
      })
    ).toBe(false);
  });
});
