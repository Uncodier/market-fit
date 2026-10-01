# Automated outreach settings

## Always-active ICP mining

The Activities tab also configures `settings.activities.icp_lead_generation`:

```json
{ "status": "active", "target_leads": 150, "research_enabled": false, "all_lists": true, "list_ids": [] }
```

ICP mining is always active, independently of Leads Follow Up and channel
health. There is no status toggle; missing and legacy inactive/default statuses
normalize to `active`. Mining itself does not enable or send outreach.
`target_leads` is an integer from 1 to 3,000 (default 150): a target of leads
found and enriched per run, not scanned candidates or a guaranteed number of new
leads. `research_enabled` controls additional deep research and defaults to false.
Invalid targets and non-boolean research values block saves rather than being
silently coerced. Backend workflows remain responsible for execution.

Daily ICP runs are distributed by site over 24 hours, independent of business
hours and weekends.
ICP has no configurable fixed start time; its card does not offer a time input.

The [pending mining list selector](ICP_MINING_LIST_SELECTION.md) defaults to all
pending lists dynamically, including future lists and resumable running lists.
Turn off **All pending lists** to use only explicit `list_ids`; an empty selection
means no work, never a fallback to all lists. Saved unavailable IDs remain
removable. Saves validate the selection's shape, not transient list availability.

Hydration, form parsing, Activities saves and Save All preserve unknown ICP keys,
neighboring activity parameters and future activity keys. Settings persistence
merges activities with the latest readable row through the existing user-scoped
Supabase client and RLS; it does not introduce a service-role write. The selector's
separate read-only API authorizes site membership before listing pending requests,
including requests without associated segments.
Jest roundtrip tests use an in-memory authenticated-client/RLS double and do not
verify a live project's policies.

## Opt-in outreach

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
- `start_time_mode` (both activities): **Business opening time** (`business_opening`)
  or **Custom time** (`custom`). Only custom shows a required clock input.
- `start_time`: strict 24-hour `HH:mm` from `00:00` to `23:59`, in the site's
  timezone. Custom mode rejects missing, null, malformed or padded times, even
  while inactive. Opening mode ignores retained custom values, so resetting works
  with partial-update persistence without deleting keys. Unknown modes are invalid.
- Opening mode uses each execution day's opening (09:00 fallback if unavailable)
  and skips explicitly closed days. Cold Outreach follows operating days in both
  modes, using Monday–Friday for missing day entries. Its custom time replaces the
  old opening-plus-two-hours offset. Follow Up uses selected weekdays; custom mode
  can run on explicitly selected closed days.
- Legacy times without a mode display as custom. Missing both fields displays
  opening mode; saving that card persists the choice without rewriting neighboring
  activities. Untouched settings retain legacy execution until saved.
  [Daily Standup](DAILY_STANDUP_SETTINGS.md) uses the same selector.

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
calls**. Voice calls are blocked by **explicit call opt-outs** (`do_not_call`,
revoked consent, or legacy denied consent), not missing/unknown consent or a
missing grant timestamp. Selecting an account does not change consent or opt-out
preferences. Audio is a **message format**
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