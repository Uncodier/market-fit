import {
  applyReservationPayments,
  checkoutLinesFromModifiers,
  checkoutLinesFromSaleOrderItems,
  checkoutSourceFromSale,
  mergeReservationLinesIntoOrder,
  resolveExistingSaleOrderId,
  resolveReservationChargeCurrency,
  saleCatalogCurrencyMismatch,
  shouldEnsureReservationSaleOrder,
  shouldRewriteExistingSaleOrder,
  stripCheckoutLinePriceOverrides,
} from "../../app/reservations/ensure-sale-order"

describe("shouldEnsureReservationSaleOrder", () => {
  it("skips team tasks", () => {
    expect(shouldEnsureReservationSaleOrder({ is_task: true })).toBe(false)
    expect(shouldEnsureReservationSaleOrder({ id: "task_abc" })).toBe(false)
  })

  it("runs for service reservations", () => {
    expect(shouldEnsureReservationSaleOrder({ id: "res-1" })).toBe(true)
  })
})

describe("resolveExistingSaleOrderId", () => {
  it("returns undefined when there is no link", () => {
    expect(resolveExistingSaleOrderId({ saleOrderItemId: null })).toBeUndefined()
  })

  it("returns undefined when the linked item is missing (orphan)", () => {
    expect(
      resolveExistingSaleOrderId({
        saleOrderItemId: "soi-1",
        item: null,
      })
    ).toBeUndefined()
  })

  it("returns the living order id", () => {
    expect(
      resolveExistingSaleOrderId({
        saleOrderItemId: "soi-1",
        item: { id: "soi-1", sale_order_id: "order-9" },
      })
    ).toBe("order-9")
  })
})

describe("shouldRewriteExistingSaleOrder", () => {
  it("checkouts when there is no order yet", () => {
    expect(shouldRewriteExistingSaleOrder({ hasExplicitLines: false })).toBe(true)
  })

  it("skips checkout for an existing order unless the modal sent lines", () => {
    expect(
      shouldRewriteExistingSaleOrder({ existingOrderId: "ord-1", hasExplicitLines: false })
    ).toBe(false)
    expect(
      shouldRewriteExistingSaleOrder({ existingOrderId: "ord-1", hasExplicitLines: true })
    ).toBe(true)
  })

  it("rewrites when the sale currency does not match the catalog", () => {
    expect(
      shouldRewriteExistingSaleOrder({
        existingOrderId: "ord-1",
        hasExplicitLines: false,
        currencyMismatch: true,
      })
    ).toBe(true)
  })
})

describe("saleCatalogCurrencyMismatch", () => {
  it("detects a USD sale for MXN catalog items", () => {
    expect(
      saleCatalogCurrencyMismatch({ saleCurrency: "USD", catalogCurrency: "MXN" })
    ).toBe(true)
    expect(
      saleCatalogCurrencyMismatch({ saleCurrency: "mxn", catalogCurrency: "MXN" })
    ).toBe(false)
    expect(
      saleCatalogCurrencyMismatch({ saleCurrency: null, catalogCurrency: "MXN" })
    ).toBe(false)
  })
})

describe("resolveReservationChargeCurrency", () => {
  it("uses the product currency, then the site, then USD", () => {
    expect(
      resolveReservationChargeCurrency({
        catalogCurrency: "mxn",
        siteCurrency: "USD",
      })
    ).toBe("MXN")
    expect(
      resolveReservationChargeCurrency({
        catalogCurrency: null,
        siteCurrency: "eur",
      })
    ).toBe("EUR")
    expect(resolveReservationChargeCurrency({})).toBe("USD")
  })

  it("keeps an existing sale currency when present", () => {
    expect(
      resolveReservationChargeCurrency({
        saleCurrency: "USD",
        catalogCurrency: "MXN",
        siteCurrency: "EUR",
      })
    ).toBe("USD")
  })
})

describe("stripCheckoutLinePriceOverrides", () => {
  it("drops stored unit prices so checkout reloads catalog amounts", () => {
    const stripped = stripCheckoutLinePriceOverrides([
      {
        catalogItemId: "svc-1",
        quantity: 1,
        unitPriceOverride: 14.77,
        modifiers: [{ catalogItemId: "mod-1", quantity: 1, unitPriceOverride: 2 }],
      },
    ])
    expect(stripped[0].unitPriceOverride).toBeUndefined()
    expect(stripped[0].modifiers?.[0].unitPriceOverride).toBeUndefined()
  })
})

describe("checkoutLinesFromSaleOrderItems", () => {
  it("rebuilds host + modifier lines from existing order items", () => {
    const lines = checkoutLinesFromSaleOrderItems({
      reservationId: "res-1",
      reservationStart: "2026-08-14T10:00:00Z",
      reservationEnd: "2026-08-14T11:00:00Z",
      catalogItemId: "svc-1",
      quantity: 1,
      items: [
        {
          id: "parent-1",
          catalog_item_id: "svc-1",
          quantity: 1,
          unit_price: 50,
          parent_sale_order_item_id: null,
          metadata: { client_line_key: "reservation:res-1" },
        },
        {
          id: "mod-1",
          catalog_item_id: "extra-1",
          quantity: 2,
          unit_price: 5,
          parent_sale_order_item_id: "parent-1",
          metadata: { is_modifier: true, modifier_group_id: "g1" },
        },
      ],
    })

    expect(lines).toEqual([
      expect.objectContaining({
        catalogItemId: "svc-1",
        quantity: 1,
        clientLineKey: "reservation:res-1",
        modifiers: [
          expect.objectContaining({
            catalogItemId: "extra-1",
            quantity: 2,
            groupId: "g1",
          }),
        ],
      }),
    ])
  })

  it("falls back to the reservation catalog item when the order has no parents", () => {
    expect(
      checkoutLinesFromModifiers({
        reservationId: "res-2",
        catalogItemId: "svc-9",
        reservationStart: "2026-08-14T10:00:00Z",
        reservationEnd: "2026-08-14T11:00:00Z",
      })
    ).toEqual([
      expect.objectContaining({
        catalogItemId: "svc-9",
        clientLineKey: "reservation:res-2",
      }),
    ])
  })

  it("keeps sibling POS lines when merging a reservation line into an existing order", () => {
    const merged = mergeReservationLinesIntoOrder({
      excludeParentId: "res-item",
      reservationLines: checkoutLinesFromModifiers({
        reservationId: "res-1",
        catalogItemId: "massage",
        reservationStart: "2026-08-14T10:00:00Z",
        reservationEnd: "2026-08-14T11:00:00Z",
      }),
      existingItems: [
        {
          id: "burger",
          catalog_item_id: "burger-1",
          quantity: 1,
          unit_price: 12,
          parent_sale_order_item_id: null,
          metadata: { client_line_key: "pos:burger" },
        },
        {
          id: "res-item",
          catalog_item_id: "old-massage",
          quantity: 1,
          parent_sale_order_item_id: null,
          metadata: { client_line_key: "pos:massage" },
        },
      ],
    })

    expect(merged.map((line) => line.catalogItemId)).toEqual(["burger-1", "massage"])
    expect(merged[0].reservationStart).toBeUndefined()
    expect(merged[1].reservationStart).toBe("2026-08-14T10:00:00Z")
  })
})

describe("checkoutSourceFromSale", () => {
  it("preserves POS and shop sources", () => {
    expect(checkoutSourceFromSale("pos")).toBe("pos")
    expect(checkoutSourceFromSale("shop")).toBe("shop")
    expect(checkoutSourceFromSale("other")).toBe("sales")
  })
})

describe("applyReservationPayments", () => {
  it("appends payments and reduces amount due", () => {
    const next = applyReservationPayments({
      amountDue: 100,
      existingPayments: [{ method: "cash", amount: 20 }],
      newPayments: [{ method: "credit_card", amount: 30 }],
      intent: "pay",
    })

    expect(next.amountDue).toBe(70)
    expect(next.fullyPaid).toBe(false)
    expect(next.saleStatus).toBe("pending")
    expect(next.payments).toHaveLength(2)
    expect(next.payments[1]).toMatchObject({
      method: "credit_card",
      amount: 30,
      status: "completed",
    })
  })

  it("marks the sale completed when the balance is cleared", () => {
    const next = applyReservationPayments({
      amountDue: 40,
      existingPayments: [],
      newPayments: [{ method: "cash", amount: 40, tendered: 50, change: 10 }],
      intent: "pay",
    })

    expect(next.amountDue).toBe(0)
    expect(next.fullyPaid).toBe(true)
    expect(next.saleStatus).toBe("completed")
    expect(next.orderCompleted).toBe(true)
    expect(next.grantEntitlements).toBe(true)
  })

  it("completes the order on account even if a balance remains", () => {
    const next = applyReservationPayments({
      amountDue: 80,
      existingPayments: [],
      newPayments: [],
      intent: "complete",
    })

    expect(next.amountDue).toBe(80)
    expect(next.fullyPaid).toBe(false)
    expect(next.orderCompleted).toBe(true)
    expect(next.grantEntitlements).toBe(true)
  })
})
