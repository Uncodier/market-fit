# Content and Outstand deletion

The content editor's **Delete Content** modal deletes local content only by
default. On opening, it verifies the persisted content's explicit
`outstand_id_...` links and shows the current per-network deletion options.
Combined deletion is an unchecked opt-in, available only when all linked targets
are eligible. Similar titles/text and `published_...` tags never identify deletion
targets or prove publication status. All distinct linked post IDs are included,
not just the most recent or the latest 50 posts.

## Provider behavior

Verified against Outstand documentation on 2026-10-01:

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

### Contextual preview and recovery

Published Instagram and TikTok posts cannot be deleted through Outstand's API;
an HTTP 409 in this flow can be an unsupported operation rather than a transient
provider failure. The dialog explains the actual linked platforms before an
attempt. HTTP conflicts use a platform-neutral error because status, permissions
and support may change; raw provider errors are never exposed.

The preview distinguishes:

- **Published, supported:** remote deletion, subject to account permissions.
  The Threads scope warning appears only for a published Threads target.
- **Published Instagram/TikTok:** manual deletion in the named app; combined
  deletion is unavailable rather than offering a known-to-fail action.
- **Scheduled:** cancellation, including Instagram/TikTok. Pending schedules
  due within the API's 75-second safety window are treated as uncertain.
- **Unpublished or already remotely deleted:** Outstand record cleanup.
- **Unknown, inconsistent or unavailable:** no promise of remote deletion;
  local-only deletion remains available.

Only relevant networks are shown. Repeated outcomes are grouped with counts;
different states on the same network remain separate. Mixed eligible/manual
targets explain that combined deletion is unavailable and that supported posts
will not be automatically removed as a partial operation. This is not a new
per-platform deletion endpoint.

The option and confirmation labels distinguish remote publication deletion,
schedule cancellation and record-only cleanup. Local-only copy names the
affected networks and warns that scheduled posts can still publish; it does not
claim that unpublished or already-deleted posts will remain online.

To remove published Instagram/TikTok posts, delete them directly in those apps.
Then leave combined deletion unchecked and confirm **Delete local content**.
After a remote deletion failure,
**Switch to local-only deletion** unchecks the option and clears the previous
error but does not submit another deletion; a new confirmation is required.
Local-only deletion does not contact Outstand or remove its records, which may
still appear in the content list. Remove any unwanted provider records separately
in Outstand after checking the social networks.

The dialog refreshes its preview on each opening, ignores late results after
closing, and disables combined deletion while verifying or after a verification
failure. Preview eligibility is guidance, never authorization or proof of success.
Deletion rechecks current provider state and permissions. Do not silently fall
back to record-only deletion or mark a partial remote result as successful.

## Trust boundaries

`app/content/actions.ts#deleteContent` delegates to a server-only helper. It
validates the content ID/options, authenticates the user, loads the persisted
site/tags using a user-scoped Supabase client, and checks the site's `delete`
capability. No service-role fallback is used. Local deletion includes the
original `updated_at` to avoid erasing concurrent edits, and verifies that a row
was actually deleted.

`app/content/get-content-deletion-preview.ts` authenticates, loads persisted links
under RLS, and checks the site's delete capability before previewing. It uses the
user's verified session and read authorization for exact
`GET /api/integrations/outstand/posts/{id}?tenant_id={siteId}` requests. The API
independently verifies provider-account ownership. The web validates IDs and
tenant metadata, strips unrelated provider fields, bounds response sizes, and
reads at most five posts concurrently within a 30-second provider-read budget.
No provider or local mutations are performed during preview.

The deletion API is called only for an explicit opt-in:

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