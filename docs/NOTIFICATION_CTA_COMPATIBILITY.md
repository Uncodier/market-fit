# Notification CTA compatibility

Notifications use the existing `message`, `related_entity_type`,
`related_entity_id`, and optional `action_url` fields. No migration or separate
details field is needed. `message` is the complete details source; the UI does
not infer names, status, summaries, or other details from identifiers.

## Supported entity routes

`lib/notifications/related-entity-route.ts` is the shared frontend route helper.

| Entity type | Target | CTA |
| --- | --- | --- |
| `conversation` | `/chat?conversationId=ID` | Go to chat |
| `task` | `/control-center/ID` | Go to task |
| `instance` | `/robots?instance=ID` | Go to instance |
| `lead` | `/leads/ID` | Go to lead |
| `site` | `/projects` | Go to projects |
| `campaign` | `/campaigns/ID` | Go to campaign |
| `content` | `/content/ID` | Go to content |
| `requirement` | `/requirements/ID` | Go to requirement |
| `segment` | `/segments/ID` | Go to segment |

Paths and query values are encoded. Chat resolves the actual conversation agent;
the notification link no longer inserts an unrelated hardcoded agent ID.
Sites have no `/sites/ID` detail page. The project picker requires an explicit
workspace choice; a CTA does not silently switch the active site.

A safe existing `action_url` takes precedence, allowing aggregate notifications
to open `/campaigns`, `/content`, `/leads`, or `/dashboard`, and billing notices
to open `/billing`. It uses "Go to details" unless it matches the entity target.
Only same-app absolute paths are accepted; external, protocol-relative,
backslash, control-character, and malformed paths are rejected. Legacy
`/sites/**` action paths are ignored because that route does not exist.
An unknown entity or missing ID has no CTA unless a safe action URL is present.
This allowlist does not invent routes for new entity types: add a verified route
and regression case when an emitter introduces another type.

## Reading behavior and emitter audit

`app/notifications/components/NotificationCard.tsx` preserves the 240-character
preview and accessible "Read more" / "Show less" controls. Expanding details
does not mark a notification read or navigate. Only explicit related-item
navigation marks unread notifications read. Read/delete pending states and
disabled actions are preserved. Full messages remain plain text, with line
breaks preserved; identifiers are not displayed as fabricated details.

The frontend's notification creation wrapper and POST route already preserve
`message` and related-entity fields. The frontend domain emitters in
`app/control-center/[id]/components/useTimeline.ts` send public comments,
resends, and reminders through the external API with the full comment text,
`task_id`, `lead_id`, and `site_id`. No missing details/CTA payload correction was
needed there. Their downstream notification generation is owned by the API
repository, not this frontend change.

## Offline verification

```bash
npm test -- --runInBand __tests__/app/notifications __tests__/lib/notifications
npx eslint app/notifications/components/NotificationCard.tsx lib/notifications/related-entity-route.ts __tests__/app/notifications/notification-ui.test.tsx __tests__/lib/notifications/related-entity-route.test.ts
```

The route tests check all nine mappings against actual page files, identifier
encoding, missing/unknown entities, safe URL precedence, and unsafe/legacy URL
fallback. UI tests cover every CTA, message expansion, read-state behavior,
unsupported targets, and disabled navigation. The existing provider lifecycle,
read cancellation, and notification preference tests remain included. These
are offline Jest checks, not live browser or deployment verification.