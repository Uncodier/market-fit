# Post-repair Jest failure inventory — 2026-11-14

Full initial run: 1,730 suites; 1,677 passed, 53 failed. Tests: 21,012 passed, 98 failed, 5 skipped.

All 53 initially failed suites were reexecuted after repairs: **6 passed, 47 failed; 325 tests passed, 77 failed** (402 total). This is a focused rerun, not a full green application run. Existing test assertions were preserved. Source paths below identify unresolved cases without raw logs or credentials.

## Repaired initial suites

- `__tests__/deals/page-loading.test.tsx`
- `__tests__/procurement/demo-suppliers-policy.test.tsx`
- `__tests__/procurement/portal-localization.test.tsx`
- `__tests__/procurement/partners-localization.test.tsx`
- `__tests__/procurement/procurement-portal-demo-ui.test.tsx`
- `__tests__/components/billing/billing-page-read.test.tsx`

## Remaining failures

- `__tests__/context/workspace-locales-contract.test.ts` — 3 failed cases
- `__tests__/procurement/home-demo-sections.test.tsx` — 1 failed cases
- `__tests__/procurement/tender-submission-sheet.test.tsx` — 4 failed cases
- `__tests__/dashboard/report-navigation.test.tsx` — 1 failed cases
- `__tests__/procurement/empty-states.test.tsx` — 1 failed cases
- `__tests__/components/settings/SupportChannelsSection.test.tsx` — 1 failed cases
- `__tests__/procurement/profile-credentials-ui.test.tsx` — 2 failed cases
- `__tests__/procurement/orders-list-layout.test.tsx` — 1 failed cases
- `__tests__/catalog/list-page.test.tsx` — 4 failed cases
- `__tests__/components/ui/sticky-header-selects.test.tsx` — 4 failed cases
- `__tests__/procurement/supplier-info-tabs.test.tsx` — 1 failed cases
- `__tests__/procurement/inbox-ui.test.tsx` — 1 failed cases
- `__tests__/navigation/sidebar-mobile-viewport.test.tsx` — 2 failed cases
- `__tests__/procurement/workspace-order-detail.test.tsx` — 1 failed cases
- `__tests__/localization/public-pages.test.tsx` — 1 failed cases
- `__tests__/procurement/loading-headers.test.tsx` — 12 failed cases
- `__tests__/dashboard/report-loading-shapes.test.tsx` — 1 failed cases
- `__tests__/components/settings/trial-connection-admission.test.tsx` — 4 failed cases
- `__tests__/procurement/tender-marketplace-design.test.tsx` — 1 failed cases
- `__tests__/leads/search-loading.test.tsx` — 1 failed cases
- `__tests__/control-center/mobile-header.test.tsx` — 1 failed cases
- `__tests__/procurement/shared-ui.test.tsx` — 1 failed cases
- `__tests__/procurement/rule-skeletons.test.tsx` — 1 failed cases
- `__tests__/documents/send-document-email.test.ts` — 1 failed cases
- `__tests__/procurement/demo-order-detail.test.tsx` — 2 failed cases
- `__tests__/components/site-setup-navigation.test.tsx` — 4 failed cases
- `__tests__/procurement/home-demo-details.test.tsx` — 1 failed cases
- `__tests__/quotations/send-quotation-email.test.ts` — 1 failed cases
- `__tests__/components/create-site-billing.test.tsx` — 5 failed cases
- `__tests__/documents/public-document-data-exposure.test.ts` — 1 failed cases
- `__tests__/lib/navigation/breadcrumb-engine.test.ts` — 2 failed cases
- `__tests__/components/ui/records-page-header.test.tsx` — 1 failed cases
- `__tests__/records/page-header.test.tsx` — 1 failed cases
- `__tests__/documents/document-meta.test.ts` — 1 failed cases
- `__tests__/app/api/costs/cost-security.test.ts` — 1 failed cases
- `__tests__/components/navigation/mobile-navigation-overlay.test.ts` — 1 failed cases
- `__tests__/licensing/procurement-license.test.ts` — 1 failed cases
- `__tests__/api/icp-mining-lists.test.ts` — 1 failed cases
- `__tests__/security/allowed-domain-provenance-contract.test.ts` — 1 failed cases
- `__tests__/marketplace/order-list-freshness.test.ts` — 1 failed cases
- `__tests__/components/conversation-background.test.ts` — 1 failed cases
- `__tests__/components/archive-markdown-preview.test.tsx` — 0 failed cases (suite setup/import failure)
- `__tests__/lib/commerce-og.test.tsx` — 0 failed cases (suite setup/import failure)
- `__tests__/components/archive-viewer-revision-reset.test.tsx` — 0 failed cases (suite setup/import failure)
- `__tests__/components/archive-html-preview.test.tsx` — 0 failed cases (suite setup/import failure)
- `__tests__/components/commerce/promo-bundle-public-image-ssr.test.tsx` — 0 failed cases (suite setup/import failure)
- `__tests__/components/commerce/public-image-ssr.test.tsx` — 0 failed cases (suite setup/import failure)

## Interpretation

Reviewed obsolete/conflicting expectations and setup issues are described in [the QA report](../../docs/QA_DISPOSABLE_2026-11-14.md). Other failures are unresolved and must not be presumed test defects. Live backend reproduction, security failures and provider fixtures remain acceptance gates; no production readiness claim is made.
