import {
  commerceConversionAttribution,
  commerceLeadCreateFields,
  ensureCommerceLeadConverted,
  isCommerceLeadSource,
  journeyTaskSpecs,
  shouldAssignCommerceOrigin,
} from "../../app/commerce/ensure-commerce-lead-converted";

describe("isCommerceLeadSource", () => {
  it("accepts pos, shop, and marketplace", () => {
    expect(isCommerceLeadSource("pos")).toBe(true);
    expect(isCommerceLeadSource("shop")).toBe(true);
    expect(isCommerceLeadSource("marketplace")).toBe(true);
  });

  it("rejects quote and other channels", () => {
    expect(isCommerceLeadSource("quote")).toBe(false);
    expect(isCommerceLeadSource("sales")).toBe(false);
    expect(isCommerceLeadSource(null)).toBe(false);
    expect(isCommerceLeadSource(undefined)).toBe(false);
  });
});

describe("shouldAssignCommerceOrigin", () => {
  it("assigns when origin is missing or inbound", () => {
    expect(shouldAssignCommerceOrigin(null)).toBe(true);
    expect(shouldAssignCommerceOrigin(undefined)).toBe(true);
    expect(shouldAssignCommerceOrigin("")).toBe(true);
    expect(shouldAssignCommerceOrigin("inbound")).toBe(true);
    expect(shouldAssignCommerceOrigin("Inbound")).toBe(true);
  });

  it("keeps campaign and other origins", () => {
    expect(shouldAssignCommerceOrigin("website")).toBe(false);
    expect(shouldAssignCommerceOrigin("referral")).toBe(false);
    expect(shouldAssignCommerceOrigin("pos")).toBe(false);
  });
});

describe("commerceLeadCreateFields", () => {
  it("sets origin and new status when unpaid", () => {
    expect(commerceLeadCreateFields("shop", false)).toEqual({
      status: "new",
      origin: "shop",
    });
  });

  it("sets converted when paid", () => {
    expect(commerceLeadCreateFields("pos", true)).toEqual({
      status: "converted",
      origin: "pos",
    });
  });
});

describe("commerceConversionAttribution", () => {
  it("uses channel label and system notes", () => {
    const attribution = commerceConversionAttribution("marketplace", "user-1", 42);
    expect(attribution.user_id).toBe("user-1");
    expect(attribution.user_name).toBe("Marketplace");
    expect(attribution.final_amount).toBe(42);
    expect(attribution.is_market_fit_influenced).toBe(false);
    expect(attribution.notes).toBe("Auto-converted from marketplace purchase");
  });
});

describe("journeyTaskSpecs", () => {
  const base = {
    siteId: "site-1",
    leadId: "lead-1",
    userId: "user-1",
    leadName: "Ada",
    now: "2026-08-12T00:00:00.000Z",
  };

  it("creates visit + payment for paid shop", () => {
    const specs = journeyTaskSpecs({ ...base, source: "shop", paid: true, amount: 10 });
    expect(specs.map((s) => s.type)).toEqual(["website_visit", "payment"]);
    expect(specs[0].stage).toBe("awareness");
    expect(specs[1].stage).toBe("purchase");
    expect(specs[1].amount).toBe(10);
  });

  it("creates visit + payment for paid marketplace", () => {
    const specs = journeyTaskSpecs({ ...base, source: "marketplace", paid: true });
    expect(specs.map((s) => s.type)).toEqual(["website_visit", "payment"]);
  });

  it("creates only payment for paid POS", () => {
    const specs = journeyTaskSpecs({ ...base, source: "pos", paid: true, amount: 25 });
    expect(specs.map((s) => s.type)).toEqual(["payment"]);
    expect(specs[0].stage).toBe("purchase");
  });

  it("creates only visit for unpaid shop", () => {
    const specs = journeyTaskSpecs({ ...base, source: "shop", paid: false });
    expect(specs.map((s) => s.type)).toEqual(["website_visit"]);
  });

  it("creates no tasks for unpaid POS", () => {
    expect(journeyTaskSpecs({ ...base, source: "pos", paid: false })).toEqual([]);
  });
});

function createMockSupabase(opts: {
  lead?: { id: string; status: string; name: string; origin?: string | null } | null;
  existingTaskTypes?: string[];
}) {
  const updates: any[] = [];
  const inserts: any[] = [];

  const client = {
    from(table: string) {
      if (table === "leads") {
        return {
          select() {
            return {
              eq() {
                return {
                  async single() {
                    return { data: opts.lead ?? null, error: opts.lead ? null : { message: "not found" } };
                  },
                };
              },
            };
          },
          update(payload: any) {
            updates.push({ table, payload });
            return {
              async eq() {
                return { error: null };
              },
            };
          },
        };
      }

      if (table === "tasks") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async in() {
                        return {
                          data: (opts.existingTaskTypes || []).map((type) => ({ type })),
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          async insert(rows: any) {
            inserts.push(...(Array.isArray(rows) ? rows : [rows]));
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return { client, updates, inserts };
}

describe("ensureCommerceLeadConverted", () => {
  const baseParams = {
    siteId: "site-1",
    leadId: "lead-1",
    userId: "user-1",
    leadName: "Ada",
    amount: 50,
  };

  it("converts a shop lead and inserts visit + payment when paid", async () => {
    const { client, updates, inserts } = createMockSupabase({
      lead: { id: "lead-1", status: "new", name: "Ada" },
    });

    await ensureCommerceLeadConverted({
      ...baseParams,
      supabase: client,
      source: "shop",
      paid: true,
    });

    expect(updates).toHaveLength(1);
    expect(updates[0].payload.status).toBe("converted");
    expect(updates[0].payload.attribution.user_name).toBe("Shop");
    expect(updates[0].payload.origin).toBe("shop");
    expect(inserts.map((t) => t.type)).toEqual(["website_visit", "payment"]);
  });

  it("converts a marketplace lead with visit + payment when paid", async () => {
    const { client, inserts } = createMockSupabase({
      lead: { id: "lead-1", status: "contacted", name: "Ada" },
    });

    await ensureCommerceLeadConverted({
      ...baseParams,
      supabase: client,
      source: "marketplace",
      paid: true,
    });

    expect(inserts.map((t) => t.type)).toEqual(["website_visit", "payment"]);
  });

  it("converts a POS lead with payment only when paid", async () => {
    const { client, updates, inserts } = createMockSupabase({
      lead: { id: "lead-1", status: "new", name: "Ada" },
    });

    await ensureCommerceLeadConverted({
      ...baseParams,
      supabase: client,
      source: "pos",
      paid: true,
    });

    expect(updates[0].payload.status).toBe("converted");
    expect(updates[0].payload.origin).toBe("pos");
    expect(inserts.map((t) => t.type)).toEqual(["payment"]);
  });

  it("does not downgrade an already converted lead and skips duplicate tasks", async () => {
    const { client, updates, inserts } = createMockSupabase({
      lead: { id: "lead-1", status: "converted", name: "Ada", origin: "shop" },
      existingTaskTypes: ["website_visit", "payment"],
    });

    await ensureCommerceLeadConverted({
      ...baseParams,
      supabase: client,
      source: "shop",
      paid: true,
    });

    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("sets origin to pos when converting an inbound walk-in", async () => {
    const { client, updates } = createMockSupabase({
      lead: { id: "lead-1", status: "new", name: "Ada", origin: "inbound" },
    });

    await ensureCommerceLeadConverted({
      ...baseParams,
      supabase: client,
      source: "pos",
      paid: true,
    });

    expect(updates[0].payload).toEqual(
      expect.objectContaining({
        status: "converted",
        origin: "pos",
      })
    );
    expect(updates[0].payload.attribution).toBeDefined();
  });

  it("does not overwrite a campaign origin on convert", async () => {
    const { client, updates } = createMockSupabase({
      lead: { id: "lead-1", status: "qualified", name: "Ada", origin: "website" },
    });

    await ensureCommerceLeadConverted({
      ...baseParams,
      supabase: client,
      source: "shop",
      paid: true,
    });

    expect(updates[0].payload.status).toBe("converted");
    expect(updates[0].payload.origin).toBeUndefined();
  });

  it("fills origin on an already converted inbound lead without changing status", async () => {
    const { client, updates, inserts } = createMockSupabase({
      lead: { id: "lead-1", status: "converted", name: "Ada", origin: "inbound" },
      existingTaskTypes: ["payment"],
    });

    await ensureCommerceLeadConverted({
      ...baseParams,
      supabase: client,
      source: "pos",
      paid: true,
    });

    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toEqual({ origin: "pos" });
    expect(inserts).toHaveLength(0);
  });

  it("does not convert unpaid shop leads but records a website visit", async () => {
    const { client, updates, inserts } = createMockSupabase({
      lead: { id: "lead-1", status: "new", name: "Ada" },
    });

    await ensureCommerceLeadConverted({
      ...baseParams,
      supabase: client,
      source: "shop",
      paid: false,
    });

    expect(updates).toHaveLength(0);
    expect(inserts.map((t) => t.type)).toEqual(["website_visit"]);
  });

  it("is a no-op for unpaid POS", async () => {
    const { client, updates, inserts } = createMockSupabase({
      lead: { id: "lead-1", status: "new", name: "Ada" },
    });

    await ensureCommerceLeadConverted({
      ...baseParams,
      supabase: client,
      source: "pos",
      paid: false,
    });

    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("does not run for quote source", async () => {
    const { client, updates, inserts } = createMockSupabase({
      lead: { id: "lead-1", status: "new", name: "Ada" },
    });

    await ensureCommerceLeadConverted({
      ...baseParams,
      supabase: client,
      source: "quote",
      paid: true,
    });

    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });
});
