# Agent channel activation and billing capacity

## Settings behavior

Persisted, established connections in Settings > Agent Channels have an **Active /
Inactive** switch. Only an effective site owner/admin can change activation. The
operation saves immediately, without submitting unrelated settings or deleting a
sender, provider authorization, conversation, or historical business record.

Manually disabled and license-suspended connections remain visible with different
status labels. They are not shown as unfinished setup. License-suspended channels
can also be explicitly kept inactive after upgrades. Draft/pending connections do
not expose activation before setup completes.

`app/components/settings/use-agent-channel-activation.ts` adopts canonical server
connection states while preserving unsaved drafts and other form sections.
`app/context/site-resource-sync.ts` refreshes resource mirrors through authenticated
RLS reads after mutation, between same-origin tabs, and on settings Realtime updates.
Realtime cross-device updates require the existing settings publication; execution
authorization never relies on browser refresh timing.

## Protected state and account limits

`supabase/migrations/20261020002000_manual_agent_channel_activation.sql` adds the
service-only `set_site_agent_channel_enabled` RPC. The HTTP boundary is
`POST /api/agent-channels/[siteId]/enabled` with only `{ connectionId, enabled }`.
The route derives the actor from the authenticated session. The database rechecks
effective manager access under the existing site-license lock and rejects missing,
foreign, ambiguous, and unfinished connections.

Manual disable is protected `_license.manually_disabled: true`, effective
`status: "disabled"`, and `enabled: false`. It consumes no account capacity and is
never automatically restored when a plan improves, a trial changes, or another
account is removed. Provider synchronization cannot clear manual intent. Explicit
activation restores the trusted connected/Voice state and sets `enabled: true`.

Reactivation respects the effective plan (including trial expiry) and the paid
shared account add-on pool. Social-account and agent-channel base allowances remain
separate; their excess usage competes for the same add-ons. A full pool returns
`ACCOUNT_LIMIT` and opens the existing billing upgrade dialog. It cannot evict an
already active account to reactivate an older connection. Admission, reconciliation,
and post-write checks are atomic; denied activation leaves settings unchanged.

Disabling releases **capacity**, not a paid subscription item. It does not change
Stripe quantity, prices, credits, invoices, or scheduled cancellation. The customer
must explicitly reduce add-ons or change plans through billing to change charges.
Existing paid entitlement writers and billing-change triggers continue to own
payment state and automatic license suspension/restoration.

## Consumers and execution boundaries

`lib/agent-channel-state.ts` supplies the shared UI predicate for billing counters,
site channel/routing availability, outreach destinations, Content Creator channels,
and workflow account selectors. Voice alone retains legacy `active`/`synced` status
compatibility. Historical conversation channels remain history, not authorization:
the chat composer blocks button, Enter, and native submit when the selected external
channel becomes unavailable, without discarding the draft or silently switching it.

The companion API changes in
`/Users/prado/Desktop/Proyectos/Uncodie/Code/API/docs/MANUAL_DISABLED_EXECUTION.md`
use `get_site_licensed_resources` before provider dispatch and automatic inbound
responses. Disabled trusted inbound text can retain user-only history without
starting Customer Support/workflows. Connectionless external workflow fallback is
denied; web workflows remain supported.

Limitations: already accepted provider sends/calls and already-running workflows
are not cancelled. Zavu-native Voice speech can continue without local tool calls.
Current Voice callback payloads lack trusted sender identity, so mixed enabled/
disabled Voice senders conservatively block local tools for the site. Legacy
top-level email/AgentMail/WhatsApp settings outside `channels.connections` do not
inherit an individual connection's manual-disable marker. Old worker jobs without
the new pinned metadata are not retroactively rewritten.

## Rollout and verification

The migration requires the existing site licensing, startup-trial licensing/resource
projection, and legacy Voice correction migrations. Apply it only after explicit
approval of the target and prerequisite inspection. It forward-corrects installed
function bodies and fails loudly on incompatible prerequisites. It preserves
existing ACLs, immutable resource priority, and duplicate-identity guards. Its
private transaction capability table has RLS and no browser/service table grants.

Deploy the shared database change before the web activation endpoint, then coordinate
the API/worker consumer rollout. No remote migration, deployment, payment, or
production build is performed by adding these files.

Focused local checks:

```sh
npm test -- --runInBand __tests__/api/agent-channel-enabled.test.ts __tests__/components/settings/agent-channel-activation.test.tsx __tests__/context/site-resource-sync.test.tsx __tests__/components/chat/chat-input.test.tsx
npm test -- --runInBand __tests__/lib/agent-channel-state.test.ts __tests__/hooks/use-channel-selector.test.tsx __tests__/components/billing/use-required-license.test.tsx __tests__/app/tests/workflows/workflow-channel-availability.test.tsx
npm test -- --runInBand __tests__/security/manual-agent-channel-activation.test.ts __tests__/security/startup-trial-migration.test.ts __tests__/security/startup-trial-repairs.test.ts __tests__/security/site-resource-license-migration.test.ts
npm run typecheck
```

The database tests use disposable socket-only PostgreSQL and never a configured
remote URL. `LICENSE_TEST_PG_BIN` selects local binaries; missing binaries or the
sibling migration checkout cause explicit skips, not proof of concurrency safety.