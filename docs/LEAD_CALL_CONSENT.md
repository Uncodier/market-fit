# Lead outbound-call consent

The lead detail's **About → Info** contact fields display **Outbound calls**
directly below **Phone**, including when empty fields are hidden. **Edit call
consent** manages the existing database fields:

- `voice_call_consent_status`: Unknown, Granted, or Revoked.
- `voice_call_consent_at`: when explicit outbound-call consent was obtained.
- `do_not_call`: an independent restriction that overrides granted consent.

Outbound calls do not require recorded consent. Unknown/missing consent and a
missing/invalid grant timestamp do not block calling. Explicit call opt-outs do:
`do_not_call: true`, `Revoked`, or legacy `denied` status. The composer, web proxy,
and external API enforce this policy independently, alongside recipient and
sender eligibility. Deploy the web and external API changes together; an older
API still requires granted consent. No consent state is automatically changed.

Granting consent requires entering the actual consent date/time and explicitly
confirming the lead agreed to outbound calls to the displayed number. The date
is entered in the operator's local timezone, persisted as UTC, and cannot be in
the future. Unknown/Revoked clears the grant timestamp. Clearing **Do not call**
never grants consent. An inbound call and consent to store contact data are not
outbound-call consent. Saving settings never requests consent or starts a call.

## Authorization and persistence

The editor requires loaded site update capabilities. Its dedicated Server Action
validates the entire input and confirmation, authenticates with a real
user-scoped Supabase client (not demo or service role), and checks `user_can` for
the requested site. Owner/admin/collaborator update capabilities follow the
existing permissions model; read-only users cannot save.

The update is filtered by lead ID, site ID, and the editor's original consent,
do-not-call, phone, and `updated_at` snapshot. RLS remains responsible for access
to the particular lead, including assignment restrictions. A stale edit cannot
overwrite a newer revocation or phone change. An inaccessible or zero-row update
is an error, not success. The general `updateLead` action rejects these three
fields so it cannot bypass explicit confirmation.

Successful saves return persisted fields to the lead page and invalidate the
site's SWR conversation/lead cache. Chat's normal focus revalidation also reloads
data after returning from another tab. The intervention proxy and external API
still enforce current eligibility independently before starting a call. No
automatic submission/retry is performed after a failed or ambiguous save; reload
the lead to verify its current state. Rejected edits retain the dialog's draft.

## Scope and limitations

This UI uses the existing columns from `20260921224000_enforce_voice_call_safety.sql`;
it introduces no migration or remote data changes. It records current consent
state and grant time, **not an immutable audit history**, collection method, or
the identity of the person who recorded it. Those require a separately designed
audit persistence model; do not treat this editor as evidence that consent was
actually obtained. Existing database/Data API writers are not replaced by this
Server Action.

The historical migration's consent-required column comment describes the former
admission policy. Its constraint validates a recorded grant, not call eligibility,
and remains unchanged; no migration is needed to permit calls with unknown consent.

## Offline checks

```bash
npm test -- --runInBand __tests__/leads __tests__/hooks/use-lead-data-routing.test.tsx __tests__/chat/voice-call-eligibility.test.ts __tests__/api/intervention-voice-preflight.test.ts
npm run typecheck
```

These tests do not update real leads or start provider calls.