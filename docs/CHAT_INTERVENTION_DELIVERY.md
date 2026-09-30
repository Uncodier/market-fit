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

The external API currently handles the `voice` channel through
`placeTrackedVoiceCall`, directly calling the voice provider after saving the
message. It returns `channel_send.method: voice_agent_call` and a `callId`,
not a Temporal workflow ID. Consent, do-not-call restrictions, the lead's E.164
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

Check the browser's same-origin request status and the API error code first.
Determine whether a saved message ID, call ID, or workflow ID exists before
retrying. Never log message content, phone numbers, authorization headers, or
provider payloads while collecting evidence.

The local configuration inspected for this repair pointed to the external API
on port 3001. Read-only schema inspection confirmed the intervention message
columns and `team_member` role exist. Available logs did not establish a
specific production message-save failure, so this repair does not claim a
verified root cause for a particular failed request.

Focused offline regression checks:

```bash
npm test -- --runInBand __tests__/chat __tests__/api/intervention-proxy.test.ts __tests__/hooks/use-chat-operations.test.tsx __tests__/components/chat/chat-input.test.tsx
npm run typecheck
```

Tests use isolated API/database doubles. A real call requires a separately
approved disposable target, a consented test lead, and provider configuration.
No real call, deployment, production build, or remote migration is part of these
checks.