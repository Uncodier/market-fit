# Site setup launch boundary

## Minimum data and authorization

Project creation sends only `site_id` to same-origin `POST /api/site/setup` using
the browser session cookie. The web route independently requires owner/admin
access and `user_can(update)`, validates the cookie session actor, and forwards
only its bearer token to the configured API server. The external API independently
verifies that user token and site manager access. Neither boundary trusts caller
company/contact/URL, identity headers, or browser API keys.

The worker resolves real site data. Missing contact or URL is not a reason to
invent data or reject the minimum request; dependent optional stages can be
explicitly skipped. A site-only request does not overwrite a saved locale.

Billing initialization remains the atomic `initialize_site_billing` RPC. An
invalid, failed, or timed-out result blocks workflow launch without direct balance
or ledger fallbacks. The separate create-site billing warning and billing-only
retry remain unchanged.

## Queue and acceptance

### Middleware admission

The scanner heuristic in `lib/http/suspicious-request.ts` exempts only the exact
`/api/site/setup` and `/api/stripe/auto-top-up/setup` paths (with an optional
single trailing slash) from its generic `/setup` pattern. Other scanner and
traversal checks remain enabled. Middleware still applies API admission and
each route still performs its own origin, input, authentication and permission
checks. This exception is not an anonymous-access grant or a workflow retry.

Without it, legitimate setup POST/GET requests receive an empty middleware 404
before the route runs. Project creation succeeds separately, but the browser
receives neither JSON acceptance nor a workflow ID and displays **unconfirmed**.
Deploying the correction restores admission for new requests; it does not replay
an existing unconfirmed setup. Check existing execution state before any manual
relaunch. Deployment and production relaunch require explicit approval.

`__tests__/auth/setup-api-middleware.test.ts` exercises the real middleware plus
the setup route with mocked external services, including acceptance identity,
read-only status checks, auth/tenant denial, rate admission, invalid input,
foreign origins, and scanner lookalikes. Route-only tests cannot detect this
pre-route rejection.

The API uses `WORKFLOW_TASK_QUEUE || 'default'`, matching the existing worker's
subscription. The former `site-setup-queue` fallback did not match that worker.
Keep the API and worker environment values aligned; no separate queue registry
or worker is introduced.

Temporal `workflow.start()` acceptance is **not setup completion**. POST returns
`status: accepted`, `setup_status: pending`. A start timeout is unconfirmed and
retains its generated workflow ID when available. It never cancels or replays
that potentially accepted execution.

## User-visible status

The creation page and Billing for the active project display a setup notice
independently of billing. Its manual
**Check setup status** action uses same-origin GET with the workflow ID; it never
relaunches setup. Both servers authorize the site embedded in that ID, not a
caller-provided unrelated site ID.

The launch promise belongs to the external browser store in
`app/create-site/site-setup-store.ts`, not the creation page. Navigation can unmount
the page before POST settles; its result still updates the saved project's entry
and any mounted tracking notice through React `useSyncExternalStore`. Remounting
the creation page or opening Billing never starts setup or automatically checks
status. Billing initialization and setup tracking remain separate: no cached
status changes balances, credits, grants, or the financial phase.

The tab-scoped `sessionStorage` key is `site-setup:v1:<user UUID>:<site UUID>`;
it normally lasts until that browser tab closes, not a backend durable receipt.
The store retains launch-pending, the known workflow ID, and terminal/unconfirmed
feedback across navigation and document refresh. Only version, validated UUIDs,
allowlisted status/detail codes, and a site-matching workflow ID are persisted.
Display messages are reconstructed from English constants, never cached raw API
text, contact data, credentials, settings, or provider payloads. A strict,
size-limited schema rejects corrupt/unknown fields and wrong-user/site records.
If storage is unavailable, the store keeps navigation-safe in-memory feedback;
document-refresh restoration cannot be guaranteed in that case.

A reload while POST is outstanding may leave a pending entry without an ID. On
restore this is shown as **unconfirmed**, with no status button until an ID is
known and no automatic replay. A valid known ID is retained even if the remaining
response DTO is invalid or a manual GET fails. Each explicit status action reads
only that workflow; persisted browser feedback is not trusted by either server,
which independently validates identity and site access again.

The API's existing result reader describes the execution before reading a closed
result. Running stays pending. A completed Temporal execution needs an explicit
worker result to be called complete; skipped/failed stages produce partial/failed
feedback, and legacy or unknown result data remains unconfirmed. Responses expose
only allowlisted status, stage names, and cause codes, not raw workflow errors,
contact details, or provider payloads.

Requests and responses have size limits and network deadlines. API stages have
separate deadlines so a timed-out authorization/billing check cannot later advance
to workflow launch. A late atomic RPC may finish, but cannot trigger a replay.

## MCP agent-assisted project creation

The agent buttons in `/create-site` and the Makinari MCP card in
`/skills?tab=makinari-skills` share
`app/components/skills/mcp-agent-skill-setup.tsx`. Selecting an agent opens a
confirmation dialog; only **Generate Key & Download Skill** creates a key via the
existing authenticated key API and downloads the credential-bearing Markdown.
Opening the card preview or the dialog never creates a key.

`lib/makinari-mcp-skill.ts` is the single Markdown template. Both surfaces use the
same MCP endpoint, explicit API-key header instructions, `x-mcp-user-id` header,
and security notice. The context determines the instructions and requested key:

- `/create-site`: 1 day (24 hours), user-level key with `create_project` scope and
  no site binding, even if another site is currently selected.
- Agent Skills with a selected real site: 90 days, key bound to that site with
  `read` and `write` scopes. The preview and download include the actual `site_id`
  and `x-mcp-site-id` header, and prohibit duplicate creation. The dialog discloses
  the binding and scopes; its target is captured on opening so a site switch
  cannot silently change the confirmed download.
- Agent Skills without a selected real site: 90 days, the same conditional
  creation instructions and unbound `create_project` request as onboarding.
  Demo and `default` placeholder IDs are not included as existing-site context.

Creation instructions require tool discovery and schema inspection. The inspected
MCP routes `create_project` through `tools` (`describe`, then `call` with JSON-encoded
`args`); the creation input includes `name` and optional `domain`. The agent must
respect any additional required schema fields and authorization failures. After
confirmed success, `project.id` supplies the new site context. Creation does not
automatically switch that context or issue a new key: obtain a site-bound Agent
Skills download before continuing work on the new site.

The current MCP may require a site UUID before accepting any tool call, including
creation. An unbound connection therefore depends on server configuration and is
not guaranteed. If connection or creation is blocked, the instructions point to
`https://app.makinari.com/create-site` and a fresh site-bound skill, never a fabricated
UUID or another tenant's context. An unbound key request can also fail if the
deployed database disallows null site bindings; existing key-error handling remains
visible and does not download a file on failure.

Requested scopes and site headers are not authorization enforcement. The inspected
external MCP path does not establish key-owner/site/scope checks; that requires a
separate backend fix. This frontend change does not repair that boundary or assert
that the deployed MCP safely enforces it. Key issuance continues through the
existing authenticated API, which validates ownership for site-bound requests.

Agent Skills previews placeholder credentials and the selected site context. Actual credentials are used
only for the explicit file download, not persisted in browser storage or shown in
the preview. The downloaded file must stay out of version control and be deleted
after setup. Key creation errors remain visible and require an explicit retry;
duplicate creation and dialog dismissal are blocked while a request is pending.

Offline regression checks:

```sh
npm test -- --runInBand __tests__/lib/makinari-mcp-skill.test.ts __tests__/components/settings/mcp-agent-skill.test.tsx __tests__/app/skills/page.test.tsx __tests__/components/onboarding/onboarding-form-layout.test.tsx __tests__/components/settings/skills-cards.test.tsx
```

These tests check expirations, site bindings, scope requests, conditional creation,
site-switch behavior, and generated files without creating live credentials or
executing the external MCP tool.

## Historical diagnosis

The earlier create-site implementation launched only when both
`NEXT_PUBLIC_API_KEY` and `NEXT_PUBLIC_API_SECRET` existed. Missing either skipped
the request entirely, so the API billing initializer was never reached. Errors
were console-only. Current API middleware verifies session JWTs without an
Origin header, but does not authenticate an API user from a web cookie alone:
the server proxy's cookie-to-bearer exchange is necessary. Queue mismatch occurs
after the billing RPC, so it cannot by itself explain a missing billing record.

Offline tests cover the minimal input, session proxy, middleware admission,
manager/tenant denial, RPC fail-closed gate, subscribed queue, deadlines, safe
partial/failed feedback, and no workflow replay. React regression tests navigate
and unmount the actual creation page before POST settles, restore its result on
Billing/remount and after a simulated document refresh, exercise explicit pending
GET, and reject wrong-account/site and corrupt storage. No remote state was modified to
validate this boundary.