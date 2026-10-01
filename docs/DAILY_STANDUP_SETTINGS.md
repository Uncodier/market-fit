# Daily Standup settings

The AI Activities tab configures `settings.activities.daily_resume_and_stand_up`:

```json
{
  "status": "active",
  "weekdays": [1, 5],
  "start_time": "08:30",
  "report_sections": [
    "sales", "tasks", "requirements", "social", "channels",
    "records", "orders", "reservations", "inventory"
  ]
}
```

- `status` is `active` or `inactive`. Missing and legacy `default` statuses are
  inactive; legacy string statuses and status-only objects remain supported.
- `weekdays` uses integers from 0 (Sunday) through 6 (Saturday). A missing array
  defaults to `[1, 5]`, preserving the existing Monday/Friday workflow schedule.
  Selected days use the site's timezone, including days marked closed in business
  hours.
- `start_time` is optional, strict 24-hour `HH:mm` (`00:00`–`23:59`), interpreted
  in the site's business-hours timezone (America/Mexico_City when missing).
  Missing preserves the configured opening time, or 09:00 when unavailable.
  It is not defaulted into legacy settings by hydration or unrelated saves.
  Empty strings, null, non-strings, seconds and whitespace are invalid even while
  inactive; they are never silently coerced into a different schedule.
- `report_sections` accepts only the nine IDs above. A missing array defaults to
  all nine. The `social` ID is labeled **Social media** in the UI.
- Explicit empty arrays stay empty. An inactive activity may save them; enabling
  or saving an active activity requires at least one weekday and one section.
  Malformed selections are not silently replaced with defaults.

The form, delayed hydration, Activities saves, Save All, and site context share
the normalization and schema helpers in
[`daily-standup-settings.ts`](../app/components/settings/daily-standup-settings.ts).
Unknown activity fields, neighboring activities and unrelated persisted settings
are preserved. Object and legacy string status-only updates merge before defaults
so they do not reset saved selections. The existing user-scoped settings writer
merges the latest readable row and validates before writing; no new API or
service-role access is introduced.

The time input shows the schedule timezone. A blank untouched legacy setting
keeps its fallback. Once edited, a valid time is required. **Use 09:00** explicitly
saves a fixed 09:00 start, including for standup; it does **not** restore the dynamic
opening-time fallback. Clearing blocks saving rather than claiming to delete an
override: the existing partial-update merge preserves omitted parameters and has
no deletion contract. Unknown fields and other activity settings remain intact.

[Follow Up](OUTREACH_SETTINGS.md) supports the same optional `start_time` format
with a 09:00 legacy fallback. ICP has no fixed-time control: its daily runs are
distributed by site over 24 hours independently of business hours and weekends.

Scheduling and report generation are implemented by the Workflows and API
services. Frontend controls do not execute a standup or send notifications.

Focused regression and component tests (local doubles; no live RLS verification):

```bash
npm test -- --runInBand __tests__/components/settings/daily-standup-settings.test.ts __tests__/components/settings/daily-standup-fields.test.tsx __tests__/components/settings/daily-standup-persistence.test.ts
npm test -- --runInBand __tests__/components/settings/activity-start-time.test.ts __tests__/components/settings/activity-hydration-persistence.test.tsx
```