# Tender quotation review

`/purchases/quotes/[id]` is the buyer workspace's formal procurement quotation
detail. Both received-quotation rows inside a tender and the workspace quotation
list navigate here instead of opening a compact modal. Sales quotations and the
personal buyer portal retain their existing document screens.

## Review layout

The layout follows the deal detail pattern: sticky tabs and read-only award
status, supplier identity, a main review area and a persistent details sidebar.

- **Overview / Products:** recorded line names, quantities, unit net prices,
  line net amounts, taxes and totals. Unknown tax remains pending; it is not
  represented as zero or a confirmed gross total.
- **Certificates & proposal:** the exact shared revisions, holder, issuer,
  reference, scope, issue/expiry dates, non-expiring declaration and file
  metadata. Downloads use the existing authorized credential-file endpoint.
  Document presence and dates are not verification or acceptance decisions.
- **Details sidebar:** supplier identity, status, all contacts (primary first),
  commercial terms and a link to the full supplier profile, without a separate
  Supplier tab. Current workspace supplier information is shown only when
  the caller has supplier read permission. This is explicitly not a historical
  snapshot submitted with the quotation. Private notes are not included.
- **Approvals:** the existing whole-tender award flow, followed by the order
  approval flow for an awarded quotation. No new payment or sales actions.

Loading, denied access, missing/sealed quotations and transient failures are
distinct. User, workspace and quotation IDs scope the data cache; changing scope
does not render the previous quotation. The demo is explicitly fictional and
does not fetch private data, download credentials or submit decisions.

## Backend and rollout prerequisite

`GET /api/procurement/commerce/quotes/[id]?site_id=...` validates the quotation ID,
authenticates and authorizes procurement access using the user-scoped client.
It calls `get_procurement_quotation(p_site, p_quotation)` and enriches only the
authorized supplier relationship under supplier SELECT permissions and RLS.

The forward-only migration
`supabase/migrations/20261030220000_procurement_quotation_detail.sql` **must be
installed before enabling live detail reads**. It preserves the list RPC's
immutable publication-opening rules while reading a single quotation, including
records older than the newest-100 list window. Missing, foreign and sealed rows
return no detail. Anonymous and service-role execution are revoked. There is no
fallback to raw procurement tables or the capped list when this RPC is missing.

Migration application requires explicit approval and target-schema verification
under `docs/DATABASE_MIGRATIONS.md`; adding this file does not apply it remotely.

## Validation

```bash
npm test -- --runInBand __tests__/procurement/quotation-detail-ui.test.tsx __tests__/procurement/quotation-detail-api.test.ts __tests__/procurement/quotation-detail-postgres.test.ts __tests__/procurement/quotation-evidence-detail.test.tsx __tests__/procurement/received-quotations.test.tsx
```

The PostgreSQL suite runs only in a new disposable socket-only cluster and never
uses configured database URLs. It covers opening gates, tenant/role restrictions,
DTO parity and an older quotation beyond the list window. Browser demo entry:
`http://localhost:3000/demo?client=demo-saas-en-123&lang=en&page=/purchases/quotes/demo-quote-northstar`.