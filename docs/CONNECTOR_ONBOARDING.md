# Self-service connector onboarding

## User flow

The Connectors catalogue is discovery, not an account inventory. Browsing or
opening toolkit detail does not create a Composio auth configuration, authorize
an external account, or enable an execution policy. The number of toolkits is
provider-owned and changes over time.

On a toolkit's detail page, a workspace manager can choose **Connect account**
or **Connect another account**. After explicit confirmation:

| Provider metadata | Makinari behavior |
| --- | --- |
| Compatible enabled configuration in the workspace's Composio project | Reuses it, with explicit selection when more than one is eligible. |
| Default Composio-managed OAuth app (for example Meta Ads) | Provisions the app's auth config on demand and opens Composio's Connect Link during the same request. The user reviews and grants consent at the provider. |
| Supported account credentials (API key, bearer token, Basic or Basic with JWT) or OAuth Dynamic Client Registration | If the toolkit explicitly requires no project-level fields, provisions an empty auth config. Credential methods must advertise user account fields; Composio hosts the input and authorization. |
| Custom OAuth, unknown or unsupported schemes, or required project fields | Shows actionable project-administrator instructions instead of an empty API-key modal. The application does not collect project secrets or invent defaults. |
| Only `NO_AUTH` advertised | Explains that no account is needed. This does not enable unauthenticated tool execution from Makinari. |
| Disabled by provider | Shows the connector cannot be connected in the current project. |

Google Calendar retains its existing read-only managed preset. Supabase retains
the dedicated project-reference/PAT flow; hosted OAuth does not provide a project
binding. There is no automatic OAuth-to-token fallback, inherited secret, provider
proxy, arbitrary URL, or account adoption. Setup uses a compatible existing
configuration when possible and does not create a replacement beside a disabled
or incompatible project configuration. No browser-provided scopes, application
credentials, or connection fields are accepted by the generic hosted endpoint.

## Verification and permissions

The new manager-only `POST /api/connectors/auth-attempts/hosted` uses the same
site-bound Composio project and provider account identity as existing attempts.
The browser sends the workspace, toolkit, the fingerprint for the setup shown to
the manager, and an exact config ID when selecting an existing configuration.
The fingerprint is a stale-selection check, not authorization. If the provider
binding or sign-in choice changes, the manager must refresh and confirm again.
Automatic managed OAuth requires a stable provider-managed app ID.
The web server generates an HttpOnly attempt nonce. The API rechecks manager and
credential binding, reads bounded config pages, and locks **project + toolkit**
when provisioning. It confirms the exact new config is visible before issuing
the hosted link and never automatically replays an uncertain provider write.
An explicit validation rejection releases the setup lock. A lost or malformed
write response does not: refresh and reconcile before attempting another create.
Managed OAuth uses the provider defaults, not all scopes in the advertised
ceiling, except for the explicitly narrowed Calendar preset.

OAuth returns must open in the initiating tab. The browser retains the local
attempt ID and its short-lived continuation in session storage, never the
provider's proof, redirect URL, credentials or HttpOnly nonce. When another
OAuth attempt in the same workspace could own the proof, the API refuses to
redeem it. Wait for overlapping attempts to expire before starting again.
Credential forms
can return without OAuth proof: the callback can only request an account status
check on its cookie-bound, immutable credential attempt. The server verifies the
exact active account, config, scheme, workspace, actor, and project in both paths.
A link, URL account ID, or success query parameter is not evidence of completion.
Only a temporary, read-only credential check that failed before the claim (or
an inactive account) offers another explicit status check. A single-use OAuth
proof or an uncertain completion is never replayed automatically.
The review link retains the workspace of the verified attempt. If the manager
has switched workspaces, the page asks them to switch back instead of fetching
the connector under the wrong workspace.
New accounts created by this hosted flow keep normal workspace sharing but start with **no enabled
execution hosts and no agent assignment**. A hosted connection is not necessarily
compatible with Robots Ask. Ask requires a verified private OAuth2 or API-key
account on a native API toolkit; hosted Supabase OAuth is not project-bound.
OAuth1, DCR OAuth, Basic, Basic with JWT, bearer tokens, and MCP do not become
executable just because onboarding succeeded. Compatible accounts can be enabled
separately in **Tools & permissions**; existing member, host, action and
provider authorization remain in effect. Existing connections and legacy starts
are not rewritten. The Supabase PAT agreement and policy remain unchanged.

## Catalogue snapshot

The [public Composio index](https://docs.composio.dev/toolkits) on 2026-11-23
listed 1,841 toolkits. Classifying each row once, in order, gives 133 with a
managed app, 1,431 others advertising a supported credential scheme, 111 other
DCR OAuth toolkits, 29 `NO_AUTH`-only toolkits, and 137 other toolkits. This is
not the count in a specific Composio project and does not prove any toolkit can
connect: required fields, existing configs, and project permissions come from
live provider metadata at setup time.

## Release checklist

1. Verify that the exact target has `20261124000000_connector_hosted_onboarding.sql`
   before releasing the API. It is already installed on shared Makinari; do not
   replay it. For other targets, obtain explicit approval before applying it. The canonical
   schema source and both application mirrors must match. This migration also
   accepts provider slugs starting with an underscore (for example `_1password`).
2. Verify the effective BYOK or platform Composio project binding and exact
   callback verifier. The selected key must have Auth configs and Connected
   accounts read/write permissions; automatic creation requires configured
   Upstash locking. Check Composio's auth-config quota as well: creation is
   on demand and subject to the project's provider limits. Do not relax provider
   or workspace verification to work around a failed permission check.
3. For this cutover, pause **all** new Connect Link starts at ingress, including
   the legacy `/auth-attempts` and `/auth-attempts/ask` POSTs, but leave completion
   and callback routes reachable. Drain outstanding pre-continuation attempts
   for their ten-minute lifetime before replacing callback readers.
   Release the compatible API everywhere, then the compatible web, including the
   callback page. Reopen ingress for compatible clients. Hosted starts are on
   by default and require no activation flag. For rollback, pause new starts
   at ingress and retain the compatible callback and API completion handlers
   until outstanding attempts expire (ten minutes).
4. On an approved disposable project/site, verify a first Meta Ads connection
   starts the consent flow without a prior configuration, returns through the
   normal callback, and has Ask off. Repeat with an account-credential toolkit,
   DCR OAuth, existing config, custom-only OAuth, and a no-auth toolkit. Verify
   actual provider interoperability before promising coverage of a specific
   scheme or toolkit; unsupported requirements remain an admin setup state.

Provider references: [Toolkit metadata](https://docs.composio.dev/reference/api-reference/toolkits/getToolkitsBySlug),
[Auth config creation](https://docs.composio.dev/reference/api-reference/auth-configs/postAuthConfigs),
[Hosted Connect Link](https://docs.composio.dev/docs/tools-direct/authenticating-tools#hosted-authentication-connect-link).