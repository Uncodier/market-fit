import { resolveCheckoutAttribution } from "@/app/commerce/checkout-attribution"
import fs from "node:fs"
import path from "node:path"

function attributionClient(params: {
  ownerUserId?: string
  activeMemberIds?: string[]
}) {
  return {
    from(table: string) {
      const filters: Record<string, string> = {}
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          filters[column] = value
          return query
        },
        maybeSingle: async () => {
          if (table === "sites") {
            return {
              data: params.ownerUserId
                ? { user_id: params.ownerUserId }
                : null,
            }
          }
          if (table === "site_members") {
            const active =
              filters.status === "active" &&
              params.activeMemberIds?.includes(filters.user_id)
            return { data: active ? { id: "membership-1" } : null }
          }
          return { data: null }
        },
      }
      return query
    },
  } as any
}

describe("checkout attribution", () => {
  it("defaults the POS seller to the authenticated actor", async () => {
    await expect(
      resolveCheckoutAttribution({
        supabaseAdmin: attributionClient({
          activeMemberIds: ["cashier-1"],
        }),
        siteId: "site-1",
        source: "pos",
        authenticatedUserId: "cashier-1",
        requestedByLeadId: "lead-1",
      }),
    ).resolves.toEqual({
      createdByUserId: "cashier-1",
      sellerUserId: "cashier-1",
      requestedByLeadId: "lead-1",
    })
  })

  it("allows an active employee to be selected as seller", async () => {
    await expect(
      resolveCheckoutAttribution({
        supabaseAdmin: attributionClient({
          activeMemberIds: ["cashier-1", "seller-2"],
        }),
        siteId: "site-1",
        source: "pos",
        authenticatedUserId: "cashier-1",
        sellerUserId: "seller-2",
      }),
    ).resolves.toMatchObject({ sellerUserId: "seller-2" })
  })

  it("rejects a seller who is not active at the site", async () => {
    await expect(
      resolveCheckoutAttribution({
        supabaseAdmin: attributionClient({
          activeMemberIds: ["cashier-1"],
        }),
        siteId: "site-1",
        source: "pos",
        authenticatedUserId: "cashier-1",
        sellerUserId: "outside-user",
      }),
    ).rejects.toThrow("Selected seller is not an active site member")
  })

  it("does not accept client-selected sellers outside POS", async () => {
    await expect(
      resolveCheckoutAttribution({
        supabaseAdmin: attributionClient({}),
        siteId: "site-1",
        source: "shop",
        authenticatedUserId: "buyer-1",
        sellerUserId: "spoofed-seller",
      }),
    ).resolves.toEqual({
      createdByUserId: "buyer-1",
      sellerUserId: null,
      requestedByLeadId: null,
    })
  })
})

describe("sale order attribution migration", () => {
  it("adds indexed foreign keys and database-level attribution guards", () => {
    const sql = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260917220000_sale_order_attribution.sql",
      ),
      "utf8",
    )

    expect(sql).toContain("created_by_user_id uuid REFERENCES auth.users")
    expect(sql).toContain("seller_user_id uuid REFERENCES auth.users")
    expect(sql).toContain("requested_by_lead_id uuid REFERENCES public.leads")
    expect(sql).toContain("preserve_sale_order_creator")
    expect(sql).toContain("validate_sale_order_attribution")
  })
})
