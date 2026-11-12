# Automatic cloud file viewing in Robots

The Robots workspace recognizes cloud revision URLs in `requirement_status`
(`preview_url`, `source_code`, and `repo_url`) and successful `write_cloud_file`
receipts in the chat's existing SWR activity cache. No requirement is needed for
activity-based viewing. No additional fetcher, polling, realtime channel, or
database artifact write is introduced.

Receipts must match the active site and instance, file identity, and immutable
version. Only known result envelopes are inspected; arguments, prose, and document
content are not searched for URLs. Failed/conflicting results are ignored. Replays
are deduplicated by file, retaining the highest version. Pending Git evidence does
not hide an otherwise saved file.

Existing requirement previews retain precedence. Cloud files supply source/fallback
content and open in the existing ZIP viewer. Strict private text URLs are converted
to the ZIP URL for the same revision, using the authenticated same-origin proxy,
not the public asset proxy. Download permissions remain enforced by the API.
Cloud-only content displays a single Files tab and does not initiate tenant lookup;
it is not evidence of an application repository or database. The private proxy uses
`API_SERVER_URL`, falling back to `NEXT_PUBLIC_API_SERVER_URL`, with the same origin
and protocol validation applied to either value.

HTML/HTM and Markdown (`.md`, `.markdown`, case-insensitive) files open with an internal Preview / Source switch in the existing
archive viewer.
The shared tabbar is centered across the viewer. The file explorer can be toggled
and defaults to hidden for a single file, visible for multiple files; explicit
visibility choices persist for the current revision. HTML and Markdown default to Preview.
Markdown renders headings, lists, GFM tables, task lists and fenced code using the
existing React Markdown renderer. Raw HTML is skipped, images display their alt text
without fetching remote assets, and links open separately without an opener or referrer.
Markdown respects the viewer theme and previews unsent source edits.
Preview reuses downloaded content, including unsent source edits, without fetching
again. HTML uses a sandboxed iframe with an opaque origin: inline scripts and styles
are allowed for animations, but external scripts, forms, embeds and API requests
are blocked. Only inline data/blob media and data fonts may load; remote and relative
archive assets are not bundled. Source editing
and agent submission remain available. This is not a deployed application preview.

Activity discovery covers logs currently loaded by the chat (including loaded
history); it does not query older unloaded receipts. This change adds neither a
Vercel deployment flow nor an executable application runtime.

Validation: cloud deliverable extraction/cache tests, workspace lifecycle,
cloud presentation, revision viewer/reset, and authenticated proxy regressions.
To exercise the real ESM Markdown renderer in Jest on Node 24.9 or newer:

```bash
NODE_OPTIONS=--experimental-vm-modules npm test -- --runInBand __tests__/components/archive-markdown-preview.test.tsx __tests__/components/archive-html-preview.test.tsx __tests__/components/archive-viewer-revision-reset.test.tsx __tests__/components/archive-contents-regressions.test.tsx
```