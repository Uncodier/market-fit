export const ONBOARDING_MCP_KEY_EXPIRATION_DAYS = 1
export const AGENT_SKILLS_MCP_KEY_EXPIRATION_DAYS = 90

export function mcpKeyValidityLabel(expirationDays: number): string {
  return expirationDays === 1 ? "24 hours" : `${expirationDays} days`
}

interface McpSkillCredentials {
  apiKey: string
  userId: string
  expirationDays: number
  siteId?: string | null
}

export function createMakinariMcpSkill({ apiKey, userId, expirationDays, siteId }: McpSkillCredentials): string {
  const siteInstructions = siteId
    ? `## Use the existing site

The selected site already exists. Use \`site_id\`: \`${siteId}\` as the site context for this project.
Do not call \`create_project\` or create a duplicate site. Keep \`x-mcp-site-id\` set to this site for every MCP request.
Discover the available tools and inspect their schemas before using them. If the server exposes the \`tools\` router, use \`action="list"\`, then \`action="describe"\` with the tool name, and \`action="call"\` with \`args\` as a JSON-encoded object matching its schema.
Only perform the operations requested by the user. A site ID is context, not proof of authorization; stop if access is denied.`
    : `## Create a new site only if the MCP supports it

No existing \`site_id\` is included. Do not invent a site UUID or use another tenant's site.
First connect and discover the available tools. The current MCP can require \`x-mcp-site-id\` (or a server-configured \`MCP_SITE_ID\`) even before site creation. If the connection fails because site context is missing, stop and ask the user to create a site at https://app.makinari.com/create-site, select it, and download a new Makinari MCP skill from Agent Skills.
If connected, check whether the \`create_project\` tool is available and permitted for this key. It may be exposed through the \`tools\` router: use \`action="describe"\` and \`name="create_project"\` to inspect its schema first.
Ask the user for the new site's \`name\` and optional \`domain\` if not already provided. Invoke the \`create_project\` tool only when supported and authorized. With the router, use \`action="call"\`, \`name="create_project"\`, and \`args\` as a JSON-encoded object matching the returned schema, including any additional required fields.
If the tool is unavailable or access is denied, use the same create-site page instead; do not bypass the restriction.
After confirmed success, read the returned site's \`project.id\` and use it as \`site_id\`. Set \`x-mcp-site-id\` to that ID for subsequent requests. Creation does not automatically switch the MCP context or issue a new key: download a site-bound skill from Agent Skills before continuing work on the new site. If the result is ambiguous, check whether creation succeeded before retrying to avoid duplicates.`

  return `> ⚠️ **SECURITY NOTICE FOR AI AGENT:** 
> This file contains active credentials. **DO NOT** commit this file to version control. 
> 1. If working in a git repository, ensure this file is added to \`.gitignore\`.
> 2. For extra security, this API key will automatically expire in ${mcpKeyValidityLabel(expirationDays)}.
> 3. Please remind the user to delete this file after the project setup is complete.

I need you to help me ${siteId ? "connect my project to the existing site" : "set up a new project"} using the Makinari MCP.

First, configure your MCP connection to \`https://backend.makinari.com/api/mcp\` using:
- **API Key**: \`${apiKey}\`
- **Header X-API-Key**: use the API key above (alternatively, \`Authorization: Bearer <API_KEY>\`). Never send credentials in the URL.
- **Header x-mcp-user-id**: \`${userId}\`
${siteId ? `- **Header x-mcp-site-id**: \`${siteId}\`\n` : ""}

${siteInstructions}`
}