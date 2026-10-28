# Procurement UI Reuse Audit

This UI correction follows the explicit references in section 8 of
[the procurement design](PROCUREMENT_AND_TENDERS_DESIGN.md). It changes presentation,
not API contracts, approval authority, data availability or migration requirements.

## Reused compositions

| Surface | Reference and resulting composition |
| --- | --- |
| Suppliers | Leads-style full-width list, document identity/contact rows, status filters, mobile search and shared pagination; detail identity, About/Contacts/Representatives/Activity responsive tabs and contact dialogs |
| Requests and tenders | Deals-style workspace/StickyHeader, status filters, shared ViewSelector, dense tables and read-only current-page boards; identity, ProgressiveStatusBar and responsive detail tabs |
| Creation and editing | CreateDealDialog-style DialogContent/DialogForm/DialogBody/DialogFooter, RelationSelect, shared Select and DatePicker |
| Procurement policies/rules | Settings SectionCards and sticky save controls; rules use shared table, search, badges, pagination and editing dialog |
| Quotations and orders | Buyer document table/toolbar composition, shared document headers/rows, dialogs for quote capture, line details, decisions and partial acceptance |
| Account credentials/submissions | Existing BuyerShell retained; SectionCards, document tables, tabs, dialogs, credential date pickers and explicit evidence selection |
| Public tenders | CommerceShellHeader, CommerceSearchInput, responsive opportunity cards, document detail/action hierarchy, shared loading/error/empty states; no cart or checkout behavior |
| Catalog sourcing | PlanItemsTab-style shared relation table, capability card and add-offer dialog; existing catalog presentation retained |

`app/purchases/procurement/ui/workspace.tsx` extracts shared presentation from the
Deals/Subscriptions layout. It uses the existing StickyHeader, mobile filter drawer,
SearchInput, Tabs, Skeleton and EmptyState rather than inventing replacement controls.
The shared date fields preserve date-only values separately from ISO timestamp values.
Radix selectors explicitly honor busy/read-only state because portal content does not
inherit a native fieldset's disabled state.

Nested procurement route labels no longer default to `Purchases Details`. Domain-specific
entity titles can still replace the initial route title through the breadcrumb event.

## Action hierarchy correction

- Page primary actions render in the **global TopBar**, through
  `TopBarPrimaryActions` and the shell's `TopBarPrimaryActionsSlot`. The page retains
  its handler, permissions and busy state; no duplicate fallback appears in filters.
- `ProcurementToolbar` separates filters/search from a right-aligned action group:
  compact ghost secondary controls first, and `viewSelector` last at the far right.
- Supplier/request/tender list and detail actions, policy saving, rule creation,
  external quotation capture and catalog sourcing creation follow this hierarchy.
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

## Verification and limits

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