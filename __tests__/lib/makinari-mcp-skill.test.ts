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
    expect(agentSkills).toContain("**Header x-mcp-user-id**: `test-user`")
    expect(agentSkills).toContain("`create_project` tool")
    expect(agentSkills).toContain("**DO NOT** commit this file to version control")
    expect(agentSkills).toContain("`.gitignore`")
    expect(agentSkills).toContain("delete this file after the project setup is complete")
    expect(agentSkills).not.toContain("mcporter")
  })
})