# Demo report data

HabitUall, SaaS B2B, and Ecommerce use local, linked sample records for all seven
dashboard reports. Their 20 sections do not require a real Supabase session.
Finance continues to read locally generated journal entries in demo mode.

## Coverage

| Report | Local sources |
| --- | --- |
| Performance | Tasks, conversations, approved content, completed requirements and segment links, commands and tool logs |
| Business overview | Sales, customers, campaigns, expenses, purchases, meetings and conversations |
| Analytics | Lead/campaign attribution, repeated customer purchases and dated engagement |
| Traffic | Visitors, sessions, pageview events, source tags, devices, browsers and geography |
| Sales | Sale orders/items, dated receipts, partial/unpaid balances, cancellations and refunds |
| Costs | Fixed/variable expenses, marketing/operating categories and purchases |
| Social | Published content, performance snapshots, account/network metrics and comment authors |

Sample dates are refreshed relative to today, including the preceding period.
Every selectable segment has relevant commercial and operational records.
Traffic and Social remain site-wide, matching their real report contracts.
Valid empty date ranges and unknown segments remain empty rather than showing
unrelated sample totals. Currency selections never convert or combine amounts.

## Implementation boundaries

- `lib/demo-data/index.ts` finalizes the selected registered demo. Small seed
  modules add records without modifying the imported base fixtures, and replace
  their own generated IDs when reapplied rather than duplicating records.
- Report hooks select local adapters only for an exact registered demo ID.
  Adapters reuse existing aggregation functions and derive results from records;
  they do not intercept HTTP responses or replace real backend behavior.
- Real sites retain their authenticated APIs and Server Actions. Demo IDs and
  demo cookies never authorize access to those APIs. Unknown demo IDs cannot
  select another account's fixtures.
- Browser resource keys include site/filter/identity scope. Switching into a
  signed-out real workspace clears the previous demo figures.
- No remote database rows, provider synchronization, payments, migrations or
  service-role access are needed to populate these reports.

## Validation

Run focused Jest fixtures and hook regressions:

```bash
npm test -- --runInBand __tests__/lib/demo-data __tests__/hooks/use-demo-overview.test.tsx __tests__/hooks/use-demo-performance.test.tsx __tests__/hooks/use-demo-financial-reports.test.tsx
```

Analytics, Traffic and Social hook checks are in
`__tests__/hooks/use-demo-analytics.test.tsx`,
`__tests__/hooks/use-demo-traffic.test.tsx` and
`__tests__/hooks/use-demo-social-report.test.tsx`.
`__tests__/lib/demo-data/all-report-sections.test.ts` covers all 60 combinations
of registered demos and sections. `__tests__/dashboard/demo-report-export.test.tsx`
checks anonymous demo CSV readiness and the actual toolbar action.

The full report regression directory is `__tests__/dashboard`. Demo suites verify
populated current/prior periods, linked records, filters, empty ranges and
isolation from real requests. Browser validation must use an explicitly selected
local demo; it is not authenticated production QA.