# Platform, marketing and automation browser backlog — 2026-10-31

See [audit scope, risk labels and release gates](preproduction-20261031.md).
Paths are relative to `/Users/prado/Desktop/Proyectos/Uncodie/Code/market-fit`.
No scenarios below were executed in this read-only audit. Existing tests are
source/local coverage, not a current production-readiness certificate.

| ID | Priority | Screens and missing edge scenarios | Source / inspected evidence |
|---|---|---|---|
| A01 | P0 | Auth/Security/Profile: expiry mid-save, logout across tabs, account replaced, wrong/missing/replayed invitation or recovery token, Google callback state/return URL, MFA missing/invalid/replayed code, password/email/phone change failure. No old identity access, unsafe redirect, reused recovery action or silent login success. | `app/auth`, `app/components/security`, `app/components/auth/auth-form.tsx`; `__tests__/auth`, account lifecycle native specs. Signup happy path is not every authentication edge. |
| A02 | P0 | Projects/Onboarding/site archival: double Create, lost acknowledgement, partial optional setup, duplicate name, archived site warm tab, wrong password, last site deleted, invited buyer without onboarding. Verify one project and honest completion/archival state; do not auto-replay external setup. | `app/create-site`, `app/components/onboarding/utils/onboarding-submit.ts`, `lib/sites/archive-site-client.ts`; project lifecycle plus onboarding/API tests. |
| A03 | P0 | Team/App/Location access: two manager drafts conflict, role change plus location save partial failure, invite accept by wrong email or twice, seat limit/expiry, revoked owner/admin exemptions, branch added/deleted, hidden screen direct URL. Verify actual API/RLS, resource children and warmed browser cache; filters are not authorization. | `app/api/team`, `app/components/settings`, `docs/LOCATION_ACCESS_ENFORCEMENT.md`; role/location/license suites. Current generic roles suite largely checks capabilities and tenant reads, not all screen actions. |
| A04 | P0 | Social/Integration/Channels/Security settings: forged site/account/pending-session, callback mismatch, canceled OAuth, two simultaneous activation calls, licensed/suspended/manually disabled state, stale account deletion and provider sync failure. No privileged forwarding before site/resource authority; no fallback sender or unintended reactivation. | `app/api/social/accounts/[accountId]/route.ts`, `bluesky/connect`, `[network]/auth-url`, `app/components/settings/use-agent-channel-activation.ts`; `__tests__/api/social`, channel/license tests. Robot/social YAML has explicit fixture blockers. |
| A05 | P1 | Settings/configuration/secrets: unsaved subsection preserved after another immediate save, server clamping reflected, combined writes partially fail, stale settings revision, refresh while editing, secret mask/rotation/deletion, foreground reconnect. Never expose values or claim both requests succeeded when only one did. | `app/context/site-update-settings.ts`, `app/components/settings`, `app/api/secrets`, `app/api/secure-tokens`; settings/security/source-contract tests. |
| A06 | P0 | Content/social publishing: schedule vs immediate, provider accepted vs delivered/failed, duplicate click/lost acknowledgement, account removed/wrong network, partial multi-account success, local tag/status save fails after provider creation. Do not report scheduled work as published or silently replay a post. | `app/content/[id]/hooks/use-content-publishing.ts`, `docs/CONTENT_CREATOR_DESTINATIONS.md`; content/Outstand boundary tests. Source-review finding: successful scheduling currently takes unconditional published status path. |
| A07 | P1 | Content/assets/deep research/delete: image/file failed/canceled/missing, stale detail response, upload after site switch, unauthorized preview, linked remote post delete succeeds then local delete fails, unsupported network, second remote delete failure. Preserve local content and show partial outcome; cancel never deletes. | `app/content`, `docs/CONTENT_DELETION.md`, `docs/CONTENT_RELIABILITY.md`; content generation/deletion/preview tests. External deletion requires sandbox/provider permission. |
| A08 | P1 | Campaign/segment/promotion/People: create/link/edit/delete one scoped graph, invalid analysis values/null metrics, rapid filter changes, identical names, segment archived mid-selection, provider empty vs unavailable and stale enrichment. Counters/reports derive real data; accepted AI request is not completed work. | `app/campaigns`, `app/segments`, `app/promotions`, `app/people`; existing CRUD YAML/local tests. Rendering tabs is not attribution/analysis acceptance. |
| A09 | P0 | Chat/interventions: internal vs external/public-comment mode switched while loading, reply target deleted/foreign, double send/Enter, HTTP result races realtime, lost response, failed sender, call opt-out/invalid number, no consent escalation, failed retry vs placement unknown. One intended message/recipient; unknown call state must not replay. | `app/chat`, `app/api/agents/chat/intervention`, `docs/CHAT_INTERVENTION_DELIVERY.md`; chat/proxy/message regression tests. Provider accepted call is not answered/delivered. |
| A10 | P0 | Robots/Imprenta/Agents/Requirements/Workflows: OS picker background/return, session expiry during upload, busy409/capacity503, duplicate launch, SSE interrupted after acceptance, Stop vs late terminal event, paused vs running work deletion, two graph editors, failed branch/retry and selected sender revoked. Persisted graph → real orchestration/result must be proved independently. | `app/robots`, `app/api/robots/instance/assistant`, `app/components/workflows/use-workflow-graph.ts`, `docs/INSTANCE_DELETION.md`; local admission/wake/graph/instance tests. One nested agent reservation case does not cover this matrix. |
| A11 | P0 | Records/Apps/Database/Repositories: concurrent rich-text/diagram edit, relation target hidden/missing, attachment ownership, embedding pending/retry/conflict, app tenant foreign/deleted/inconsistent, repository read fails after A→B switch, unsafe preview URL. Error/denied is not empty and old rows cannot survive a new tenant scope. | `app/records/actions.ts`, `app/components/applications/RepositoriesSection.tsx`, `app/api/applications`; records/tenant/site-loading tests. Source-review finding: repository error path logs and ends loading without error/old-row retirement. |
| A12 | P1 | Reports/Costs/Finance: date/segment/site/account changes while loading/exporting, current section vs full report, invalid/missing metric vs zero, source row limits, timezone/currency, empty/large CSV, formulas/control prefixes, canceled download. Export only current successfully loaded authorized data and inspect actual downloaded bytes. | `app/dashboard/export/ReportExportScope.tsx`, `report-export-csv.ts`, `app/hooks/use-report-resource.ts`, `docs/REPORT_EXPORTS.md`; dashboard/accounting export tests. No new CSV defect asserted; existing KPI boundary/aggregation limitations are documented. |

## Additional states folded into these families

- Notifications: exact resource link after resource deletion/archival, another
  tenant, duplicate realtime event, mark-as-read failure and unread count rollback.
- Control Center/Records Kanban: bulk reorder/status change competing with edits,
  category unavailable, assigned-only access, view/date persistence and rollback.
- Profile/language/timezone changes: all protected/public/module labels and date
  inputs reload consistently; never alter preferences just to make a locator pass.
- Skills/community imports: malformed/oversized Markdown, deleted remote skill,
  wrong workspace, import twice, safe preview, read-only system skill and errors.
- Repository/application setup: missing concrete tenant vs optional unavailable
  data, provider timeout, unsafe domain/preview targets and explicit ownership.
- Navigation: idle tab, browser back/forward, new tab/download links, canceled
  onNavigate, stale chunk after deploy and explicit reload warning with unsaved work.

## Fixtures and evidence requirements

Use two tabs and distinct actors, two named sites, role/license/location states,
run-owned invitations and a private local mail sink; prepared content/records and
app/tenant/repository graphs; inactive/removed/wrong-channel connections; safe
file inputs and deterministic journals/report data. Keep all provider accounts,
messages, phone recipients and OAuth callbacks explicitly sandbox-scoped.

Browser-level fault tests can use controlled transport interruption in an
isolated QA, but must not replace backend mutations with fabricated success.
Confirm side effects using the original operation identity and real DB/provider
receipts. Cancellation, lost response and timeout are not synonymous with rollback.

Do not confuse older security-audit notes with current code. Some Stripe/domain/
generation boundaries have since gained explicit authorization. The social
handlers listed here still require a current site/resource ownership review;
their global location/session guard alone does not establish manager access.