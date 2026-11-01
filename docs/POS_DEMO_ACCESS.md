# POS demo access

The POS page uses the same strict identity, role and location-restriction checks
for real sites and isolated demo fixtures. A `demo-*` prefix is not an access
grant, and unknown or foreign sites cannot unlock the private POS cache.

The lazy demo client supports PostgREST-style `.rpc(...).abortSignal(signal)`.
Cancellation rejects pending reads and prevents an RPC from executing after its
fixture load is cancelled. The fixture implementation returns explicit boolean
values for both location-restriction predicates, using the selected demo's actor,
membership and restrictions. Owner/admin exemptions do not authorize foreign
sites or archived fixtures.

This fixes demo access in both local and deployed applications. Real Supabase
RPCs, RLS, server authorization, cache ownership and replay admission are unchanged.
No database migration is required for the demo fix.

If a real site still shows a permission-verification failure, inspect the three
RPC responses and confirm the approved location-enforcement migrations and grants
are present in the affected environment. Missing RPCs or `null` responses are not
evidence of unrestricted access. Global location restrictions can also deny POS
even if the actor owns the currently selected site. Never bypass these checks or
use a service-role fallback to hide an error.

Focused offline regression checks:

```bash
npm test -- --runInBand __tests__/pos/demo-location-access.test.tsx __tests__/pos/permission-rpc-sdk.test.ts __tests__/lib/demo-data/location-restrictions.test.ts __tests__/pos/use-pos-location-access.test.tsx
```

The demo integration tests use the actual lazy fixture adapter with the access
hook; storage calls are mocked. The SDK contract test uses an injected transport
and makes no external requests. These tests do not prove a production deployment
or live browser checkout succeeded.