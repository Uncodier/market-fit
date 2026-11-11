# Lead and site automation snooze

## UI and integration routes

- `/chat?conversationId=<uuid>` is the primary conversation UI; `/chat/<uuid>`
  is a middleware alias. The lead detail Conversations tab links to this UI.
- AI Activities has an **Automation Snooze** card with active/inactive status and
  a setup field for hours. Missing settings are active for four hours. It saves
  through the existing activity writer, preserving unrelated activity fields.
- Individual lead menus in `/leads` and `/leads/[id]` open the shared snooze
  dialog. Aggregate/bulk menus do not expose this action. The dialog offers
  inherit, off, or custom hours, plus each conversation's pause and Resume now.
- `ChatHeader` and `ConversationItem` show read-only paused-until badges,
  independently of assignment and moderation status. No configuration action
  is exposed in the conversation header.
- `sendTeamMemberIntervention` calls `/api/agents/chat/intervention`; the existing
  authenticated same-origin proxy forwards to the configured API server's same
  route. This feature does not alter that proxy or trust extra client role flags.
- Legacy `addTeamMemberMessage` / `addMessage` in `app/services/chat-messages.ts`
  still insert `messages.role = 'team_member'` directly. The shared database's
  human-reply trigger must cover these writes as well as API intervention.

## Shared database contract and rollout prerequisite

The API/database workstream owns the forward-only migration. No duplicate
frontend migration is included. Apply its approved migration **before** deploying
this frontend. The hierarchy requires:

- `settings.activities.conversation_automation_snooze`: `{status: 'default' |
  'inactive', hours: number}`. Hours must be greater than zero and at most 168;
  absent values default to four. `default` means active.
- `leads.automation_snooze_hours`: nullable numeric; null inherits the site,
  zero disables future snoozes for this lead, and positive values up to 168
  override the site, even if its policy is inactive.

Conversation state remains in these `conversations` columns:

| Column | Type | Meaning |
| --- | --- | --- |
| `automation_paused_until` | nullable timestamptz | Pause is active only while this is in the future |
| `last_human_reply_at` | nullable timestamptz | Timestamp recorded by trusted human-reply ingestion |
| `automation_snooze_hours` | nullable numeric | Deprecated; ignored by the new lead/site trigger |

At implementation time no conflicting frontend snooze migration was found;
the existing frontend migration head was `20261109223000_shipment_carrier_documents.sql`.
Database deployment and live workflow suppression are not verified by frontend tests.

The database workstream reported applying and verifying forward migration
`20261111040000_lead_site_automation_snooze.sql` on 2026-11-11. This frontend
workstream made no database changes or deployments; the new UI still requires
frontend deployment. Offline tests below do not independently establish live
trigger behavior.

All policy changes, including disabling, affect future human replies only;
existing pauses keep their expiry. Resume now clears only the exact pause
observed by the UI, comparing both `automation_paused_until` and
`last_human_reply_at` (including null). Even if a newer human reply leaves the
expiry unchanged, a stale resume cannot clear it. No operation changes the
assignee, agent, or last-human-reply attribution.

Server Actions validate strict inputs, authenticate with `auth.getUser()`, check
`user_can(select/update)` and unscoped-site access, and constrain RLS-backed
queries to both lead/conversation and site. They use the real user client, not
demo or service-role clients. The lead read establishes the authorized lead
before loading settings, resolves effective hours, and pages its conversations.
Read failures are not silently presented as default settings. The legacy
conversation update action accepts only Resume now; hour changes are rejected.

## Live state and activity

The header re-reads authorized state on conversation UPDATE, reconnect, focus,
and a 60-second fallback interval. SWR keys include account, site, and conversation.
Successful settings/resume actions revalidate the lead dialog and conversation caches.
Existing list realtime mapping includes snooze fields. Badges expire locally
without requiring a database update. The lead dialog shows the last human reply time;
no duplicate synthetic activity messages are written. Null-user human messages
use an external-human fallback rather than the signed-in owner's identity.

## Offline verification

```sh
npm test -- --config __tests__/chat/jest.snooze-offline.config.cjs --runInBand --testTimeout=15000
```

The dedicated config does not load project environment files or global fetch
mocks. Coverage includes server authorization, tenant scope, strict bounds and
bypass rejection, two-timestamp compare-and-set resume, real shared dialog and
lead-menu wiring, bulk exclusion, actual activity-card setup/save, existing
activity persistence regressions, badge expiry, error states,
realtime/reconnect cleanup, list field mapping, and sender fallback.
It does not prove the migration, RLS policies, triggers, provider echoes, or
workflow suppression work against a deployed database.