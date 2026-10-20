/** @jest-environment node */
import fs from "node:fs"
import path from "node:path"

describe("email settings integration boundary", () => {
  it("reconciles backend-owned email mutations without a second whole-array save", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/components/settings/SupportChannelsSection.tsx"), "utf8")
    const emailSetup = source.slice(source.indexOf("<EmailChannelSetup"), source.indexOf("</SectionCard>", source.indexOf("<EmailChannelSetup")))
    expect(emailSetup).toContain("onUpdated={() => reconcileEmailConnection(channel.id!)}")
    expect(emailSetup).not.toContain("persistConnections(")
    expect(source).toContain("<SectionCard key={`${siteId}:${channel.id || field.id}`}")
  })
})