# Imprenta responsiveness

## Scope

The canvas keeps its existing card editors, drag gestures and persisted graph
format. Large graphs use retained previews and one active editor. These changes do not replace
the backend, change RLS, or establish measured production latency improvements.

## Large visual canvases

- Clicking an overview node without dragging focuses its center at a readable
  zoom. A real drag still saves its position; focusing does not write node data.
- The paint layer is pointer-transparent. A scoped viewport listener hit-tests
  overview nodes without intercepting actual DOM cards, inputs or relation UI.
- Marker queries include their minimum on-screen footprint, not just the smaller
  world-space rectangle. Fallback shells remain visible until full cards mount.
  Drag/connection origins mount outside the progressive batch budget; only
  actually mounted cards are excluded from canvas drawing.
- Fit and focus publish the same transform to the DOM and viewport store. The
  shared zoom component is split by state, fit, mouse, touch and background.
- Large canvases wait for viewport dimensions before mounting full cards. Context
  labels are hidden in overview (the selected relation editor remains available).
- Sparse-grid queries iterate occupied cells when a low-zoom viewport would scan
  more empty cells. This bounds query work at very distant zooms.
- Imprenta visual-only graphs do not read instance history on entry or recovery.
  Audience/publish data retains its log-loading path, including newly added
  nodes. Explicit publish admission still requires a complete fresh read.
- Repeated unchanged running snapshots preserve node/relation object identities
  and back off from 15 seconds to at most 120 seconds. Realtime activity resets
  fast recovery; visibility and manual refresh remain available. Old `running`
  statuses are not changed or assumed completed by this policy.

Local Chromium microbenchmark, 166 synthetic nodes spread over roughly
23,000 by 10,000 world units, 60 visibility queries: approximately 32 to 8 ms at
5% zoom and 790 to 8 ms at 1% zoom. This measures only the actual grid helper in
an isolated browser, not application FPS or authenticated production latency.
Offline Chromium/WebKit tests also exercise native pointer routing. A local
React/Chromium before-and-after focus harness used the actual zoom and drag
components: the old no-drag click remained at 0.05113 scale; the new click reached
0.7, centered the same node and kept store/DOM transforms equal, without backend
requests. This is isolated interaction evidence, not production performance.
The saved production session redirected to the project selector, so live canvas interaction
remains unverified; read-only database aggregates informed the synthetic scale.
No production node status, relation or position was modified during diagnosis.

## Rendering

### Retained cards and bounded work

The node canvas caches complete card rasters, not just source thumbnails. A
32 MiB byte-bounded LRU stores half-octave zoom/DPR buckets; each raster has axis
and area limits. Position-only movement reuses the bitmap. Content, theme, size,
LOD or decoded media changes invalidate the corresponding card version.
Deletion, eviction and unmount release canvas backing stores. This is a sprite
budget, not a limit for all browser/thumbnail/GPU memory.

Cold raster preparation receives a 3.5 ms soft budget per frame. During a gesture,
the renderer reuses the nearest cached resolution or a cheap placeholder; it
refines after settling. Hover-only viewport notifications do not repaint nodes.
Thumbnail completion invalidates only dependent sprites and repaints only when
that URL is visible; duplicate blob-ready events do not repeat pixel work.
Selection composites cached sprites plus a ring rather than rebuilding cards.

The integrated renderer was compared with the immediate painter in isolated
Chromium/WebKit using 166 synthetic cards. At rich detail, drawing calls dropped
from about 26,643 per frame to 166; 90 warm pan frames did not create another
raster. In that WebKit run at 20% zoom, submission p95 was about 9 ms before and
1 ms after. These numbers exclude application/network/compositor overhead and
do not establish production FPS.

### Context scene and active editor

Context relations render on viewport-sized static and highlight canvases, not a
world-sized SVG. Geometry/Path2D is retained across camera changes; hover and
selection repaint only the highlight layer. Cubic bounds include crossing edges
whose endpoint nodes are both offscreen. Native hit tests use CSS-pixel tolerance,
defer to DOM/node controls, and reject pan/drag gestures. Selected relation controls
remain available for crossing edges and preserve the existing result-lock policy.
Very long projected curves are subdivided and clipped before native dash drawing,
bounding work for offscreen dashes that stalled the WebKit test. Offline Chromium/WebKit component tests
cover a two-million-world-unit crossing from 0.001 to 8x zoom.

For graphs with at least 100 nodes, only the active editor and required drag or
connection-origin cards mount as HTML. Previews remain on canvas even at editing
zoom. The active editor is pinned when panning/zooming so it does not lose input
on culling. Clicking a preview opens it; Find node supplies a searchable keyboard
path. Closing restores focus to the picker. Connecting to a publish preview opens
its specific input anchors rather than guessing a destination slot.

Prompt drafts are retained in memory for the current instance, committed on blur
before editor replacement, and kept for retry after failure. A late successful
save cannot clear a newer draft. These drafts are not offline persistence and do
not survive reloads or instance changes. Existing execution save barriers remain.

- Card data is indexed by parent and incoming context. A card receives its ancestor
  chain, incoming relations and child-presence flag rather than the whole graph.
  Unchanged dependency arrays preserve their references across unrelated edits.
- Audience cards retain the existing instance-log fallback. Other cards do not
  scan audience tool payloads or rerender when unrelated logs arrive.
- Stable action dispatchers call the latest committed handlers. Render-time
  parent information comes from card props, not an imperative action ref.
- Content/status-only changes keep the positions object unchanged. Server position
  updates, node additions/removals, measured heights and drag protection still
  participate in layout. Parent lookups use an index.
- Media render callbacks and node measurement callbacks have stable identities.
- Height snapshots invalidate both viewport cells and context-edge geometry even
  when node positions retain their identity. Target-type changes also update
  publish anchors without requiring a move.

## Navigation and data

- The Robots controller uses the `canvas` read profile for node/workflow counts.
  It does not also fetch messages, requirement counts or asset summaries. The
  instance browser retains the `full` profile when opened. Existing asset reads
  by other consumers and the node-counter refresh remain unchanged.
- Messages and workflow panels load through independent dynamic imports when
  selected. Their loading states use the existing skeleton components.
- Nodes and connections remain one graph snapshot so a partial connection read
  cannot enable graph execution. Logs load independently and do not delay the
  first graph display. Log errors must not be interpreted as an empty history.
  When needed, display history retains its existing server limit; only explicit
  publishing reads the complete paginated history. Graph refreshes return without
  waiting on optional logs. The Retry notice also reconciles the mounted graph,
  not just its SWR cache, and retains separate graph/log failure indicators.
- Publishing, including test publishing, requires current, complete log data and
  a ready graph. These browser checks do not replace server authorization.
  Concurrent publishes share a complete in-flight log read. Display refreshes
  cannot cancel that read or substitute a limited history for publish admission.
  Successful automatic graph revalidation clears earlier explicit read failures.
  Once an execution is admitted, navigation retires UI updates but does not
  abandon its request after marking it running. Known admission rejection cleanup
  is conditional on the stored running version; uncertain outcomes must not
  overwrite a newer run or claim that background execution stopped.
- Recovery polling runs for executing nodes, not untouched `pending` drafts.
  Overlapping reconciliations are coalesced; visibility recovery is retained.
  Context events with an unrelated target do not refetch this canvas. Unknown
  delete payloads still trigger reconciliation, and retired-instance responses
  cannot replace the active graph.
  Buffered node inserts schedule relation recovery so context events that arrive
  before their target node is mounted are not lost.

## Validation and remaining work

Offline regression checks exercise render isolation, stable dispatch, inherited
media/audience data, layout identity, read profiles and lazy panel switching:

```sh
npm test -- --runInBand __tests__/components/agents/imprenta-card-rendering.test.tsx __tests__/components/agents/imprenta-layout-performance.test.tsx __tests__/components/robots/instance-browser-data.test.tsx __tests__/app/robots/controller-canvas-data.test.tsx __tests__/app/robots/workspace-lazy-views.test.tsx
```

Also run the Imprenta hook, upload, execution, synchronization and existing media
regressions when changing these boundaries. Jest render counts are not FPS or
network-latency measurements.

Authenticated browser profiling remains necessary. Compare cold/warm entry,
pan/zoom, node dragging, prompt editing and incoming results on the same graph
and device. Record long tasks, frame times, React commits, request counts and
transferred bytes. Use disposable data for any persisted edits or generation.

Saved viewport restoration, workers/WebGL/WebGPU, a global thumbnail memory
budget, full dirty-region rendering and transactional bulk mutations remain
follow-ups. No new graphics dependency or backend mock was introduced.