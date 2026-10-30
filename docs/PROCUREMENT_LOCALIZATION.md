# Procurement localization

## Scope

The added procurement modules use the application's existing five languages:
English, Spanish, French, German and Japanese. The work covers:

- Settings, rules, approval stages, requirements and policy simulation.
- Suppliers, contacts, private relationships, activity and representation.
- Requisitions, immutable revisions and approval revalidation.
- Tenders, publications, invitations and the unified approvals inbox.
- Quotations, orders and non-stock acceptance forms.
- Stock replenishment rules, persisted cases and worker status.
- Catalog procurement capability and dated supplier sourcing offers.
- Public tender discovery/detail and the unified account portal.
- Personal credential uploads/revisions and selected submission evidence.
- Page navigation, skeleton descriptions, dialog dismissal, filters, empty/error
  states, accessible labels and shared date/select controls used by these modules.

## Catalog and presentation

`app/context/locales/procurement/index.ts` explicitly registers each bounded
dictionary in `app/context/locales/procurement/` for all five languages. The
shared catalog includes those entries after legacy/screen/commerce overlays.
Raw language parity tests never count English fallback as translated coverage.
The final feature catalog contains 1,325 own-language entries per locale across
35 bounded JSON files, with identical keys and interpolation contracts.
Small date-picker overlays in `app/context/locales/screens/procurement-shared-*`
cover nested controls without changing their date-selection logic.

`useProcurementI18n` uses the existing `LocalizationContext` and formats numeric
and date display with `Intl`. Procurement workflow amounts retain the current
server minor-unit contract; policy thresholds retain currency-specific precision.
Changing display language never repeats fetches, approval decisions, uploads or
submission operations and never resets an entered draft.

Combined date/time styles are formatted separately and joined with an explicit
comma by `i18n/format-date.ts`. This avoids the runtime-dependent connector
(comma versus "at") that Node and browser ICU versions can otherwise produce
during hydration. Public tender deadlines and opening times retain their explicit
UTC zone; date-only and field-based options retain their existing Intl behavior.
`__tests__/procurement/date-hydration.test.tsx` hydrates real tender cards across
all five languages while simulating the reported server/browser connector difference.

Stored API/SQL diagnostics remain canonical English protocol strings. Known
application diagnostics and structured schema/domain findings are localized at
render time. Unknown external diagnostics use a localized safe generic message;
the frontend does not automatically translate arbitrary provider messages.
No SQL migration or database-language setting is required.

The public server still owns publication fetching and authorization. Client views
receive only the same already-public DTO for reactive localized presentation.
The footer reuses the existing commerce language selector.

## Preserved content and boundaries

- Supplier names, authored descriptions, terms, notes, decision reasons, titles,
  file names, slugs and business identifiers are never rewritten or translated.
- Canonical statuses, query values, currencies, prices, policy data, tax snapshots,
  access grants and submission identities are unchanged.
- New default rule/stage names follow the current locale when created; subsequent
  language changes preserve them like any other authored name.
- Brands, symbols, IANA time zones, MIME types and binary units retain their
  technical meaning.
- Source comments, documentation and license text remain English. This work does
  not create translated legal terms or certify language-specific contracts.
- This covers the newly added modules, not every legacy widget throughout the
  repository. French, German and Japanese fallback debt outside this scope is
  still reported by the global localization audit.

## Validation

```bash
node scripts/i18n/audit.cjs --check
npm test -- --runInBand __tests__/procurement __tests__/licensing \
  __tests__/context/workspace-locales-contract.test.ts \
  __tests__/context/commerce-locales-contract.test.ts
npm run typecheck
```

Focused localization suites cover raw key/parameter parity and live five-language
switches in policies, requests, tenders, replenishment, suppliers, approvals,
receipts, public detail/discovery, credentials, submissions and catalog sourcing.
They assert unchanged user-entered values, payloads and request counts. Static
audits retain only reviewed technical/brand exceptions in the scoped UI.

Final validation on 2026-10-28: 604 tests passed across 60 combined procurement,
licensing and locale-contract suites, including actual local PostgreSQL/PostgREST
cases. Additional buyer/quotation/navigation regression passed 313 of 314 tests;
the unchanged quotation-email locale expectation remains the only failure. Module
lint and `git diff --check` passed; shared legacy files retain their pre-existing
lint findings. Global typecheck still reports the existing
`manual-reservation-contract.test.ts:96` TS2454, with no new type errors.
The global audit has no missing English/Spanish keys and no missing procurement
keys in any of the five languages. Its French/German/Japanese omissions outside
this scope remain reported, not hidden by fallback.

No production build, deployment, environment-file read, remote migration or
authenticated visual journey was performed for this localization change. Live
visual acceptance remains separate from these isolated tests.