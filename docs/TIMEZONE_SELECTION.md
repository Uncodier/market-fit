# Time zone selection

`app/components/ui/timezone-field.tsx` is shared by reservation/task dialogs,
visit registration, and personal/round-robin public booking pages under `/book`.
It searches IANA identifiers, city names, country names in the display language
plus English/Spanish, country codes, and available geographic descriptions.
Search ignores accents and case. Countries with multiple zones remain multiple
choices; choosing a country never guesses a single offset.

`lib/calendar/timezone-regions.ts` contains public-domain IANA `zone.tab`
geographic descriptions, snapshotted from macOS on 2026-10-29. Maintain this
checked-in selection metadata when tzdb geographic descriptions change. It is
not a complete administrative-region database and does not define territorial
boundaries. Runtime `Intl` validates available zones and resolves aliases;
`date-fns-tz` uses the event date's actual offset, not a hardcoded GMT label.
No network geocoding service or extra dependency is required.

Public booking rejects invalid URL timezone values and clears selected wall
times when the visitor changes zones. Old availability responses are ignored.
Existing reservation slots retain their UTC instant when changing display zone.
Tasks save their selected zone in existing metadata.

Visits are immediate registrations, not scheduled bookings. Their start remains
the server's registration timestamp. The visits selector changes display only,
including the returned start/end timestamps and attestation timestamps. It does
not store a timezone preference on the reservation or allow backdating a visit.

Offline regression checks:

```bash
npm test -- --runInBand __tests__/visits __tests__/booking __tests__/reservations/timezone-ui.test.tsx __tests__/reservations/dialog-timezone.test.ts
npm run typecheck
```

These tests do not prove a live authenticated booking or registration.