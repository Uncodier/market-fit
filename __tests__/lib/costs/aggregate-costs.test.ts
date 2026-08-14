import {
  aggregateByCategory,
  buildCostCategories,
  buildCostDistribution,
  buildMonthlyCostData,
  costRowsInRange,
  exclusiveEndDate,
  inclusiveEndWithUtcSlack,
  parseDateParam,
  getCategoryGroup,
  getTransactionAmount,
  mapPurchasesToCostRows,
  marketingFromCategories,
  overheadFromCategories,
  parseTransactionDate,
  shouldIncludeBillsInCostReport,
  sumCosts,
} from "@/lib/costs/aggregate-costs"

describe("getCategoryGroup", () => {
  it("maps promotions and advertising to Marketing", () => {
    expect(getCategoryGroup("promotions")).toBe("Marketing")
    expect(getCategoryGroup("advertising")).toBe("Marketing")
    expect(getCategoryGroup("content")).toBe("Marketing")
  })

  it("maps cogs labels to Cost of goods sold", () => {
    expect(getCategoryGroup("cogs")).toBe("Cost of goods sold")
    expect(getCategoryGroup("Cost of goods sold")).toBe("Cost of goods sold")
  })

  it("maps operating and freelancer keys to Operations", () => {
    expect(getCategoryGroup("operating")).toBe("Operations")
    expect(getCategoryGroup("freelancers")).toBe("Operations")
  })

  it("falls back to Other for unknown categories", () => {
    expect(getCategoryGroup(null)).toBe("Other")
    expect(getCategoryGroup("unknown-account")).toBe("Other")
  })
})

describe("sumCosts", () => {
  it("includes transactions without a campaign or segment", () => {
    expect(
      sumCosts([
        { amount: 100, category: "cogs", date: "2026-08-07", campaign_id: null },
        { amount: "32.00", category: "promotions", date: "2026-08-13", campaign_id: "camp-1" },
        { amount: 20, category: "promotions", date: "2026-08-12", campaign_id: "camp-1" },
      ])
    ).toBe(152)
  })
})

describe("aggregateByCategory", () => {
  it("groups mixed expense categories without dropping unassigned rows", () => {
    const categories = aggregateByCategory([
      { amount: 100, category: "cogs", date: "2026-08-07" },
      { amount: 32, category: "promotions", date: "2026-08-13" },
      { amount: 20, category: "promotions", date: "2026-08-12" },
    ])

    expect(categories.get("Cost of goods sold")).toBe(100)
    expect(categories.get("Marketing")).toBe(52)
  })
})

describe("buildCostCategories", () => {
  it("computes percent change against the previous period", () => {
    const current = new Map([["Marketing", 52]])
    const previous = new Map([["Marketing", 20]])
    expect(buildCostCategories(current, previous)).toEqual([
      { name: "Marketing", amount: 52, prevAmount: 20, percentChange: 160 },
    ])
  })
})

describe("buildCostDistribution", () => {
  it("rounds each category as a share of the total", () => {
    const categories = new Map([
      ["Marketing", 52],
      ["Cost of goods sold", 100],
    ])
    expect(buildCostDistribution(categories, 152)).toEqual([
      { category: "Marketing", percentage: 34, amount: 52 },
      { category: "Cost of goods sold", percentage: 66, amount: 100 },
    ])
  })
})

describe("buildMonthlyCostData", () => {
  it("uses the full transaction history, not only the selected KPI window", () => {
    const now = new Date(2026, 7, 13)
    const data = buildMonthlyCostData(
      [
        { amount: 100, type: "fixed", category: "cogs", date: "2026-08-07" },
        { amount: 20, type: "variable", category: "promotions", date: "2026-08-12" },
        { amount: 50, type: "variable", category: "advertising", date: "2026-06-15" },
      ],
      6,
      now
    )

    expect(data).toHaveLength(6)
    expect(data[data.length - 1]).toEqual({
      month: "Aug",
      fixedCosts: 100,
      variableCosts: 20,
    })
    expect(data.find((row) => row.month === "Jun")).toEqual({
      month: "Jun",
      fixedCosts: 0,
      variableCosts: 50,
    })
  })
})

describe("widget helpers", () => {
  it("reads marketing and overhead from grouped categories", () => {
    const categories = [
      { name: "Marketing", amount: 52, prevAmount: 20, percentChange: 160 },
      { name: "Administration", amount: 10, prevAmount: 10, percentChange: 0 },
      { name: "Operations", amount: 5, prevAmount: 0, percentChange: 100 },
    ]

    expect(marketingFromCategories(categories).amount).toBe(52)
    expect(overheadFromCategories(categories)).toEqual({
      amount: 15,
      prevAmount: 10,
      percentChange: 50,
    })
  })
})

describe("date helpers", () => {
  it("parses date-only strings as local calendar days", () => {
    expect(parseTransactionDate("2026-08-13")).toEqual(new Date(2026, 7, 13))
  })

  it("uses an exclusive next-day bound so same-day expenses are included", () => {
    expect(exclusiveEndDate(new Date(2026, 7, 13, 22, 36))).toBe("2026-08-14")
  })

  it("parses yyyy-MM-dd query params as calendar days, not UTC midnight", () => {
    expect(parseDateParam("2026-08-13", new Date(2020, 0, 1))).toEqual(new Date(2026, 7, 13))
  })

  it("keeps UTC-shifted date-only expenses inside the selected local day", () => {
    expect(inclusiveEndWithUtcSlack("2026-08-13")).toBe("2026-08-14")
    expect(
      costRowsInRange(
        [
          { amount: 100, category: "cogs", date: "2026-08-07" },
          { amount: 20, category: "promotions", date: "2026-08-13", campaign_id: "camp-1" },
          { amount: 32, category: "promotions", date: "2026-08-14", campaign_id: "camp-1" },
        ],
        "2026-07-13",
        inclusiveEndWithUtcSlack("2026-08-13")
      ).map((row) => row.amount)
    ).toEqual([100, 20, 32])
  })

  it("parses numeric strings with currency noise", () => {
    expect(getTransactionAmount({ amount: "MX$32.00" })).toBe(32)
  })
})

describe("shouldIncludeBillsInCostReport", () => {
  it("includes bills only when campaign and segment are unfiltered", () => {
    expect(shouldIncludeBillsInCostReport("all", "all")).toBe(true)
    expect(shouldIncludeBillsInCostReport(null, undefined)).toBe(true)
    expect(shouldIncludeBillsInCostReport("camp-1", "all")).toBe(false)
    expect(shouldIncludeBillsInCostReport("all", "seg-1")).toBe(false)
  })
})

describe("mapPurchasesToCostRows", () => {
  it("skips draft and cancelled bills", () => {
    expect(
      mapPurchasesToCostRows([
        { id: "1", amount: 40, purchase_date: "2026-08-10", status: "draft" },
        { id: "2", amount: 60, purchase_date: "2026-08-10", status: "cancelled" },
      ])
    ).toEqual([])
  })

  it("maps a bill without items to operating costs", () => {
    expect(
      mapPurchasesToCostRows([
        { id: "1", amount: 80, purchase_date: "2026-08-10", status: "pending" },
      ])
    ).toEqual([
      { amount: 80, category: "operating", date: "2026-08-10", type: "variable" },
    ])
  })

  it("splits product lines to COGS and the remainder to operations", () => {
    const rows = mapPurchasesToCostRows(
      [{ id: "1", amount: 150, purchase_date: "2026-08-10", status: "completed" }],
      [
        {
          purchase_id: "1",
          catalog_item_id: "sku-1",
          subtotal: 100,
          catalog_items: { kind: "product" },
        },
        {
          purchase_id: "1",
          catalog_item_id: "svc-1",
          subtotal: 50,
          catalog_items: { kind: "service" },
        },
      ]
    )

    expect(rows).toEqual([
      { amount: 100, category: "cogs", date: "2026-08-10", type: "variable" },
      { amount: 50, category: "operating", date: "2026-08-10", type: "variable" },
    ])
  })

  it("filters mapped bill rows with an inclusive end date", () => {
    const rows = mapPurchasesToCostRows([
      { id: "1", amount: 20, purchase_date: "2026-08-12", status: "completed" },
      { id: "2", amount: 40, purchase_date: "2026-08-13", status: "completed" },
    ])
    expect(costRowsInRange(rows, "2026-08-13", "2026-08-13").map((row) => row.amount)).toEqual([40])
    expect(costRowsInRange(rows, "2026-08-12", "2026-08-14").map((row) => row.amount)).toEqual([20, 40])
  })
})
