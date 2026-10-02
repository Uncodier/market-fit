# Social comment conversations

## Identity and rollout

Public comments use one conversation per **site + network + owned social account
+ social author + Outstand post**. Repeated comments by the same author on that
post reuse the conversation; another author, post, account or network does not.
Instagram DMs retain their separate private provider-conversation identity.

The companion API creates deterministic versioned UUIDs for these groups and for
each inbound comment/proposal pair. Existing primary keys resolve concurrent
creation without a new database migration. Missing stable author IDs use an
isolated per-comment conversation, not an anonymous shared contact. The worker
must supply the owned publisher account and preserve each comment's parent ID.

Deploy the coordinated API, comment worker and web changes together. Do not
enable only the web grouping: it does not merge or split database records. No
remote migration, historical backfill or provider send is part of local tests.

Existing mixed conversations are retained with their IDs and moderation state.
They are not relabeled as single-post groups based on a partially loaded page.
A future historical split needs a separately reviewed data operation preserving
message IDs, approval destinations, audit history and worker processing markers.
The account-scoped worker rollout uses a prospective cutoff for newly introduced
or ambiguous account scopes rather than replaying historical comments. Existing
checkpoints/claims are reused only when their account relationship is explicit.
Older comments outside that safe boundary need a separately authorized backfill.

## Persisted contract

Conversation `custom_data` uses `source: "comment"`,
`comment_grouping_version: 1`, `network`, `publisher_account_id`,
`outstand_post_id`, and `author_id`. Display snapshots can include
`publisher_username`, `platform_post_id`, `platform_post_url`, `content_id`,
`post_title`, `post_text`, and non-LinkedIn `author_name`/`author_username`.
The owned publisher's username is never the external contact's identity.
LinkedIn member names continue to require resolve-on-read rather than persisted
provider member metadata; a real linked CRM lead can still supply a name.

Inbound messages retain `platform_comment_id` and optional `parent_comment_id`.
Proposals and manual replies retain **`reply_to_message_id`** (the persisted
inbound message) and **`reply_to_comment_id`** (the exact provider destination),
together with the post/account/network dimensions. Neither UI order nor the
latest inbound message establishes a reply target.

## Conversations UI

- The list shows contact identity plus recognizable post context. Manual titles
  remain intact; generated titles may resolve to the contact name.
- Canonical groups show a sticky post card with available title/text and links.
  Missing preview data is explicitly unavailable; no invented thumbnail/content.
- Legacy mixed conversations show post context per message instead of claiming
  one header covers the whole history. Each inbound comment uses its own author.
- Independent comment threads are ordered by root time; replies remain directly
  beneath the exact parent, with chronological siblings. Pending proposals stay
  with their original comment and are labeled **Proposed public reply**.
- The reply shows an exact original-comment quote. Missing/deleted/ambiguous
  context is labeled unavailable, never filled from a nearby message.
- The loader retains pending messages plus the newest 40 non-pending comment
  rows. Exact missing parent UUIDs are fetched under RLS in the same conversation
  for display-only quotes; they do not introduce unrelated timeline rows.
- Non-comment conversations keep their existing pending ordering and DM behavior.

## Sending and approval

The composer requires an explicit comment selection and labels the action
**Reply publicly**. It does not expose a channel switch for public threads.
Selection is scoped to the current site/conversation and is invalidated when the
selected message disappears. There is no automatic latest-comment fallback.

The same-origin intervention proxy checks session, site capability and RLS access,
then looks up the selected inbound message within the authorized conversation.
For canonical groups it also checks account/network/post/author equality. Only
the inbound message UUID is forwarded; client-supplied provider IDs are ignored.
The API independently validates ownership before persistence and delivery.
Retries reuse the saved target; they cannot redirect an existing reply.

Approval changes moderation state, not the stored destination. Delivery rechecks
the saved proposal and its source rather than choosing a newer comment. A missing
or conflicting destination fails closed. Unconfirmed provider sends require
reconciliation instead of automatic replay.
Legacy proposals lacking an explicit saved source stay blocked; the UI does not
retroactively guess their target. Returning a public reply to pending also uses
a metadata compare-and-set and refuses to erase an existing delivery claim.

## Verification

Run local Jest and type checks using the committed dependencies:

```bash
npm test -- --runInBand __tests__/chat __tests__/lib/chat __tests__/components/chat __tests__/services/get-conversation-comment-messages.test.ts __tests__/services/conversation-list-items.test.ts __tests__/api/accept-message.test.ts __tests__/api/intervention-comment-preflight.test.ts __tests__/hooks/use-comment-reply-selection.test.tsx
npm run typecheck
```

Companion API/worker tests cover deterministic group reuse, account/network/post/
author separation, duplicate ingestion, exact provider reply destinations, and
DM isolation. Unit tests use isolated doubles, not real social accounts. Live
ingestion/approval/browser verification needs an explicitly approved disposable
site and connected provider accounts; do not infer deployment from local success.