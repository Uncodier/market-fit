/** @jest-environment node */
import { readFileSync } from "node:fs"
import path from "node:path"

const sourceFiles = [
  "InsightsTab.tsx",
  "InsightGeneratedPreviews.tsx",
  "use-record-insights.ts",
  "insights-types.ts",
]
const source = (name: string) => readFileSync(
  path.join(process.cwd(), "app/records/[id]/components", name),
  "utf8",
)

describe("record insights image boundary", () => {
  it.each(sourceFiles)("keeps %s below 500 lines without provider hosts or prompt URL logs", (name) => {
    const contents = source(name)
    expect(contents.trimEnd().split("\n").length).toBeLessThan(500)
    expect(contents).not.toMatch(/https?:\/\//)
    expect(contents).not.toContain("/api/public/image/prompt")
    expect(contents).not.toContain("window.location")
    expect(contents).not.toMatch(/console\.(?:error|warn|log|debug|info)/)
    expect(contents).not.toContain("placeholder-image.png")
  })

  it("delegates both preview branches to the shared helper and local fallback", () => {
    const previews = source("InsightGeneratedPreviews.tsx")
    expect(source("InsightsTab.tsx")).toContain("<InsightGeneratedPreviews")
    expect(previews).toContain('import { publicPromptImageUrl } from "@/app/lib/image-utils"')
    expect(previews.match(/publicPromptImageUrl\(finalPrompt, 512, record\?\.site_id\)/g)).toHaveLength(2)
    expect(previews).toContain('"/images/image-placeholder.svg"')
    expect(previews.match(/onError=\{showImagePlaceholder\}/g)).toHaveLength(2)
  })
})