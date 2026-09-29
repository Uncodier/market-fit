# Automated outreach settings

The Activities tab configures `settings.activities.leads_initial_cold_outreach`
and `settings.activities.leads_follow_up`. Both are opt-in: missing settings and
legacy `default` status are normalized to `inactive`; explicit `active` survives
hydration and saves.

Each activity stores:

- `channel_accounts: Record<string, string[]>`: explicit sending accounts, with
  `email: []` and `whatsapp: []` retained as defaults. Other valid keys and empty
  arrays survive schema parsing, hydration, both save paths, and reloads. Keys
  must match `/^[a-z][a-z0-9_-]{0,63}$/`; prototype keys (`__proto__`, `prototype`,
  `constructor`, and Object.prototype names) are rejected. Invalid keys are
  removed during hydration and rejected by the form schema, never renamed.
  No selected account means that channel is disabled, without fallback.
- `segment_ids: string[]` and `all_segments: boolean` (default `false`): segments
  are loaded with the browser's authenticated Supabase client, RLS, and an
  explicit site filter. Empty segments target no leads unless all segments is
  explicitly enabled. Unavailable selections are not silently replaced.
- `daily_message_limit`: integer 1–10,000, default 30, shared across all accounts
  and channels for that activity per day.
- `max_unanswered_messages`: integer 1–100, default 3. Counts confirmed outreach
  messages across channels since the last authentic inbound message, excluding
  drafts, pending and failed messages. The workflow allows its reply-wait period
  before marking a contact cold on the next eligible check.
- `weekdays`: JavaScript weekday numbers, Sunday = 0. Follow-up only; default
  `[2, 3, 4]`. Empty days prevent enabling follow-up. The displayed timezone is
  first business-hours entry's timezone (or the legacy object's timezone), falling
  back to America/Mexico_City. An explicit
  invalid timezone blocks enabling/saving rather than silently changing it.

Cold outreach addresses contacts who have never written/replied; follow-up
requires a previous authentic inbound message. Backend orchestration and delivery
remain responsible for enforcing audiences, quotas, timing and account access.
UI validation is not an authorization boundary.

## Sending accounts and message formats

The selector groups accounts dynamically using the site's persisted
`settings.channels.connections` and saved channel keys. Email, WhatsApp, SMS,
Telegram, Messenger, Instagram, voice, and custom channels use the same rules:

- A connection must have exact `connected` status, a nonblank `zavu_sender_id`,
  and a unique usable raw `id`. IDs need not be UUIDs; they must be at most 200
  characters, already trimmed, and contain no control characters. Duplicate IDs
  are excluded, even when another matching connection is disconnected.
- Disabled connections and explicitly deactivated email connections are not
  offered. Merely declaring a type, a social profile, or an account without a
  sender does not make an outreach account usable.
- The saved value is `channels.connections[].id`, **not** `zavu_sender_id`.
  Configured legacy direct accounts retain IDs `email`, `agent_email`,
  `whatsapp`, and `agent_whatsapp` with their existing readiness checks. Connection
  IDs may not reuse those reserved legacy IDs.
- Saved disconnected accounts remain visible under their channel, can be removed,
  and will not send. Enabling an activity requires at least one selected usable
  account on any channel, not necessarily email or WhatsApp. Unavailable saved
  selections never cause an implicit replacement.

Labels reuse `lib/site-channels#getChannelLabel`; voice is displayed as **Voice
calls**. Voice calls require the contact's **explicit consent** before outreach;
selecting an account does not grant consent. Audio is a **message format**
supported by applicable messaging channels, not a separate account or channel;
`audio` is therefore not an outreach channel key. Channel expansion does not
create per-channel daily or unanswered budgets: both limits remain shared across
all channels for the activity.

Activity-only saves validate against persisted channel configuration, not unsaved
channel edits. Save Channels first after connecting an account. Both save paths,
the form adapter, delayed settings hydration, site changes and context refreshes
preserve outreach parameters. Failed activity saves keep the form dirty.

Focused regression command:

```bash
npm test -- --runInBand __tests__/components/settings __tests__/lib/site-channels.test.ts
```