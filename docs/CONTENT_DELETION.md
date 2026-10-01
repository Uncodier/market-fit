# Content and Outstand deletion

The content editor's **Delete Content** modal deletes local content only by
default. If the persisted content has explicit `outstand_id_...` tags, it offers
an unchecked **Also delete linked posts from Outstand and social networks**
option. Similar titles/text and `published_...` tags never identify deletion
targets. All distinct linked post IDs are included, not just the most recent.

## Provider behavior

Verified against Outstand documentation on 2026-09-30:

- [`DELETE /v1/posts/{id}`](https://www.outstand.so/docs/delete-cancel-a-post) cancels
  scheduled posts and removes their provider record. For published posts it
  removes only the record, **not the publication on the social network**.
- [`DELETE /v1/posts/{id}/remote`](https://www.outstand.so/docs/delete-a-post-from-social-networks)
  attempts to remove publications from all target accounts. Its `success: true`
  means **at least one account succeeded**, not all of them.
- Instagram and TikTok do not support remote deletion through this API. Threads
  requires the appropriate `threads_delete` scope. Other platform/permission
  failures remain possible.

The opt-in flow cancels scheduled posts or removes published posts remotely
before removing their Outstand records. A partial or uncertain result preserves
the local content. Publications already removed cannot be restored. The modal
stays open with an error; there are no automatic retries.

## Trust boundaries

`app/content/actions.ts#deleteContent` delegates to a server-only helper. It
validates the content ID/options, authenticates the user, loads the persisted
site/tags using a user-scoped Supabase client, and checks the site's `delete`
capability. No service-role fallback is used. Local deletion includes the
original `updated_at` to avoid erasing concurrent edits, and verifies that a row
was actually deleted.

The API is called only for an explicit opt-in:

```text
DELETE /api/integrations/outstand/posts/{id}/with-content?tenant_id={siteId}
Authorization: Bearer <verified user session>
```

The adjacent API repository independently verifies the identity, site's delete
capability, and ownership of the provider post/accounts. Persisted content tags
are candidates, not ownership proof. The web app accepts only a complete
confirmation `{ success: true, post_id: <requested id>, delete_remote: true }`.
Failures, mismatched IDs/tenants, failed account results, invalid JSON, oversized
responses, redirects and timeouts do not trigger local deletion.

## Rollout and recovery

- Deploy the API endpoint and web change together (API first). The dedicated
  endpoint intentionally returns 404 on older API deployments instead of
  falling back to the old, record-only DELETE operation.
- The web request has a 90-second timeout per linked post. Hosting execution
  limits still apply, especially for content linked to multiple publications.
- External deletion and the local database cannot form a single transaction.
  If local deletion fails after remote success, refresh and select local-only
  deletion after checking the provider. A missing provider record is not proof
  that its social publications were removed.
- When a later linked post fails after earlier posts were removed, inspect
  Outstand/the social networks before retrying or deleting only local content.
- Leaving the option unchecked preserves published and scheduled posts; the
  content list can still show them as Outstand-only entries.
- No configuration variables, dependencies or schema migrations are added.

## Offline regression checks

```bash
npm test -- --runInBand __tests__/content __tests__/app/content
npm run typecheck
```

These tests mock provider/database boundaries. They do not delete real posts or
verify deployed credentials/scopes. Live deletion requires an approved
disposable target and test posts; it is not part of routine validation.