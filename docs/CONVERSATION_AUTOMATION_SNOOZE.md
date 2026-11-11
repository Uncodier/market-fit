# Conversation automation snooze

## UI and integration routes

- `/chat?conversationId=<uuid>` is the primary conversation UI; `/chat/<uuid>`
  is a middleware alias. The lead detail Conversations tab links to this UI.
- `ChatHeader` shows automation snooze controls for customer conversations,
  not internal agent conversations. `ConversationItem` shows the paused-until
  badge in the list, independently of assignment and moderation status.
- `sendTeamMemberIntervention` calls `/api/agents/chat/intervention`; the existing
  authenticated same-origin proxy forwards to the configured API server's same
  route. This feature does not alter that proxy or trust extra client role flags.
- Legacy `addTeamMemberMessage` / `addMessage` in `app/services/chat-messages.ts`
  still insert `messages.role = 'team_member'` directly. The shared database's
  human-reply trigger must cover these writes as well as API intervention.

## Shared database contract and rollout prerequisite

The API/database workstream owns the forward-only migration. No duplicate
frontend migration is included. Apply its approved migration **before** deploying
this frontend: list queries and controls require these `conversations` columns:

| Column | Type | Meaning |
| --- | --- | --- |
| `automation_paused_until` | nullable timestamptz | Pause is active only while this is in the future |
| `last_human_reply_at` | nullable timestamptz | Timestamp recorded by trusted human-reply ingestion |
| `automation_snooze_hours` | nullable numeric | Null = 4 hours; 0 = disabled; otherwise up to 168 hours |

At implementation time no conflicting frontend snooze migration was found;
the existing frontend migration head was `20261109223000_shipment_carrier_documents.sql`.
Database deployment and live workflow suppression are not verified by frontend tests.

Nonzero/default settings affect future human replies; setting 0 also clears the
current pause. Resume now clears only the exact pause observed by the UI, so a
newer human reply cannot be silently resumed by a stale action. No operation
changes the assignee, agent, or last-human-reply attribution.

Server Actions validate strict inputs, authenticate with `auth.getUser()`, check
`user_can(select/update)` and unscoped-site access, and constrain RLS-backed
queries to both conversation and site. They use the real user client, not demo
or service-role clients, and return only the three snooze fields or safe errors.

## Live state and activity

The header re-reads authorized state on conversation UPDATE, reconnect, focus,
and a 60-second fallback interval. SWR keys include account, site, and conversation.
Successful settings/resume actions revalidate both header and conversation lists.
Existing list realtime mapping includes snooze fields. Badges expire locally
without requiring a database update. The popover shows the last human reply time;
no duplicate synthetic activity messages are written. Null-user human messages
use an external-human fallback rather than the signed-in owner's identity.

## Offline verification

```sh
npm test -- --config __tests__/chat/jest.snooze-offline.config.cjs --runInBand
```

The dedicated config does not load project environment files or global fetch
mocks. Coverage includes server authorization, tenant scope, strict bounds and
bypass rejection, compare-and-set resume, real shared UI controls, badge expiry,
error states, realtime/reconnect cleanup, list field mapping, and sender fallback.
It does not prove the migration, RLS policies, triggers, provider echoes, or
workflow suppression work against a deployed database.