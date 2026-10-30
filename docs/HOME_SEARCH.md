# Unified account search

On `/home`, the existing desktop/mobile account-header search enters `/home/search?q=...`.
The URL supports direct links and browser history. Search mode replaces the Home
cards with the shared document table, collection selector, pagination, loading and
empty states. Clearing the term shows the search prompt; the Home link exits search.

The index combines personal purchases, quotations, subscriptions, active library
entitlements, reservations, accessible businesses, credentials, supplier submissions,
saved drafts, participation opportunities, Marketplace products and public tenders.
Search matches all words case-insensitively against displayed names, details and
statuses. Results link to existing record experiences or collection screens where
no individual account detail route exists.

Private reads reuse authorized account actions and procurement endpoints. Reservation
search verifies the user server-side and scopes a user-session/RLS query by that
identity. Public products reuse the Marketplace endpoint and its catalog search
window; tenders reuse the public publication loader. No new service-role access,
database migrations or remote writes are introduced. Demo mode uses existing local
presentation fixtures and never queries real account data.

Paginated account collections and tenders are read through all available pages,
with a 100-page safety ceiling. Existing non-paginated endpoint limits still apply
(for example, credentials currently return at most 50 records). This is not a new
database-wide full-text index. Failed collections, later-page failures and truncated
Marketplace candidate windows are reported explicitly instead of being shown as
complete empty collections; other successful sources remain searchable. Requests
are debounced by 350 ms and cached by signed-in account and query.

Offline regression coverage: `__tests__/procurement/home-global-search.test.tsx`
and `__tests__/procurement/home-search-actions.test.ts`. Authenticated browser and
remote-data acceptance require an explicitly configured test target.