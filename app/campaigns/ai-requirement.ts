import type { CampaignFormValues } from "./schema"

export function buildAiCampaignBrief(
  campaign: CampaignFormValues,
  segmentNames: string[]
): string {
  const currency = campaign.budget?.currency || "USD"
  const budget = campaign.budget?.allocated ?? 0

  return [
    `# Campaign: ${campaign.title.trim()}`,
    "",
    "## Campaign definition",
    campaign.description?.trim() || "No description provided.",
    "",
    `Campaign type: ${campaign.type}`,
    `Priority: ${campaign.priority}`,
    `Due date: ${campaign.dueDate || "Not specified"}`,
    `Allocated budget: ${budget} ${currency}`,
    `Target segments: ${segmentNames.length ? segmentNames.join(", ") : "Not specified"}`,
    "",
    "## Agent instructions",
    "Use the available Makinari tools to plan and advance this campaign as far as possible. Track progress and blockers in this requirement.",
    "If API keys, account access, approvals, or other team steps are needed, document what is missing and ask the team to provide it through the appropriate secure settings; do not request or store secrets in this requirement.",
    "Do not exceed the allocated budget or initiate external spending, publish content, contact people, or take irreversible actions without the required authorization.",
  ].join("\n")
}