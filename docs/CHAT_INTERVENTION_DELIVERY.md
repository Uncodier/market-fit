# Chat intervention delivery

## Request and persistence boundary

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