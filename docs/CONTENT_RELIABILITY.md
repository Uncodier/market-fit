# Content loading and trend-provider availability

## Content detail

Content detail models load failures as recoverable UI state. Missing, mismatched,
or failed records never render the editor or performance panel. The error state
offers explicit retry and navigation back to Content; it does not automatically
replay mutations. Responses from an older content request cannot replace the
current record or its relations.

A transport failure while calling the Server Action can still reflect a network
or deployment issue. The recoverable state prevents the secondary `content.id`
crash; it does not prove the original dependency is healthy.

## Trends

The public service entry point remains `app/services/trends-service.ts`;
provider requests, normalization, caching and ranking live in
`app/services/trends/`. The browser adapts stored segment data to the existing
route contracts without weakening server validation:

- Google receives at most 5 non-empty segment names of at most 80 characters.
- Reddit receives at most 8 segments and 12 keywords of at most 80 characters.
- Both omit null descriptions and cap descriptions at 240 characters.
- Twitter receives only location and limit, not unused segment data.

Provider requests make a single bounded attempt. Identical in-flight requests
are shared; successful responses are cached for five minutes and failures have
a 30-second cooldown. Explicit refresh bypasses settled cache entries, not an
already running request. Normalized request payloads include description and
limit in their cache identity.

Aggregation reports failure when all requested providers fail. Partial success
keeps available results and exposes `platformErrors` for the unavailable sources.
The UI shows these errors inline rather than repeatedly emitting error toasts,
and hides old-context results after navigation or refresh failure. Provider
transformations do not invent posts or random engagement metrics.

Twitter's server-only `TWITTER_BEARER_TOKEN` is independent of connected social
publishing accounts. Missing configuration remains an explicit HTTP 503, not a
successful empty result. See [Environment variables](ENVIRONMENT_VARIABLES.md).

## Regression validation

```sh
npm test -- --runInBand __tests__/content/use-content-data.test.tsx __tests__/content/content-item-load-error.test.tsx __tests__/trends __tests__/trends-ui __tests__/api/provider-response-cache.test.ts
npm run typecheck
```

These local tests isolate provider and database dependencies. They do not prove
production credentials or connectivity. Instance deletion is a separate workflow;
see [Instance deletion](INSTANCE_DELETION.md) before retrying an unconfirmed
destructive request.