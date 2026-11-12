# Chat intervention delivery

## Localized attachment widgets

Chat attachment labels, media controls, composer hints, channel selectors and
delivery statuses follow the existing interface locale (English, Spanish, French,
German or Japanese). Actual uploaded filenames and message content are preserved.
Generated generic attachment names are localized for display only.

Audio uses a compact inline player with play/pause, an accessible seek slider,
elapsed time, actual duration and 1×/1.5×/2× playback rates. Recordings are not
autoplayed or prefetched; duration stays unknown until media metadata is available.
Failed recordings retain their filename link and a localized manual retry.
Attachment replacement resets the player's state. Images open from their preview;
documents open from their name/card. No redundant “Open file” action is rendered,
and interacting with audio/video controls never opens another tab.

## Request and persistence boundary

### Audio delivery evidence

Provider acceptance (`sent`) is displayed as **Sent to provider; delivery
unconfirmed**, not **Delivered**. Audio status follows the persisted
`audio_delivery.delivery_status` / `state` receipt; confirmed delivered/read
events take precedence over stale command failure flags. Failed or uncertain
receipts retain the no-resend guard. A request still in `sending` remains visible
even when no audio attachment or delivery receipt has been persisted.

The API must reconcile signed Zavu delivery events into audio receipts. Deploy
the web and API changes together. This does not reconcile historical sends,
repair database timeouts, or automatically replay interrupted delivery.

Regression: `__tests__/components/chat/audio-delivery-status.test.tsx`.

The chat composer sends team-member interventions through the same-origin
`POST /api/agents/chat/intervention` route. The web server:

1. Checks the session, site membership, and insert/update capability.
2. Loads the conversation under the user's RLS session and requested site.
3. Derives the author, agent, lead, and visitor from authenticated/server-owned
   data, not browser-provided identities.
4. Forwards the user's bearer token to `API_SERVER_URL`, falling back to
   `NEXT_PUBLIC_API_SERVER_URL`. It never forwards a service key.

The external API owns message creation. A successful send must return
`success: true` and `data.message.message_id`. The composer replaces its
optimistic row with that ID without waiting for Realtime. An existing Realtime
row wins over the HTTP snapshot.

Malformed responses, admission errors, and network failures are not successful
sends. The draft remains available. A definite post-save failure may consume
the draft only when its exact saved row can be shown. Failure handling never
inserts a replacement message or chooses another row by matching text.
On non-2xx responses, a saved message ID alone is not evidence that execution
never started: client failure marking additionally requires an explicit
`execution_started: false`. An unconfirmed voice response retains its saved ID
and displays that row as pending without discarding the draft.

Retries carry `message_id`, reuse the original content, and require a failed
team-member row belonging to the authenticated author and conversation. An
existing provider call or unconfirmed call placement cannot be replayed via
this retry path. Repeatedly submitting the composer is a new request; do not do
so after an ambiguous timeout without checking the conversation first.

## Voice and Temporal are different paths

### Text and audio responses

The composer shows **Text / Audio** immediately to the right of the channel
selector only for WhatsApp, Telegram, and Messenger direct conversations.
New sends explicitly use `response_format: "text"` by default; **Audio** requests
use `response_format: "audio"`. Switching to an unsupported channel or another
conversation resets the selection to Text. Failed draft submissions retain the
selection. Channel loading/updates block submission until routing is ready.

A failed channel lookup displays an error and a **Retry channel** button without
discarding the draft or permitting a send through an unverified channel. Retry
loads the authoritative channel again. In-flight channel updates are tracked per
conversation and operation; completing an older update releases only its own
lock, including when the user navigated away, without unlocking a newer update.

The optional API field accepts only `text` or `audio`; omission remains available
for legacy callers. The intervention proxy uses the RLS-loaded conversation
channel, not a browser channel override, and rejects unsupported audio (including
public comments). Internal agent requests explicitly send Text; their proxy still
rejects external conversations and does not permit Audio.

Saved-row retries restore `custom_data.requested_response_format`, falling back
to `custom_data.response_format`, retain `message_id`, and reject changing the
saved format. Legacy rows without a format keep omission.
Audio receipts in `preparing`, `preparation_failed`, `dispatching`, `sent`, or
`unknown` state block replay in both the UI and proxy, even if a stale command
reports failure. Only a `ready` receipt can reuse its prepared audio on retry.
The API must persist this metadata and propagate the format to delivery workers;
the frontend does not synthesize audio or fall back to text. Provider playback,
audio generation and actual delivery require coordinated API/worker rollout and
separate live verification.

### WhatsApp template fallback for requested Audio

Audio remains the requested selection, not proof of an audio attachment. The
composer explains that a closed WhatsApp messaging window may use a compatible
template instead. This does not claim that microphone audio is supported in a
template. The frontend neither chooses templates nor calls providers.

The API must persist these exact names in `messages.custom_data`, delivered by
the existing message reads and Realtime updates:

- `requested_response_format: "audio"` and `response_format: "audio"` (requested).
- `delivery_format: "template"` (actual delivery).
- `template_delivery.state`: `creating`, `submitting`, `pending`, `ready`,
  `dispatching`, `accepted`, `sent`, `delivered`, `read`, `failed`, `rejected`, or `unknown`.
- `template_delivery.delivery_status`: `queued`, `sending`, `sent`, `delivered`,
  `read`, or `failed`. This distinguishes provider acceptance from delivery.
- `template_delivery.template_id` and `template_delivery.language` identify the
  template; they are not rendered as provider payloads or required for the label.
- `status`: `queued` after acceptance, then `sending`, `sent`, `delivered`, or
  `failed` as the API reconciles delivery. The synchronous HTTP success response
  can still say `sent` for wire compatibility; that alone is not delivery proof.
- Unavailable workflow reconciliation must surface `status: "needs_reconciliation"`
  or `needs_reconciliation: true` in persisted metadata to replace stale pending
  approval with **Template delivery unconfirmed**. The API owns persistence; a
  workflow result not exposed through message reads/Realtime cannot update the UI.

Display precedence (independent of stale `command_status`):

1. Receipt `state` or `delivery_status` of `read`/`delivered` shows **Template read** /
   **Template delivered**, even with stale failed or reconciliation flags. The API
   owns event ordering; the browser does not compare webhook timestamps.
2. Receipt `state: failed|rejected`, `delivery_status: failed`, or top-level
   `status: failed` shows **Template delivery failed**, overriding stale accepted/sent.
3. Unknown/placement-unknown or reconciliation-required shows **Template delivery
   unconfirmed**, not success or pending approval.
4. Receipt `delivery_status: sent` shows **Sent as template**; `sending` shows
   **Sending template**.
5. `state: accepted` or legacy `state: sent` without an actual sent/delivered/read
   receipt shows **Template accepted** in amber, with no green timestamp check.
6. Creating/submitting/pending shows **Pending template approval**; ready shows
   **Template ready to send**; dispatching shows **Sending template**. Unsupported
   or missing receipt details remain unconfirmed, never inferred as delivery.

Timestamp checks use the same resolved label and only appear for sent/delivered/read.
Attachments still require the existing persisted `attachments` contract; requesting
Audio alone never creates an audio player.

UI, retry hook, and authenticated proxy block every template receipt, including
`ready` and `rejected`: the API workflow remains the sole owner of template
dispatch. Neither approval nor rejection grants manual retry permission.
Existing audio receipt guards still apply to non-template sends. Client error reconciliation preserves
template metadata instead of overwriting it with a generic HTTP failure.

The HTTP response allowlist is unchanged: it returns lifecycle identifiers, not
template metadata. Realtime remains authoritative. No provider call or production
delivery has been verified by the offline tests.

Public social-comment threads require an explicit persisted `reply_to_message_id`.
The composer labels the action **Reply publicly**; the proxy and API validate the
same-conversation inbound target and preserve it on retry. Public replies cannot
switch into DMs by selecting another channel. See
[Social comment conversations](SOCIAL_COMMENT_CONVERSATIONS.md) for grouping,
post context, moderation and coordinated API/worker rollout.

Conversation routing uses the persisted channel and delivery metadata, not the
absence of a lead/visitor link or a URL `mode` parameter. Inbound voice calls
can legitimately have neither link; they are still external conversations.
The direct agent-message proxy rejects external conversations before generating
assistant text. Sends are blocked until the current conversation's routing data
is loaded, so switching from an internal chat cannot reuse its mode.

For voice, the composer labels the action **Start call** and describes the message
as the opening greeting. It loads the linked lead's phone, do-not-call flag, and
outbound consent status. Missing lead, invalid international phone, or an explicit
call opt-out (`do_not_call`, `revoked`, or legacy `denied` consent) blocks button,
Enter, and native submit with an actionable explanation, without discarding the
draft. Missing/unknown consent and missing/invalid consent timestamps do not block
calls. These checks apply only to Voice; they do not block a separately selected
text channel.

The intervention proxy independently reads current lead eligibility under the
user's RLS session and conversation site, including on retries. Rejections happen
before upstream persistence/provider work and return a fixed `VOICE_*` code with
`execution_started: false`, without claiming a saved message. A rejected retry
restores only its own optimistic state; newer Realtime updates win. Unknown
execution outcomes remain pending and are never automatically replayed.

A number embedded in a title is not a trusted recipient. Neither an inbound call
nor permission to store contact details changes recorded outbound-call consent.
The composer and proxy do not grant consent; recorded consent is no longer an
admission requirement. The external API still rechecks lead-phone, explicit call
opt-outs and sender eligibility before placement. Deploy the web and external API
changes together; an older API still requires granted consent. A returned call ID
is **requested**, never answered or completed.

The external API currently handles the `voice` channel through
`placeTrackedVoiceCall`, directly calling the voice provider after saving the
message. It returns `channel_send.method: voice_agent_call` and a `callId`,
not a Temporal workflow ID. Explicit call opt-outs, the lead's E.164
phone number, and a connected Voice sender still apply.

Voice delivery rows and provider webhooks track the call. A provider acceptance
is not proof that the recipient answered. `placement_unknown` is explicitly
unconfirmed and must not become a retryable failed call merely because an HTTP
request timed out. Legacy voice messages are displayed using their terminal
`call_status` even if an older API left `command_status` pending.

Other supported channels use the external API's Temporal send methods. The
approved-message voice automation also has a separate
`sendVoiceCallFromAgentWorkflow`; that is not the browser intervention entry
point. Do not use `/api/workflow/humanIntervention` as a substitute for chat
message persistence.

## Diagnostics and validation

### Direct agent messages after the authentication hardening

`/chat` selects `sendAgentMessage` for agent-only/private conversations and
`sendTeamMemberIntervention` for interventions. These remain different API
operations; do not route agent messages through the intervention endpoint.

The external API security change `d69ad7dc` (2026-09-20) removed the old
`Origin`-only authentication bypass. The direct agent client still called the
external `/api/agents/chat/message` without credentials, producing `401` with
`UNAUTHORIZED` and `API key is required for server-to-server requests`. That
legacy error wording does not establish that the caller is a server: missing
credentials on a browser request produce the same error.

Direct agent messages now use the authenticated same-origin
`POST /api/agents/chat/message` proxy. It checks site membership, insert
capability, the conversation and its assigned agent under user-scoped RLS, then
forwards the verified user's bearer token and server-derived identities. No API
key or browser-supplied author identity is needed. The response exposes only
the saved assistant reply; incomplete/non-JSON responses do not consume the
draft as successful sends. Requests are bounded and never automatically replayed.
The browser no longer logs message payloads or raw backend responses.

This diagnosis is verified against source and commit history, not a captured
production request. The API repository was inspected read-only; its middleware
already supports validated Supabase user tokens, so this repair changes only
the web application and does not restore the insecure `Origin` bypass.

### Delivery checks

A read-only incident inspection on 2026-09-30 confirmed a contactless inbound
voice conversation was misclassified as internal. Its later team follow-up and
assistant reply shared a completed `create message` command and no call ID; the
only voice delivery row was the earlier inbound call. The previous auth repair
had made that incorrect route executable, but had not corrected classification.
No incident IDs, phone numbers or customer message content are recorded here.

That history also contained a separate `Voice tool callback authentication
failed (HTTP 401)` event from the earlier inbound call. Fixing chat routing does
not repair or validate the provider's tool callback credentials. Do not claim
callback recovery without separately checking the API/provider configuration.

Check the browser's same-origin request status and the API error code first.
Determine whether a saved message ID, call ID, or workflow ID exists before
retrying. Never log message content, phone numbers, authorization headers, or
provider payloads while collecting evidence.

A separate read-only inspection on 2026-10-01 found a failed outbound follow-up
in a linked inbound Voice conversation. The lead had `unknown` outbound consent
and no consent timestamp. The follow-up had no provider call ID; the only delivery
was the earlier completed inbound call. The former consent-required policy made
this state ineligible for a new call; the current opt-out-only policy permits it
when recipient and sender checks pass and no explicit call opt-out exists.
The saved follow-up contained only the proxy's generic error, so it does not
independently establish the exact original provider/API exception. Source and
regression tests confirmed the client could overwrite a saved failure diagnosis
with that generic error. Failure reconciliation now preserves an already-failed
row with a recorded diagnosis instead of rewriting its metadata. Historical rows
are not backfilled and recorded consent is not modified by the eligibility change.

Email-identification callbacks during the inbound call are a separate API flow;
this web change does not repair or activate provider tool schemas or prompts.

During the earlier intervention-delivery repair, the inspected local
configuration pointed to the external API on port 3001. Read-only schema
inspection confirmed the intervention message columns and `team_member` role
exist. Those logs did not establish a specific production message-save failure;
the authentication diagnosis above is separate from that earlier investigation.

Focused offline regression checks:

```bash
npm test -- --runInBand __tests__/chat __tests__/api/intervention-proxy.test.ts __tests__/api/intervention-voice-preflight.test.ts __tests__/api/agent-message-proxy.test.ts __tests__/hooks/use-chat-operations.test.tsx __tests__/hooks/use-lead-data-routing.test.tsx __tests__/components/chat/chat-input.test.tsx
npm run typecheck
```

Tests use isolated API/database doubles. A real test call requires a separately
approved disposable target, a recipient who agreed to the test, and provider configuration.
No real call, deployment, production build, or remote migration is part of these
checks.