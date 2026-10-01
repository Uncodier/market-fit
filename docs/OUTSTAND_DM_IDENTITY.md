# Outstand Instagram DM display identity

## Read-only frontend contract

The active `/chat` list reads conversations through `useConversationsList` →
`getConversations.client` → `buildConversationListItems`. Realtime inserts and
updates now use that same mapper through `useConversationRealtime`; they also
revalidate the selected conversation's site-scoped `useLeadData` read. The header
and incoming message rows receive a separate display-only `participantIdentity`.
It never creates a lead or enables lead-only actions.

`lib/chat/participant-identity.ts` resolves names in this order:

1. A nonempty linked lead name, including manual CRM names.
2. `custom_data.participant_display_name`.
3. An explicit, valid `custom_data.participant_username`, displayed with `@`.
4. `Instagram contact` when no identity is available (`Visitor` remains the web
   visitor fallback).

Participant metadata is used only for `channel: instagram` and
`custom_data.source: outstand_dm`. Placeholder names, numeric sender IDs masquerading
as names, invalid handles, and non-HTTPS/credential-bearing picture URLs are not
rendered as identity. `participant_profile_picture` supplies the contact avatar;
it is not a team member's avatar. Metadata from web/LinkedIn/other sources is not
interpreted as an Outstand participant.

Manual conversation titles remain subjects, not sender names. Known generic DM
titles and API-marked `outstand_generated_title` values can display the current
linked lead/participant name instead. A manual title does not hide the contact
subtitle in the list. The frontend does not persist these display choices.

## Provider boundary and limitations

The API owns participant normalization, preservation across null provider responses,
and `lead_id` linkage. The frontend never substitutes the owned publishing account
(`outstand_social_account_id`, `metadata.platformAccountId`, account names/photos)
or turns an Instagram-scoped sender ID into a username. DM sender IDs must not be
matched to comment authors by the UI.

When Outstand supplies no name, username, or picture, there is no real identity for
the frontend to recover. `Instagram contact` is an honest label, not an identified
person. Existing rows can use a linked lead or stored participant metadata now;
future normal backend syncs can enrich them. Opening a conversation does not call
an identity-sync/write endpoint, import messages, or replay webhooks. No production
backfill or deployment is part of this change.

The former oversized `chat-list.tsx` was split into realtime and list-action hooks
to meet repository file-size guidance. Existing rename/archive/delete/bulk-action
bodies were moved with comments translated to English; tests exercise these with
mocked storage/fetch only.

## Offline regression checks

```bash
npm test -- --runInBand __tests__/lib/chat/participant-identity.test.ts __tests__/services/conversation-list-items.test.ts __tests__/hooks/use-lead-data-routing.test.tsx __tests__/hooks/use-conversation-realtime.test.tsx __tests__/hooks/use-conversation-list-actions.test.tsx __tests__/components/chat/participant-identity.test.tsx
npm run typecheck
```

These tests cover null/malformed metadata, manual lead/title priority, explicit
handles, avatar safety, owned-account exclusion, web/internal/team distinctions,
conversation/site switching, realtime updates, and extracted list actions. They
do not connect to Supabase or a social provider.

Validation on 2026-10-01: the expanded chat/routing/services regression selection
passed 20 suites / 164 tests, and `npm run typecheck` passed. Targeted ESLint for
new helpers, hooks and regression tests, plus the extracted list, passed. Linting
all touched legacy files still reports nine pre-existing `no-explicit-any` errors;
the same errors were reproduced from their `HEAD` versions. No build, deploy,
live browser test, remote write, or backfill was run.