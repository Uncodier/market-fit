import {
  convertedLeadDate,
  convertedLeadValue,
  sumCompletedSalesByLead,
} from "@/lib/leads/converted-lead-value"

describe("sumCompletedSalesByLead", () => {
  it("sums completed sales per lead and ignores cancelled or pending ones", () => {
    expect(
      sumCompletedSalesByLead([
        { lead_id: "a", amount: 10, status: "completed" },
        { lead_id: "a", amount: "15.5", status: "completed" },
        { lead_id: "a", amount: 99, status: "cancelled" },
        { lead_id: "b", amount: 20, status: "pending" },
        { lead_id: "b", amount: 8, status: "completed" },
        { lead_id: null, amount: 50, status: "completed" },
      ])
    ).toEqual({ a: 25.5, b: 8 })
  })
})

describe("convertedLeadValue", () => {
  it("uses completed sales total when present", () => {
    expect(
      convertedLeadValue(
        {
          attribution: {
            user_id: "u1",
            user_name: "Ada",
            date: "2026-08-13T00:00:00.000Z",
            final_amount: 40,
            is_market_fit_influenced: true,
          },
        },
        120
      )
    ).toBe(120)
  })

  it("falls back to attribution final_amount", () => {
    expect(
      convertedLeadValue({
        attribution: {
          user_id: "u1",
          user_name: "POS",
          date: "2026-08-13T00:00:00.000Z",
          final_amount: 42,
          is_market_fit_influenced: false,
        },
      })
    ).toBe(42)
  })

  it("does not treat a missing lead.value field as the conversion amount", () => {
    expect(convertedLeadValue({ attribution: null }, 0)).toBe(0)
  })
})

describe("convertedLeadDate", () => {
  it("prefers attribution date over created_at", () => {
    expect(
      convertedLeadDate({
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
        attribution: {
          user_id: "u1",
          user_name: "Ada",
          date: "2026-08-13T00:00:00.000Z",
          is_market_fit_influenced: true,
        },
      })
    ).toBe("2026-08-13T00:00:00.000Z")
  })
})
