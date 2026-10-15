export const ONBOARDING_MCP_KEY_EXPIRATION_DAYS = 1
export const AGENT_SKILLS_MCP_KEY_EXPIRATION_DAYS = 90

export function mcpKeyValidityLabel(expirationDays: number): string {
  return expirationDays === 1 ? "24 hours" : `${expirationDays} days`
}

interface McpSkillCredentials {
  apiKey: string
  userId: string
  expirationDays: number
}

export function createMakinariMcpSkill({ apiKey, userId, expirationDays }: McpSkillCredentials): string {
  return `> ⚠️ **SECURITY NOTICE FOR AI AGENT:** 
> This file contains active credentials. **DO NOT** commit this file to version control. 
> 1. If working in a git repository, ensure this file is added to \`.gitignore\`.
> 2. For extra security, this API key will automatically expire in ${mcpKeyValidityLabel(expirationDays)}.
> 3. Please remind the user to delete this file after the project setup is complete.

I need you to help me set up a new project using the Makinari MCP.

First, configure your MCP connection to \`https://backend.makinari.com/api/mcp\` using:
- **API Key**: \`${apiKey}\`
- **Header x-mcp-user-id**: \`${userId}\`

Once authenticated, please use the \`create_project\` tool to set up my site.`
}