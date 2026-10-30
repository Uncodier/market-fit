# Localization coverage and repair

## Catalog organization

`app/context/locale-catalog.ts` remains the shared workspace and document catalog.
It combines:

- Legacy dictionaries in `app/context/locales/<locale>.json`.
- Spanish workspace overlays in `app/context/locales/workspace/es/`, registered
  explicitly in `app/context/locales/workspace/es.ts`.
- Screen overlays in `app/context/locales/screens/`, registered explicitly in
  that directory's `index.ts`.
- Commerce overlays in `app/context/locales/commerce/`, which retain precedence.
- Procurement overlays in `app/context/locales/procurement/`, registered for all
  five languages after the existing catalogs. See
  [Procurement localization](PROCUREMENT_LOCALIZATION.md) for module scope and
  validation that does not count English fallback.

`rawLocaleMessages` exposes each language's own entries, without fallback.
`localeMessages` retains the existing English fallback for incomplete languages.
Do not use the merged catalog as evidence that a language is fully translated.
New overlays must be registered, not merely placed on disk.

This repair adds 3,268 Spanish workspace entries and translates page-owned copy
for account/profile settings, project selection/creation, partner licenses,
authentication/recovery/invitations, integrations/security, control-center
wrappers, receivables, subscription details, visits, application/detail loading
states, credit checkout, booking wrappers, research, payout administration,
invoice/quote wrappers, demo controls, OAuth feedback, and error/not-found states.
It also supplies the 14 previously undefined keys in all five languages and
the newly introduced marketplace-booking labels in all five languages.

Localization must not change canonical status codes, route/query parameters,
prices, currencies, payment state, tenant IDs, bank data, user content, or
external-service configuration values. CSV import headers remain canonical.
Translation changes update presentation without repeating OTP verification,
invitation acceptance, checkout, or data-loading operations.

## Reproducible audit

Run from the repository root:

```bash
node scripts/i18n/audit.cjs --check
node scripts/i18n/audit.cjs --json > /tmp/market-fit-localization-audit.json
npm test -- --runInBand __tests__/context/workspace-locales-contract.test.ts __tests__/context/commerce-locales-contract.test.ts
```

The audit checks literal translation calls, known dynamic key families against
the English catalog, and existing dictionary keys referenced indirectly in
maps. It excludes API routes and tests. `--check` fails for missing English or
Spanish entries. All five languages are reported.

At this repair's verification point, 5,185 referenced keys have **zero missing
English or Spanish entries**. French, German, and Japanese each still lack
4,306 referenced own-language entries. Their existing English fallback remains.
Those counts describe dictionary coverage, not complete UI translation.

The JSON report also lists direct JSX text and selected accessible/display
attributes with filenames and line numbers. These are candidates for manual
review, not confirmed bugs: brand names, symbols, examples and technical values
may legitimately remain unchanged. Arbitrary computed keys, user content,
runtime provider errors, object-based text definitions and all possible
template values cannot be exhaustively inferred by this static audit.

## Remaining hardcoded UI

This is not a complete translation of every legacy component. The inventory
still contains hardcoded text candidates in 41 page files and numerous child
components. High-priority page families include:

- `app/agents/page.tsx` and `app/agents/[id]/page.tsx`.
- `app/people/page.tsx`.
- `app/companies/[id]/page.tsx` and `app/experiments/page.tsx`.
- `app/teleprompter/[id]/page.tsx` and `app/segments/[id]/page.tsx`.
- `app/payments/page.tsx`, inventory and price-list details.
- Sales/shipment screens and shared booking experiences.

Many page wrappers now use the catalog while their legacy child widgets still
contain hardcoded labels. Security/integration children, subscription status and
invoice/payment panels, campaign/deal widgets, application explorers, shared
onboarding widgets and chat child components require further review.

Large files in these areas need responsibility-based extraction before being
touched, as required by repository guidance. Do not apply a blanket replacement
to prompts, tool identifiers, runtime data, or provider payloads, and do not
introduce automatic DOM translation as a substitute for explicit keys.

## Regression coverage

The workspace contract checks runtime registration, nonempty Spanish values,
overlay key parity, interpolation parameters, and raw English/Spanish source
coverage. The commerce contract checks all five languages without fallback.
Focused UI tests cover locale switching and unchanged network/payment/auth
behavior in account settings, invitations/recovery, integrations, receivables,
checkout, research, payout administration and public pages.

Tests live under `__tests__/` and are selected by the normal `npm test` command.
The optional isolated public regression configuration is:

```bash
npm test -- --config __tests__/localization/jest.public-offline.config.cjs --runInBand
```

Error boundaries use a small provider-independent dictionary reader because
the normal localization provider may itself have failed. English and Spanish
system copy is available; the other system languages retain readable English.

No deployment, remote migration, production build, or authenticated browser
journey is part of this repair. Existing lint debt in demo browser mutations and
the calendar-preferences state effect is not hidden or disabled by this change.