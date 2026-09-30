import { buildOverviewEconomics, economicsNumber } from "@/app/dashboard/overview-economics-data"

const snapshot = {
  ltv: { actual: 240, currency: "USD" },
  cac: { actual: 60, currency: "USD", details: { costSource: "transactions" } },
  cpl: { actual: 12, metadata: { leadsCount: 50 } },
  roi: { actual: 100, details: { totalRevenue: 9000, totalTransactions: 3000, campaignBudget: 5000 } },
}

it("builds snapshot bars from supplied amounts without inventing history or back-solving trends", () => {
  const model = buildOverviewEconomics(snapshot)
  expect(model.valueBars.map(({ name, value }) => ({ name, value }))).toEqual([
    { name: "Customer value", value: 240 }, { name: "Acquisition cost", value: 60 },
  ])
  expect(model.returnBars.map(row => row.value)).toEqual([9000, 3000])
  expect(model.roi).toBe(200)
  expect(model.returnCurrency).toBe("UNSPECIFIED")
  expect(model.cpl.currency).toBe("UNSPECIFIED")
  expect(model).not.toHaveProperty("history")
  expect(model).not.toHaveProperty("ltvCacRatio")
})

it("does not turn no observations, nonfinite values or the infinite-CAC sentinel into zero", () => {
  const model = buildOverviewEconomics({ ...snapshot,
    ltv: { actual: 0, noData: true, currency: "USD" },
    cac: { actual: -1, noData: true, currency: "USD" },
    cpl: { actual: 0, metadata: { leadsCount: 0 } },
  })
  expect(model.ltv.value).toBeNull()
  expect(model.cac.value).toBeNull()
  expect(model.cpl.value).toBeNull()
  expect(model.valueBars).toEqual([])
  expect([null, undefined, "", " ", Infinity, NaN, {}, false].map(economicsNumber)).toEqual(Array(8).fill(null))
  expect(economicsNumber("12.5")).toBe(12.5)
})

it("preserves observed zeros and losses while rejecting a fabricated 100% no-cost ROI", () => {
  const noCost = buildOverviewEconomics({ ...snapshot,
    ltv: { actual: 0, currency: "USD" },
    roi: { actual: 100, details: { totalRevenue: 9000, totalTransactions: 0, campaignBudget: 0 } },
  })
  expect(noCost.ltv.value).toBe(0)
  expect(noCost.roi).toBeNull()
  expect(noCost.returnBars).toEqual([])
  const loss = buildOverviewEconomics({ ...snapshot,
    roi: { actual: 0, details: { totalRevenue: 0, totalTransactions: 300 } },
  })
  expect(loss.roi).toBe(-100)
})

it("discloses budget estimates and never silently compares different currencies", () => {
  const model = buildOverviewEconomics({ ...snapshot,
    cac: { actual: 60, currency: "EUR", details: { costSource: "campaign_budget" } },
    roi: { actual: 200, details: { totalRevenue: 9000, totalTransactions: 0, campaignBudget: 3000 } },
  })
  expect(model.matchingCurrency).toBe(false)
  expect(model.valueBars).toEqual([])
  expect(model.costLabel).toBe("Campaign budget")
  expect(model.returnNote).toContain("Estimated")
  expect(buildOverviewEconomics().roi).toBeNull()
})