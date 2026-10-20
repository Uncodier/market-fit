import {
  AGENT_SKILLS_MCP_KEY_EXPIRATION_DAYS,
  createMakinariMcpSkill,
  ONBOARDING_MCP_KEY_EXPIRATION_DAYS,
} from "@/lib/makinari-mcp-skill"

describe("Shared Makinari MCP skill", () => {
  const credentials = { apiKey: "test-key-not-a-real-credential", userId: "test-user" }

  it("keeps the onboarding content identical except for the key validity", () => {
    const onboarding = createMakinariMcpSkill({ ...credentials, expirationDays: ONBOARDING_MCP_KEY_EXPIRATION_DAYS })
    const agentSkills = createMakinariMcpSkill({ ...credentials, expirationDays: AGENT_SKILLS_MCP_KEY_EXPIRATION_DAYS })

    expect(ONBOARDING_MCP_KEY_EXPIRATION_DAYS).toBe(1)
    expect(AGENT_SKILLS_MCP_KEY_EXPIRATION_DAYS).toBe(90)
    expect(agentSkills).toBe(onboarding.replace("24 hours", "90 days"))
    expect(agentSkills).toContain("https://backend.makinari.com/api/mcp")
    expect(agentSkills).toContain("**API Key**: `test-key-not-a-real-credential`")
    expect(agentSkills).toContain("**Header X-API-Key**")
    expect(agentSkills).toContain("**Header x-mcp-user-id**: `test-user`")
    expect(agentSkills).toContain("`create_project` tool")
    expect(agentSkills).toContain("**DO NOT** commit this file to version control")
    expect(agentSkills).toContain("`.gitignore`")
    expect(agentSkills).toContain("delete this file after the project setup is complete")
    expect(agentSkills).not.toContain("mcporter")
  })

  it("includes the existing site context and prevents duplicate creation", () => {
    const siteId = "11111111-1111-4111-8111-111111111111"
    const skill = createMakinariMcpSkill({ ...credentials, expirationDays: 90, siteId })

    expect(skill).toContain(`**Header x-mcp-site-id**: \`${siteId}\``)
    expect(skill).toContain(`Use \`site_id\`: \`${siteId}\``)
    expect(skill).toContain("connect my project to the existing site")
    expect(skill).toContain("Do not call `create_project` or create a duplicate site")
    expect(skill).toContain("A site ID is context, not proof of authorization")
    expect(skill).not.toContain("## Create a new site")
  })

  it.each([undefined, null, ""])("gives conditional creation and fallback instructions without a site (%s)", (siteId) => {
    const skill = createMakinariMcpSkill({ ...credentials, expirationDays: 1, siteId })

    expect(skill).not.toContain("**Header x-mcp-site-id**:")
    expect(skill).toContain("No existing `site_id` is included")
    expect(skill).toContain("Do not invent a site UUID")
    expect(skill).toContain('`action="describe"` and `name="create_project"`')
    expect(skill).toContain('`action="call"`')
    expect(skill).toContain("JSON-encoded object matching the returned schema")
    expect(skill).toContain("`name` and optional `domain`")
    expect(skill).toContain("only when supported and authorized")
    expect(skill).toContain("https://app.makinari.com/create-site")
    expect(skill).toContain("`project.id`")
    expect(skill).toContain("Creation does not automatically switch the MCP context or issue a new key")
    expect(skill).toContain("check whether creation succeeded before retrying")
  })
})