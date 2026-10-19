import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("settings connection limit source contracts", () => {
  it.each([
    ["app/components/settings/SocialSection.tsx", "getSocialAccountLimit", 3],
    ["app/components/settings/SupportChannelsSection.tsx", "getAgentChannelLimit", 3],
    ["app/settings/social_network/page.tsx", "getSocialAccountLimit", 1],
  ] as const)("%s resolves all displayed limits through the trial-aware helper", (path, helper, count) => {
    const source = readFileSync(join(process.cwd(), path), "utf8")
    expect(source).toContain('import { effectiveBillingPlan } from "@/lib/billing/startup-trial"')
    const calls = source.match(new RegExp(`${helper}\\(`, "g")) || []
    const effectiveCalls = source.match(new RegExp(
      `${helper}\\(effectiveBillingPlan\\(currentSite\\?\\.billing\\)\\) \\+ \\(currentSite\\?\\.billing\\?\\.addons_count \\|\\| 0\\)`, "g",
    )) || []
    expect(calls).toHaveLength(count)
    expect(effectiveCalls).toHaveLength(count)
    expect(source).not.toContain("currentSite?.billing?.plan")
    expect(source.split("\n").length).toBeLessThan(500)
  })

  it("retains shared admission guards, batch size and server-error handling", () => {
    const social = readFileSync(join(process.cwd(), "app/components/settings/SocialSection.tsx"), "utf8")
    const support = readFileSync(join(process.cwd(), "app/components/settings/SupportChannelsSection.tsx"), "utf8")
    const callback = readFileSync(join(process.cwd(), "app/settings/social_network/page.tsx"), "utf8")
    expect(social).toContain("!social.isActive && !canConnectSocialAccount(currentSite)")
    expect(social).toContain("canConnectAccount={canConnectSocialAccount(currentSite)}")
    expect(support).toContain('channel.status !== "connected" && !canConnectAgentChannel(currentSite)')
    expect(callback).toContain("canConnectSocialAccount(currentSite, selectedPages.length)")
    for (const source of [social, support, callback]) {
      expect(source).toContain("showBillingLimitFromError")
    }
  })
})