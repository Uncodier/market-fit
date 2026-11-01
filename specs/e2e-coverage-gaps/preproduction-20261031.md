# Preproduction browser-risk audit — 2026-10-31

## Scope and confidence

Read-only review of current source, native specs, YAML journeys, Jest suites,
operational guides and exact saved Azure outcomes. No live tests, production
requests, infrastructure creation, build, migration or code repair occurred.
Existing uncommitted changes were preserved; these documents are the audit output.

Inventory: 166 `app/**/page.tsx` files, 56 recursive YAML test sources and 15
top-level/native specs outside the nested agent project. These are file counts,
not unique features, test passes or coverage percentages. Aliases, detail routes,
tabs, dialogs and provider paths make a route percentage misleading.

**Verified:** exact Azure runs documented in
[the execution report](../qa-disposable/procurement-subsystems-20261031.md):
procurement 9/9 and subsystems 2/2, plus login, without skips/retries. Exact saved
allowlisted artifacts were rechecked. The QA was deleted. The clean-Git provenance
gate remains false because tests used uncommitted overlays.

**Not established:** complete application health, full current smoke/regression,
paid checkout, every role/location boundary, other browsers or production rollout.
The earlier general QA report is partial and historical. A Jest file is evidence
of an implemented local test, not a newly executed pass in this audit.

The backlog contains **60 scenario families**, not 60 finished tests: twelve
cross-cutting contracts, twenty commerce/operations families, sixteen procurement/
finance families and twelve platform families. Each family expands into positive,
negative, stale-state and concurrency cases. Priority is this audit's recommended
release risk, not a previously assigned product severity.

- **P0:** money, inventory, privacy, authorization or irreversible duplicate work;
  release blocker when the relevant feature is enabled.
- **P1:** persistence, ambiguous recovery and core cross-screen correctness.
- **P2:** usability/breadth; serious accessibility failures can elevate priority.
- **MISSING_E2E:** implemented behavior lacks the specified browser proof.
- **REVIEW_RISK:** concrete risky source shape, not a reproduced exploit/incident.
- **UNSUPPORTED:** no successful implementation to test; prove the honest blocker.

## Immediate source-review findings

1. `app/purchases/actions.ts#receivePurchaseStock` reads/writes inventory per item,
   then sets `stock_received`; item write errors are not inspected. Reproduce a
   failed later item and competing receipts before trusting stock completion.
2. `registerPurchasePayment` in that file builds a timestamp receipt ID, reads
   previous payments and uses a payment-only direct update without the item RPC's
   version comparison. Concurrent tabs/lost acknowledgements need explicit proof.
3. `app/components/applications/RepositoriesSection.tsx` logs primary query failure
   and ends loading without exposing an error or clearing prior repositories.
   Test first-load failure and A-to-B failed reads; backend RLS does not retire
   previously displayed browser rows by itself.
4. `app/content/[id]/hooks/use-content-publishing.ts` sends `scheduledAt` but
   presents a successful provider result as published and writes `published`.
   It does not inspect returned errors from tag/status writes. Verify provider
   state, local state and partial failure independently.
5. Social account delete/connect/auth-URL routes under `app/api/social/` validate
   identity/global location eligibility, but the inspected handlers forward
   caller-supplied resource/site IDs with a server API key without a local
   site-manager/account ownership check. Require direct-boundary authorization
   review and denied-call tests; this audit did not reproduce unauthorized access.

## Cross-cutting screen contract — apply to every relevant family

| ID | Priority | Missing cases and required outcome |
|---|---|---|
| X01 | P0 | Finish dependency observation in native journeys: page errors, failed chunks, API failures, invalid JSON, business errors inside HTTP 200, image failures. Register exact expected denial requests/statuses before the action; never ignore all 4xx. |
| X02 | P0 | Expire/revoke auth while viewing/editing; logout/login another account in a second tab. Deny writes, retire protected cached projections and bind every resumed draft/queue to the correct actor. |
| X03 | P0 | Switch site A→B→A while reads/searches/uploads are pending; cross-tab site changes and browser back. Title, cookies, selection, requests, rows and saved resource IDs must agree; late A reads cannot overwrite B. |
| X04 | P0 | Disable member, app capability, license or location while its modal/data is warm. Button hiding is insufficient: direct API/action must deny and cache must stop authorizing operations. |
| X05 | P1 | Initial empty vs filtered empty vs loading vs denied vs unavailable vs archived/missing detail. Only a completed successful read may show an empty-result success; retry must be bounded and recoverable. |
| X06 | P0 | Double click, Enter plus click, two tabs, delayed duplicate response, timeout after commit and disconnect/reconnect. One intent must produce one durable effect; unknown outcome must not trigger a new mutation automatically. |
| X07 | P1 | Two editors save stale versions, repeated realtime delivery, deleted/archived relation while picker is open. Preserve newer data, disclose conflict and retain the user's draft without silently overwriting. |
| X08 | P1 | Escape/cancel/backdrop/browser back/reload after editing or uploading. Confirm applicable data-loss behavior; never save/send/pay on cancel or lose an unconfirmed operation's identity. |
| X09 | P1 | Search special characters/accents, identical names, no matches, more than one page, sort/filter/reset and rapid queries. Choose exact IDs, not first text match; late search/pagination cannot mix scopes. |
| X10 | P0 | Boundary values: 0/negative/fractional/huge amount or quantity, null vs zero, mixed currencies, deadline equality, UTC midnight and DST. UI and authoritative persisted calculation must agree without implicit conversion. |
| X11 | P1 | Desktop/mobile modal geometry, 200% zoom, keyboard-only focus/return, screen-reader labels, nested portals and all five locales. Hidden dialogs must not intercept actions; long names must not hide totals/buttons. |
| X12 | P0 | Demo/public/private transitions, external redirects/URLs, token handling, file previews/CSV export. No real writes from demos, secret/private metadata in public payloads, unsafe navigation targets or stale cross-tenant exports. |

### Important limitation in the eleven recent passes

`selectWorkspace` starts `startReadObservation`, but the inspected new native
procurement/subsystem specs do not finalize `assertReadObservation`. Their exact
UI/database assertions passed; they are **not** a certificate of console/network
health. Known auxiliary image errors appeared in the saved QA work. Add safe
expected-denial handling and final observation rather than retroactively calling
those runs clean dependency checks.

The recent battery was English desktop Chromium and synthetic data. POS selection
used an empty cart; the lead quotation was an empty zero-total draft. The mapped
tender recorded one full non-stock quantity-2 receipt. These fixtures do not prove
tax-rich checkout, real stock fulfillment or partial/concurrent receipt behavior.

## Domain backlog

- [C01–C20: commerce and operations](preproduction-commerce-20261031.md)
- [B01–B16: procurement and finance](preproduction-buying-finance-20261031.md)
- [A01–A12: platform, marketing and automation](preproduction-platform-20261031.md)

Some existing files named `crud-order`, `crud-shipment`, `crud-reservation` and
`crud-inventory-item` only open forms or read tabs. Robot/social YAML explicitly
throws `[E2E_BLOCKED]` for missing safe fixtures. Do not count filenames, discovery
or those blocked cases as completed mutation coverage.

## Proposed execution order and acceptance gates

1. Add X01 exact-request error observation, expand verified role/location fixtures,
   reproduce the five source findings locally/in isolated PostgreSQL and fix with
   regressions. Never weaken RLS or replace backend results with mocks in E2E.
2. Run the full current smoke, buyer and role suites on the candidate revision;
   triage source errors vs fixture/environment blockers. Run the complete root
   regression separately; historical partial runs do not satisfy this gate.
3. Execute C01–C06, C11, C17–C20 and B03/B07–B11 first: real money/stock/use
   conservation, replay, direct authorization and resource ownership.
4. Execute the procurement edge matrix and cross-screen relation graphs with
   two independent actors/tabs and deterministic nonzero/multiline data.
5. Execute mobile/keyboard/localization, provider failure, export and automation
   lifecycle batches. External paid/provider tests require separate explicit
   sandbox accounts, recipient/cost scope and delivery permission.
6. Re-run each repaired family, its adjacent flows and the full selected suite
   on one consistent candidate. Record test/source/schema/API/worker revisions,
   exact run IDs, expected cases and allowed/denied persistent outcomes.

No release certificate until applicable P0 cases pass on the candidate, no
unexpected dependency errors remain, migrations/types/config match, financial
effects are exactly once, fixture/cleanup ownership is verified and rollout/
rollback/monitoring responsibilities are recorded. Feature-gate unsupported or
unverified irreversible provider workflows instead of treating them as green.

No finite test battery can promise zero surprises. Reduce residual risk through
staged rollout, reversible flags and monitoring of payment/webhook lag, stuck
queues, failed jobs and authorization failures. Do not automatically schedule
work, provision Azure or exercise production as part of this audit.