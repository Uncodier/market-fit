import { isPayoutResolverRole } from "@/lib/auth/platform-access"

describe("platform payout access", () => {
  it.each(["super_admin", "finance_admin"])(
    "allows the trusted %s platform role",
    (platformRole) => {
      expect(isPayoutResolverRole(platformRole)).toBe(true)
    }
  )

  it.each([undefined, null, "", "admin", "support", ["finance_admin"]])(
    "rejects an invalid payout resolver role",
    (role) => {
      expect(isPayoutResolverRole(role)).toBe(false)
    }
  )
})
