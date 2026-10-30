# Procurement UI Reuse Audit

This UI correction follows the explicit references in section 8 of
[the procurement design](PROCUREMENT_AND_TENDERS_DESIGN.md). It changes presentation,
not API contracts, approval authority, data availability or migration requirements.

## Reused compositions

Purchase order details (`/purchases/orders/[id]`) use the same StickyHeader,
Details/Shipments tabs, horizontally scrollable action toolbar, right-aligned
status and muted 800px document composition as `/orders/[id]`. The real buyer
projection and fictional demo share `PurchaseOrderDetailShell`; purchases retain
read-only status, printing and existing navigation rather than seller mutations.
Unknown procurement statuses remain visible instead of being mapped to a sales
order stage. Regression coverage includes `workspace-order-detail.test.tsx` and
`demo-order-detail.test.tsx`. Local Chromium verified demo tab switching, sticky
position at 64px while scrolling and no document overflow at 390px viewport width.

| Surface | Reference and resulting composition |
| --- | --- |
| Suppliers | Leads-style full-width list, document identity/contact rows, status filters, mobile search and shared pagination; detail identity, About/Contacts/Representatives/Activity responsive tabs and contact dialogs |
| Requests and tender lists | Deals-style workspace/StickyHeader, status filters, shared ViewSelector, dense tables and read-only current-page boards; request identity, ProgressiveStatusBar and responsive detail tabs |
| Internal tender detail | Leads `/leads/[id]` composition: StickyHeader with responsive tabs left and readable read-only status segments right; compact avatar/title/working-version/actions identity; main content and border-separated sticky properties aside |
| Creation and editing | CreateDealDialog-style DialogContent/DialogForm/DialogBody/DialogFooter, RelationSelect, shared Select and DatePicker |
| Procurement policies/rules | Sticky search/status segments, global TopBar creation and individually expandable Skills-style rule cards with independent save footers; simulator actions in its own footer |
| Quotations and orders | Buyer document table/toolbar composition, shared document headers/rows, dialogs for quote capture, line details, decisions and partial acceptance |
| Account credentials/submissions | Existing BuyerShell retained; SectionCards, document tables, tabs, dialogs, credential date pickers and explicit evidence selection |
| Public tenders | CommerceShellHeader, CommerceSearchInput, responsive opportunity cards, document detail/action hierarchy, shared loading/error/empty states; no cart or checkout behavior |
| Catalog sourcing | PlanItemsTab-style shared relation table, capability card and add-offer dialog; existing catalog presentation retained |

`app/purchases/procurement/ui/workspace.tsx` extracts shared presentation from the
Deals/Subscriptions layout. It uses the existing StickyHeader, mobile filter drawer,
SearchInput, Tabs, Skeleton and EmptyCard rather than inventing replacement controls.
Empty results use the default fancy EmptyCard composition from Leads, Deals and
Subscriptions: a compact framed icon, muted text and a bounded card, not a
viewport-height EmptyState. Nested sections/dialogs use transparent compact cards.
Document lists return the shared card outside the table when empty; loading rows,
populated tables, actions and pagination contracts are unchanged. Existing translated
copy is retained in all five languages, and the unrelated automatic-operation hint
is disabled. Retrieval failures are not presented as successful empty results.
The shared date fields preserve date-only values separately from ISO timestamp values.
Radix selectors explicitly honor busy/read-only state because portal content does not
inherit a native fieldset's disabled state.

### Modal layout repair

- Procurement policy content and document dialogs use `text-sm` for body copy,
  matching shared labels, descriptions and desktop controls. Tender form subsection
  headings and legends use weight, not larger sizes, for hierarchy. Approval review
  identity uses `text-base`, matching DialogTitle; explanatory copy uses `text-sm`,
  while metadata badges and counters retain `text-xs`. Shared mobile input sizing
  remains unchanged to preserve the iOS zoom guard. Typography regressions are
  covered by `__tests__/procurement/typography.test.tsx` and the policy, tender and
  approval-review component suites; this does not replace authenticated visual QA.
- Shared dialogs use the dynamic viewport height, shrinkable forms/fieldsets and a
  single scrolling body. Header/close and footer stay outside that scroll region.
- Date controls allocate remaining row width rather than competing with their Clear
  action. Long localized dates truncate inside the trigger, not outside a column.
- The date calendar/time layout switches at the same 768px breakpoint as its mobile
  dialog. Mobile calendars use a slotted body; desktop popovers respect available height.
- Close controls remain absolutely positioned despite legacy Safari button rules and
  are disabled while saving. Footer actions wrap long translations within the dialog.
- Relation-picker icon/actions use spans to avoid Safari's global `input + div` rule;
  labels target the input, and disabling an open picker closes it without selecting.
- Shared confirmation dialogs bound long descriptions and keep actions reachable by
  scrolling, including narrow and short viewports.

`__tests__/procurement/modal-layout-browser.test.tsx` checks actual static tender,
request and credential editor markup plus long-form/date/confirmation compositions,
with real global/Tailwind styles in Chromium and WebKit at 320, 390, 640, 700 and
1440px widths. Only portal mounting is adapted for static markup; no backend requests
are permitted. Radix dismissal, busy state and relation selection are separately
covered in `__tests__/components/ui/dialog-layout.test.tsx` and
`__tests__/components/ui/relation-select-ui.test.tsx`. This does not substitute for an
authenticated end-to-end browser pass against real account/workspace data.

Nested procurement route labels no longer default to `Purchases Details`. Domain-specific
entity titles can still replace the initial route title through the breadcrumb event.

## Action hierarchy correction

- Page primary actions render in the **global TopBar**, through
  `TopBarPrimaryActions` and the shell's `TopBarPrimaryActionsSlot`. The page retains
  its handler, permissions and busy state; no duplicate fallback appears in filters.
- `ProcurementToolbar` separates filters/search from a right-aligned action group:
  compact ghost secondary controls first, and `viewSelector` last at the far right.
- Supplier/request/tender list and detail actions, external quotation capture and
  catalog sourcing creation follow this hierarchy.
- Policy/rules forms follow Settings instead: policy saving stays in each editable
  SectionCard's SectionCardFooter. Both dedicated rule screens render creation
  in the global TopBar through TopBarPrimaryActions, with the shared primary
  button and PlusCircle icon; no duplicate appears in content or card headers.
  Settings footers save the complete document; rule footers save only their rule
  merged into the confirmed document. Revision checks, dirty, busy, conflict and
  demo restrictions remain intact. Simulator controls do not save policy changes.
- Dialog submission/confirmation actions remain in their `DialogFooter`; moving
  those outside the dialog would break form context and focus behavior.
- Account credential upload uses the slot in BuyerShell's commerce header. Public
  tender details pass their primary proposal action to CommerceShellHeader directly.
- Public references were rechecked against MarketplaceHeader/MarketplaceCatalog,
  MarketplaceCategoryChips/MarketplaceSortControl and ShopHeader/ShopCatalogMain,
  plus ProductDetailPage/ProductPdpLayout: Makinari branding, expanded mobile search,
  auth/account navigation, responsive sidebar/chips/sorting and detail hierarchy.
  No cart behavior or invented site branding/category/location data is introduced.

Action-placement tests mount the real portal target, assert that page buttons live
only in the TopBar, exercise their state/handlers and unmount cleanup, and assert
that the view selector is the final toolbar child after secondary actions. Public
browser verification blocked non-read HTTP methods and confirmed mobile search
navigation, one commerce shell and no horizontal overflow or runtime JS errors.

### Internal tender detail reference correction

The current instruction for `/purchases/tenders/[id]` is **very similar to Leads
`/leads/[id]`**, not a workspace action toolbar followed by a large disabled
ProgressiveStatusBar card. Tender detail now uses the same StickyHeader and
ResponsiveTabsList hierarchy, compact identity header and `px-4 lg:px-8 py-5`
body. Information (the existing translated About tab), Lines, Suppliers, Approvals
and Activity retain their content. The body is a main/aside flex row on desktop;
the aside uses `lg:w-[340px] xl:w-[380px]`, a separating border, and a sticky,
height-bounded scrolling property panel. It stacks below content on mobile.
Description, internal estimate, participation, opening policy, deadlines,
visibility and directory opt-in remain visible across tabs using existing keys.

Tender-specific status segments are semantic, noninteractive list items with an
`aria-current` marker and explicit light/dark active colors. They do not use
faded disabled buttons and do not change the global ProgressiveStatusBar.
Cancel and draft deletion live in an icon-bearing shared DropdownMenu and still
require the existing ConfirmDialog. Edit, refresh, back navigation and eligible
participation closing live in the identity header; Request publication remains
only in the global TopBar slot. Fetch paths, site scoping, expected-version
payloads, published-deadline eligibility, publication snapshots, portal controls,
invitation actions and approval decisions retain the existing server behavior.
No backend data or business state is fabricated.

Focused coverage is in `__tests__/procurement/tender-detail-layout.test.tsx` and
`__tests__/procurement/tenders-ui.test.tsx`: composition, non-mutating status,
confirmation/cancellation, versioned destructive/close/publication payloads,
busy/error behavior, portal/invitation payloads and terminal-state restrictions.
These component checks do not replace authenticated mobile/desktop visual review.

## Verification and limits

The sticky toolbar remains full-width without form-specific margins or width
constraints. The body uses Settings' 1200px row with the shared right-hand
QuickNav (desktop only), linked to real card IDs and inline editor subsections.
The dedicated Buying Rules screen uses All/Draft/Active/Archived segments on
the left and the standard adjacent SearchInput. Inventory minimums is a separate
Operations screen at `/inventory/minimums`, using All/Enabled/Disabled segments
and the same search/layout/index composition. Policy search filters the draft
rules; inventory search filters the currently loaded, independently paginated
rules without hiding cases or changing evaluation payloads.
Rule creation lives in the global TopBar on both fullscreen screens. Each rule is
an independently expandable SectionCard with its own save footer. Saving a rule
sends the confirmed policy plus only that rule under the existing revision CAS;
sibling/settings drafts are excluded and retained locally after confirmation.
The index includes each rule by its stable ID. Simulator actions live in its
SectionCardFooter and never persist policy changes.
Policy forms use the Skills page's centered 880px column with 16px mobile and
64px desktop horizontal padding, compact pill tabs, shared SectionCard shells,
headers and footers. Rule creation/editing renders inline, not in a dialog with
a second card inside. Done editing collapses that rule without discarding its
draft; Save policy persists only that rule from its own footer.
Nested conditions, stages, requirements and timing use the subtle light/dark
borders and muted inset backgrounds from SkillsSection/McpSkillCard previews.

The dedicated Rules and Inventory minimums routes have layout-specific loading
boundaries: sticky segment/search placeholders, the 880px form column and the
desktop index column. Rules data loading uses separate card/footer placeholders;
minimums reserves rows in both rules and cases without nesting a second loading
card or showing false empty results. The shell remains the sole TopBar owner.

Initial workspace/account hydration renders the shared content skeleton, never a
flashing "Select a workspace" or "Sign in" message. Purchases, suppliers, settings
and account routes also have loading boundaries. Account/policy/catalog data loading
uses skeletons rather than loading paragraphs. Actual demo restrictions, empty results
and storage/auth errors remain distinct final states, not indefinite skeletons.

The Approvals route now has one inbox/table and one stable toolbar rather than
switching between RequestList and EventApprovalQueue. Stage (requisition, publication,
award, order) and decision status are independent server-side filters. Submitted
requisitions normalize to pending approval; approved does not claim an award or
publication occurred. Source counts/rows remain user-scoped and failures suppress
partial combined results. Event review opens a dialog without replacing the table;
requisition review links to its source document. Pagination merges sorted sources,
with bounded batches below the PostgREST row cap.

Event review uses a single medium-sized dialog: revision/status and plain,
numbered stage rows appear directly in the scrolling body, followed by
the required decision reason. The document identity uses the existing violet icon
tone, a prominent title and shared StatusDot; revision and date form a compact
metadata grid. Stage markers connect vertically without adding card containers.
The decision area uses a full-width muted surface, an accessible audit hint and
a character counter to distinguish input from read-only information.
Cancel, Reject and the primary Approve action live
in the fixed footer. Multiple pending human stages use the shared stage picker;
completed and automated stages remain read-only. There are no nested SectionCards
or secondary confirmation dialogs in this inbox flow. Server authorization,
revision checks and the required audit reason are unchanged; failed decisions
preserve the reason, and saving disables dismissal and repeat actions.

Requisitions now use one list with separate **Approval status**, **Sourcing**, and
**Linked tenders** columns. The sourcing filter distinguishes all requisitions,
with a linked tender and without a linked tender; absence of a tender is not a
confirmed direct-purchase decision. All linked tender lifecycle states (including
cancelled) remain visible instead of erasing history. Requisitions and tenders retain
their own documents and statuses; direct-created tenders do not invent requisitions.

Request title search and sourcing filters are applied server-side before pagination.
The endpoint uses the existing same-site foreign key and user-scoped RLS relationship
projection, not a service-role join. Tender relationships/filtering are manager-only
until operational tender-read permissions expand; other approvers see unavailable
relationship information, never a false "no tender" inference.

- Behavioral tests exercise real shared UI primitives with context boundaries mocked:
  tables/boards, create/edit dialogs, conflict recovery, blocked mutations, same-body
  retry, contacts, dates and account/workspace isolation.
- Source inspection confirms no native table/select/date-input controls remain in the
  new procurement, supplier, account, public tender or catalog sourcing components.
- Headless Chromium checked the real public `/tenders` route at 1440px and 390px widths:
  HTTP 200, shared commerce header and storage-unavailable state, no horizontal overflow
  at 390px. The missing migration error remains visible; no API data was mocked.
- The browser check caught and fixed a server/client boundary issue: EmptyState uses
  styled-jsx, so public server pages render it through `empty-tenders.tsx` (client).
- Authenticated internal desktop/mobile and light/dark visual acceptance still requires
  an approved authenticated test session. No assertion of full visual equivalence is
  made from component tests or anonymous screenshots alone.
- Public category/location filters and buyer brand metadata are not in the existing
  backend contract; the UI does not fabricate them. Read-only boards still group the
  loaded page; request search and sourcing filters apply across accessible requisitions.

No remote migrations, deployments, production builds or commits were performed for
this UI correction. Backend functionality still follows the
[implementation limits](PROCUREMENT_IMPLEMENTATION.md).

## Received quotations and private tender detail

The private tender detail uses one dedicated skeleton for route navigation, site
hydration and initial retrieval, matching its tabs, title and right properties.
Activity is the first and default tab. Publication snapshots appear newest first
in expandable timeline entries, with portal controls in a separate SectionCard.
The former About tab is consolidated into the persistent Details sidebar,
including the linked purchase request and publication-policy explanation.
This timeline represents publication history only; it does not invent audit events.
Its **Received quotations** tab embeds the existing procurement quotation workflow
filtered to that tender, with no nested sticky toolbar or replacement backend.

`/purchases/quotes` renders one shared quotation table, combining authorized
procurement API results and buyer quotation results. Search, review status and
pagination operate on the combined list; duplicate document IDs are removed.
Procurement rows retain source labels, references and approval details. Their
tender-title chips link to `/purchases/tenders/[id]` without opening the quotation
dialog. Existing RPC access checks and sealed-offer visibility remain unchanged.
Merchant quotation clicks retain their existing purchase-detail destination.
The quotation toolbar reuses the standard workspace filters and full-width sticky
header outside the padded scrolling content. It has no manual refresh button;
recording and approval changes still reload their data automatically. Embedded
tender quotations reuse the filters without adding a second sticky header.

Regression coverage: `received-quotations.test.tsx` and
`tender-detail-loading-quotes.test.tsx` under `__tests__/procurement/`.
Authenticated desktop/mobile visual acceptance remains unverified.