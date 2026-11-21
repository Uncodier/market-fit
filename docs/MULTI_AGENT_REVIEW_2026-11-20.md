# Agents, hierarchy and channel delivery — offline review, 2026-11-20 UTC

**Disposition: hold live multi-agent routing.** The profile, diagram and saved assignment are separate from generation and delivery. A successful parent workflow is not a delivery receipt. No production database, Temporal namespace, model or provider was used to exercise an assignment or send. No deployment or remote migration was performed.

## Follow-up: delivery blockers repaired locally, not deployed

The reproductions below are the **pre-fix baseline**, not the current expected behavior. The [integration and cutover guide](../../API/docs/CHANNEL_MESSAGE_ADMISSION.md) describes the required schema/API/worker rollout. No new live routing or responder assignment is enabled by these repairs.

- **False success:** a new pinned workflow reports its generation and delivery outcomes separately. The receiver checks the [original saved turn](../../API/src/lib/services/channels/saved-channel-outcome.ts) before completing a claim. A failed or indeterminate operation remains recorded for reconciliation. A reclaimed receipt can read the original execution and database evidence, but cannot generate another reply or call the provider. Acceptance, an approval draft and verified history-only suppression are distinct.
- **Colliding inbound IDs:** the [forward migration](../../API/supabase/migrations/20261121001000_zavu_inbound_claim_binding.sql) binds new receipts to their verified source and fences unbound writers. A missing event ID no longer causes two distinct sender connections with the same provider message ID to consume each other's inbound event. Unattributable historical fallback receipts are held, not replayed or silently acknowledged.
- **Stale attachment sender:** pinned text and native attachments use [one dispatch claim](../../API/src/lib/services/channels/pinned-zavu-dispatch.ts) tied to the exact site, connection, sender, original inbound and saved reply payload. Dispatch rechecks the pin and policy after preparation and claiming. A provider timeout or lost acknowledgement does not authorize a second POST or TTS charge. Stronger receipts win: queued is not delivered, and a queued acknowledgement cannot downgrade read.

Cutover still needs a separately authorized nonproduction exercise: two disposable connections, overlapping callbacks on both URLs, and a deliberately lost provider acknowledgement. Monitor failed/unknown claims (including HTTP `202`), not just HTTP failures. Never reset a claim or substitute a different account to force a passing result.

**Repair verification (separate from the original review below):** 1,842 passing tests across 116 selected, distinct suites: 1,508 in the API and 334 in Workflows. These include [both signed URLs against disposable PostgreSQL](../../API/src/app/api/agent/message/__tests__/claim-identity.test.ts), [signed delivery callbacks](../../API/src/app/api/integrations/zavu/webhook/__tests__/pinned-delivery-events.test.ts), [lookup-only recovery](../../API/src/app/api/agent/message/__tests__/reconcile-original.test.ts), and [Temporal replay](../../Workflows/tests/fixtures/channel-replay/README.md) of 11 complete synthetic support histories and seven sender histories. One deliberately incompatible replay was required to fail. These checks did not contact a provider, a deployed worker or the production database.

## Release blockers reproduced in the original review

These cases ran against the actual handlers or workflow/activity functions with synthetic records and mocked external boundaries. They establish code behavior, not its frequency in production.

| Priority | Reproduced scenario | Acceptance gate |
| --- | --- | --- |
| High | The [channel workflow](../../Workflows/src/temporal/workflows/channelCustomerSupportWorkflow.ts) catches an exhausted send child and returns `success: true`, `channelMessageSent: false`. With that nested result the [admission service](../../API/src/lib/services/channels/admit-message.ts) accepts the outer success and the webhook completes its claim. A replay can return `duplicate` without resolving the send. A failed, already-recorded deterministic child also returns its original error on repeated admission. | Persist distinct accepted, suppressed, failed and unknown delivery outcomes. Reconcile the original stage; do not start a new responder or resend an ambiguous message. |
| High | In the [Zavu receiver](../../API/src/lib/services/zavu/receive-webhook.ts), two verified envelopes without `event.id`/`eventId` reused the same `data.messageId` on different senders. The fallback claim was identical; the second message never reached its workflow. | Scope the fallback identity to the verified sender/connection and channel. Test both URLs and compatibility with earlier claims before changing the key. |
| High | During native attachment preflight, the saved reply was rebound from B to A. The [send service](../../API/src/lib/services/channels/ChannelSendService.ts) and [media claim](../../API/src/lib/services/channels/native-media-delivery.ts) still dispatched via B despite the changed saved link. | Bind the inbound tuple to the durable media claim and reject changed provenance before dispatch. Two-number text parity is not evidence for attachments. |
| Medium | A replay for the same provider ID downgraded a read text receipt to queued. A queued native attachment was reported as `delivered: true`, `status: sent`. See the [receipt writer](../../API/src/app/api/agents/tools/sendChannelMessage/route.ts). | Enforce monotonic receipt state; distinguish provider acceptance from delivery in both storage and the response. |
| Medium | A connection disabled after admission yielded `skipped: channel_unavailable`; the [generation activity](../../Workflows/src/temporal/activities/sendCustomerSupportMessageActivity.ts) treated it as a retryable empty response. | Recognize verified history-only outcomes as terminal. Do not regenerate or call a provider. |

Other compatibility probes: a linked legacy WhatsApp turn with the channel only in conversation metadata was refused (`409`); detailed site-setup configuration explicitly carrying the independent-origin marker could not recover its own deterministic ID on retry. No claim about the prevalence of either data shape. Code inspection also found that Settings' existing invitation-status poll can finalize a prior provider setup, potentially incurring activation fees. The *assignment* GET is read-only; not every operation initiated by the Settings screen is. Frontend filtering of available numbers is not an atomic reservation of a new provider account.

## Fixes verified during review

- Persisted editor sections save only their own fields. Saving a prompt no longer overwrites unrelated tools, provider configuration or a different tab's draft, and a stale editor cannot reinsert a profile deleted after it loaded. Independent creation and legacy template setup retain their separate contracts.
- The diagram advances by actual rows and validates a stable exact count and unique IDs. A short PostgREST page is not necessarily the last page. An incomplete directory no longer produces incorrect setup cards or missing-supervisor labels.
- Assignment refreshes and writes now preserve newer revisions and refreshed permissions, require a contiguous revision receipt and reject stale agent/connection choices. Unknown transports are not labeled as served by Support.
- The **unapplied** supervisor migration now detects fixed snapshots from before installation, fences deletes/identity replacement and requires a visible direct parent and verifiable root during the write. The cases were reproduced in disposable PostgreSQL. Apply and verify this guard before concurrent hierarchy edits. The already-applied assignment SQL is unchanged: the local hash matches the canonical file and its [historical verification record](../../makinari-db-scheme/supabase/validation/20261120_channel_agent_assignments.md); this audit did not query the remote project.

## Test evidence

| Final selected repository suites | Unique suites | Passed tests |
| --- | ---: | ---: |
| `market-fit`: Agents/Settings, APIs, graph/editor, topbar and browser skeletons, including disposable SQL | 106 | 1,420 |
| `API`: channel admission, identity, delivery, approvals, suppression, receipts and legacy defaults | 90 | 1,304 |
| `Workflows`: ingress, version gates, retries, delivery and setup | 20 | 304 |
| **Total (deduplicated by suite path)** | **216** | **3,028** |

There were no skipped or todo cases in that selection. This is neither the full test inventory of all three repositories nor a live end-to-end test. The database subset had 26 cases across three suites on socket-only PostgreSQL 17.11. Browser layout tests ran in Chromium and WebKit, not against an authenticated production workspace. The 10 additional characterization cases reproduced failure conditions; they are not counted as successful delivery tests.

**Separate failed check:** `workspace-locales-contract.test.ts` had 3 passes and 3 failures outside the 216 suites. The runtime/catalog and missing-key differences include chat, connectors and storefront strings. All 56 keys for the reviewed agent hierarchy and channel UI are present across the five locales. No unrelated locale overlays were changed for this review.

For the focused web rerun, from `market-fit`, run `npm test -- --runInBand __tests__/agents __tests__/api/channel-agent-assignments.test.ts __tests__/components/settings/channel-agent-assignments.test.tsx __tests__/security/channel-agent-assignment-postgres.test.ts`. Release acceptance still requires the approved nonproduction PostgREST/Temporal/provider integration with two real disposable connections, versioned replay and unknown-result reconciliation.