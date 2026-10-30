# POS customer search

Both the cart customer selector and the receipt customer dialog use
`usePosCustomerSearch`. Typing a nonempty query searches Supabase through the
`searchPosCustomers` Server Action after a 300 ms debounce. Search covers name,
email, personal email, phone and the company JSON name, returning up to 30 leads.

Each request validates input, authenticates and authorizes POS site access, then
reads with the user-scoped client and RLS. No external orchestration API, new
environment variable, service-role client or migration is required.

The catalog snapshot intentionally does not download all leads. Customer search
merges matching existing local leads with server results by ID. Offline or
unverified POS access never starts remote search; local matches remain usable.
Search results are transient and do not replace the IndexedDB customer cache.
Late responses after a query/site change or access revocation are ignored.
Failures and ten-second timeouts are visible rather than shown as an empty
successful search. Changing the query retries the search.

Regression checks:

```bash
npm test -- --runInBand __tests__/pos/search-customers.test.ts __tests__/pos/customer-search-ui.test.tsx
```