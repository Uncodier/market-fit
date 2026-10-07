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