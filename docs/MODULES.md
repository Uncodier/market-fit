# Makinari module guide

Internal functional reference for product, operations, support, and onboarding.
Reviewed against local source on **2026-10-23**. This describes implemented
screens and workflows, not a certification of deployment or live provider delivery.

## How to use this guide

Each module explains its purpose, principal capabilities, and a typical use.
Routes identify application destinations; source links identify implementation.
Navigation follows [the current module configuration](../app/config/navigation-areas.ts).
Areas group the menu; they do not add prefixes to routes.

- Select the correct business/project first. A **site** is a workspace, not
  necessarily a website. A **location** is a branch/resource scope within it.
- Visibility and actions depend on membership, role, app access, location access,
  licenses, and resource state. A visible button does not establish permission.
- Save configuration explicitly where a Save action is provided. Confirm the
  returned state before repeating payments, messages, or automation requests.
- External search, AI execution, publishing, payments, and hardware require their
  respective configured services. Saved settings are not proof of execution.
- Demo data illustrates the interface; it is not evidence of real transactions.
- Display language is an account preference; site language also influences public
  content and generated documents. Labels may differ from the English names here.

See [Security](SECURITY.md), [environment configuration](ENVIRONMENT_VARIABLES.md),
and [location access](LOCATION_ACCESS_ENFORCEMENT.md) for operational boundaries.

## Contents

- [Workspace tools](#workspace-and-personal-tools) · [Marketing](#marketing) · [Sales](#sales)
- [Operations](#operations) · [Buying](#buying) · [Finance](#finance) · [Reports](#reports)
- [Applications](#applications) · [Automation](#automation) · [Settings](#settings)
- [Public commerce and buyer portal](#public-commerce-and-buyer-portal)
- [Cross-module workflows](#cross-module-workflows) · [Limits and maintenance](#limits-and-maintenance)

## Workspace and personal tools

See [the companion guide](MODULES_COMMERCE_AND_ACCOUNT.md#workspace-and-personal-tools)
for Projects, site creation/onboarding, Navigation, Profile, and Notifications.

## Marketing

### Campaigns — `/campaigns`
- **Purpose/capabilities:** Organize marketing initiatives with audience/segment links, status, requirements, promotions, recorded expenses, and attributed sales; browse table/Kanban views.
- **Use:** Create an initiative, associate its audience and brief, then record spending and sales to review campaign economics.
- **Limits:** AI-assisted creation can create a linked requirement; it does not prove execution. Recorded financial aggregates are not independent advertising attribution.
- **Source:** [Campaigns](../app/campaigns/page.tsx); [creation](../app/campaigns/actions/campaigns/create.ts).

### Segments — `/segments`
- **Purpose/capabilities:** Define audiences using descriptions, language, size estimates and status; inspect stored targeting analysis, ICP profiles, and activity metrics.
- **Use:** Define the target audience, review its stored analysis, and reuse it in campaigns and prospect-enrichment requests.
- **Limits:** Analysis display does not itself run research. Some legacy profile/metric presentations have fallback or comparison limitations; do not treat estimates as measured outcomes.
- **Source:** [Segments](../app/segments/page.tsx); [segment detail](../app/segments/[id]/page.tsx).

### Promotions — `/promotions`
- **Purpose/capabilities:** Configure percentage, fixed-amount and buy/get offers, coupon codes, product/category eligibility, cart requirements, dates, usage limits, channels, and location rules; inspect redemptions.
- **Use:** Define the offer and eligible items, choose its commercial channels, then inspect resulting redemption orders.
- **Limits:** Merchandising visibility and discount eligibility are separate. Generated banners require the configured generation service.
- **Source:** [Promotions](../app/promotions/page.tsx); [promotion detail](../app/promotions/[id]/page.tsx).

### Content — `/content`
- **Purpose/capabilities:** Maintain content items and their lifecycle, inspect/edit details, and request supported publishing operations; additional research and teleprompter surfaces support content preparation.
- **Use:** Prepare and review an item before publishing to an authorized connected destination; use the teleprompter for script reading.
- **Limits:** Publishing/scheduling depends on the external provider. Request acceptance or a local status is not proof that a post is publicly available.
- **Source:** [Content](../app/content/page.tsx); [Deep Research](../app/content/deepResearch/page.tsx); [Teleprompter](../app/teleprompter/[id]/page.tsx); [reliability](CONTENT_RELIABILITY.md).

### Content Creator — `/robots?mode=imprenta`
- **Purpose/capabilities:** Compose a persistent canvas with Text, Image, Video, Audio, Audience, and Publish nodes; connect prompts/media, generate variants, and copy/download outputs.
- **Use:** Create connected source and generation nodes, review output, select an audience where needed, and choose exact connected publishing/delivery accounts.
- **Limits:** Requires an assistant instance and external generation/delivery services. It is not a pixel editor, video timeline, or audio mixer; canvas configuration is not a scheduling engine.
- **Source:** [Robots](../app/robots); [account-specific destinations](CONTENT_CREATOR_DESTINATIONS.md); [speech options](CONTENT_CREATOR_AUDIO.md).

### Assets — `/assets`
- **Purpose/capabilities:** Browse and manage the workspace's reusable media/file assets for content and other business workflows.
- **Use:** Locate or add a reusable asset, inspect it, and use its supported reference in the consuming module.
- **Limits:** File access follows storage authorization; an asset record is not a public-sharing or purchased-content entitlement.
- **Source:** [Assets](../app/assets/page.tsx).

## Sales

### Sales Home — `/sales-home`
- **Purpose/capabilities:** Shortcut hub for Sales, Leads, Deals, Control Center, Chat, and People; can hand off to sale registration.
- **Use:** Open the relevant commercial workflow rather than treating this hub as a financial report.
- **Limits:** Hidden from normal module entries; it is not a separate sales ledger. People is prospect search, not team administration.
- **Source:** [Sales Home](../app/sales-home/page.tsx).

### POS — `/pos`
- **Purpose/capabilities:** Build a customer cart, choose items/options and location, apply eligible pricing/promotions, complete supported checkout, and operate register shifts and receipts.
- **Use:** Select the operating location/register, prepare the cart, confirm inventory and payment, then review the resulting order and receipt.
- **Limits:** Local snapshots and synchronization support POS operation, not unrestricted offline payment or stock guarantees. Resolve ambiguous/conflicted checkout instead of charging again.
- **Source:** [POS](../app/pos/page.tsx); [inventory](POS_INVENTORY.md); [register shifts](POS_REGISTER.md); [checkout recovery](POS_CHECKOUT_RECOVERY.md).

### Catalog — `/catalog`
- **Purpose/capabilities:** Maintain sellable items, prices, categories, media, item-specific configuration and channel visibility; import catalog data and maintain modifier groups at `/catalog/modifier-groups`.
- **Use:** Define the product/service or digital offering, configure its options and fulfillment/access requirements, then expose it in the intended channel.
- **Limits:** Catalog definition, branch inventory, public listing, and post-payment access are separate concerns; creating an item does not complete those workflows automatically.
- **Source:** [Catalog](../app/catalog/page.tsx); [modifier groups](../app/catalog/modifier-groups/page.tsx); [import](CATALOG_IMPORT.md); [category archival](CATALOG_CATEGORY_ARCHIVAL.md).

### Price Lists — `/price-lists`
- **Purpose/capabilities:** Maintain named sets of catalog prices and inspect/edit their item-level pricing.
- **Use:** Define the appropriate commercial pricing and use it in workflows that support price-list selection.
- **Limits:** A saved list is not a universal override of every channel; checkout validates applicable server-owned prices.
- **Source:** [Price Lists](../app/price-lists/page.tsx); [detail](../app/price-lists/[id]/page.tsx).

### Customer Subscriptions — `/subscriptions`
- **Purpose/capabilities:** Inspect and maintain customer-facing commercial subscriptions, their terms/status, and related invoicing.
- **Use:** Open a customer's subscription, review its dates and terms, and perform the permitted lifecycle or invoice operation.
- **Limits:** Not the business's Makinari license or its purchased subscriptions. Subscription terms, invoice due dates, and confirmed payment remain distinct.
- **Source:** [Subscriptions](../app/subscriptions/page.tsx); [detail](../app/subscriptions/[id]/page.tsx); [terms and due dates](FINANCIAL_DUE_DATES.md).

### Accounts Receivable — `/accounts-receivable`
- **Purpose/capabilities:** Review customer invoice balances and due-date collection work, opening the related sale/invoice to inspect settlement.
- **Use:** Prioritize outstanding balances, inspect the document, then record or request the supported balance payment through its authorized flow.
- **Limits:** Due date is not subscription renewal or payment confirmation. Payment actions must use the current outstanding balance.
- **Source:** [Accounts Receivable](../app/accounts-receivable/page.tsx); [invoice payments](LEAD_INVOICE_PAYMENTS.md); [due dates](FINANCIAL_DUE_DATES.md).

### Sales — `/sales`
- **Purpose/capabilities:** Register and inspect commercial sale records, customer associations, amounts/status, and related financial documents and payment evidence.
- **Use:** Register the commercial transaction or open an existing sale to review its actual collection/document state.
- **Limits:** A sale record, a completed order, collected cash, and posted accounting revenue are not interchangeable.
- **Source:** [Sales](../app/sales/page.tsx); [sale detail](../app/sales/[id]/page.tsx); [sales reporting](REPORTS.md).

### Leads — `/leads`
- **Purpose/capabilities:** Maintain customer/prospect contact records, qualification/status and associations; inspect related commercial activity, conversations, and follow-up work.
- **Use:** Create or qualify a contact, associate the appropriate campaign/segment, and follow up using tasks, deals, or customer conversations.
- **Limits:** Outbound calling requires appropriate contact data and consent; contact presence is not permission to call.
- **Source:** [Leads](../app/leads/page.tsx); [call consent](LEAD_CALL_CONSENT.md); [invoice balance payments](LEAD_INVOICE_PAYMENTS.md).

### Deals — `/deals`
- **Purpose/capabilities:** Maintain sales opportunities, stages/status, value, ownership and related customer/quotation information.
- **Use:** Track an opportunity through negotiation and issue an associated quotation when commercial terms are ready.
- **Limits:** Pipeline value is prospective, not collected revenue. Deal location and quotation scope must remain consistent.
- **Source:** [Deals](../app/deals/page.tsx); [detail](../app/deals/[id]/page.tsx).

### Quotations — `/quotations`
- **Purpose/capabilities:** Prepare itemized offers with quantities, pricing, notes and totals; send/resend PDFs and public review links; request configured dynamic pricing.
- **Use:** Prepare the offer for a customer/deal, resolve prices and authorization, then explicitly send it or share its client link.
- **Limits:** Setting Sent does not itself email the customer. Dynamic pricing needs the configured backend; buyer checkout requires an eligible current quotation.
- **Source:** [Quotations](../app/quotations/page.tsx); [actions](../app/quotations/actions.ts); [pricing requests](../app/quotations/dynamic-quote-request.ts).

### People and company details — `/people`, `/companies/[id]`
- **Purpose/capabilities:** Search external prospects with person/role/company criteria, manage saved Finder lists and request enrichment; company detail maintains persisted company information.
- **Use:** Search prospects, save useful results, and request enrichment; use Leads for CRM follow-up and Settings Team for workspace membership.
- **Limits:** Finder requires its external backend. An accepted enrichment request is not completed research; company detail is not a complete standalone company-directory module.
- **Source:** [People](../app/people/page.tsx); [Finder proxy](../app/api/finder/[...path]); [company detail](../app/companies/[id]/page.tsx).

## Operations

### Chat — `/chat`
- **Purpose/capabilities:** Browse customer and internal agent conversations, search/filter history, manage pending messages, and send team interventions through available channels.
- **Use:** Review the thread and select the intended channel/context before replying; use internal agent discussion when the customer should not receive the message.
- **Limits:** Public social comments are not DMs. Voice intervention requests an outbound call, not proof of an answered call; delivery needs active connections and consent checks.
- **Source:** [Chat](../app/chat/page.tsx); [intervention delivery](CHAT_INTERVENTION_DELIVERY.md); [social comments](SOCIAL_COMMENT_CONVERSATIONS.md).

### Records — `/records`
- **Purpose/capabilities:** Define category templates and structured fields; maintain rich-text records, relationships/status and diagrams; browse table, Kanban, calendar and graph views.
- **Use:** Define a category for an inspection, document or knowledge entry, create records, link related entities, and save changes.
- **Limits:** Calendar placement uses creation time, not a reservation schedule. Stored-field insights are not a guarantee of AI-generated analysis.
- **Source:** [Records](../app/records/page.tsx); [record detail](../app/records/[id]).

### Customer Orders — `/orders`
- **Purpose/capabilities:** Inspect the selected seller's customer orders, lines, fulfillment/payment state and related documents; perform permitted order operations.
- **Use:** Open the customer's order, verify its payment release and fulfillment requirements, then process its lines/shipment.
- **Limits:** These are orders the site sells, not purchases it makes. Operational completion must not substitute for authoritative payment settlement.
- **Source:** [Orders](../app/orders/page.tsx); [seller query](../app/orders/query-orders.ts); [self-service payment release](SHOP_SELF_SERVICE.md).

### Order Lines — `/order-lines`
- **Purpose/capabilities:** Item-level work queue across orders, with pending, in-progress, ready, returned and cancelled views; filter by location/date and open the parent order.
- **Use:** Process the specific line assigned to operational work and inspect its parent when customer/payment context is needed.
- **Limits:** Line progress is not a separate sale or payment. Parent authorization and permitted transitions still apply.
- **Source:** [Order Lines](../app/order-lines/page.tsx); [line operations](../app/order-lines/use-order-line-operations.ts).

### Shipments — `/shipments`
- **Purpose/capabilities:** Maintain order-related shipment records and inspect delivery status, origin/destination and tracking information.
- **Use:** Open or prepare the shipment for a released order and update supported operational tracking as delivery progresses.
- **Limits:** A recorded shipment/tracking state is not proof that an external carrier accepted or delivered it.
- **Source:** [Shipments](../app/shipments/page.tsx); [detail](../app/shipments/[id]/page.tsx).

### Control Center — `/control-center`
- **Purpose/capabilities:** Organize tasks, assignees, priorities, dates/status and linked business work; use the available views to monitor progress.
- **Use:** Create a follow-up or operational task, assign responsibility, and update it as the work is completed.
- **Limits:** Marking a task done does not settle an invoice, deliver an order, or confirm an external workflow finished.
- **Source:** [Control Center](../app/control-center).

### Reservations — `/reservations`
- **Purpose/capabilities:** Browse and create scheduled reservations with customer, time and resource/location context.
- **Use:** Choose the service/resource and available time, confirm the customer booking, and later complete the supported check-in flow.
- **Limits:** Reserved time is distinct from payment, purchased access rights, and actual attendance.
- **Source:** [Reservations](../app/reservations/page.tsx); [new reservation](../app/reservations/new/page.tsx).

### Visits — `/visits`
- **Purpose/capabilities:** Register visitors and review visit records, terms acceptance and configured identity/signature/photo evidence; physical and online registration are distinct channels.
- **Use:** Configure visit requirements first, then register the visitor through the enabled channel and review the recorded attestation.
- **Limits:** Visits reuse reservation storage but represent a different workflow. Registration does not automatically establish payment or redeem an entitlement.
- **Source:** [Visits](../app/visits/page.tsx); [registration](../app/visits/new/page.tsx); [visit settings](../app/components/settings/VisitsSection.tsx).

### Check-in — `/pos/check-in`
- **Purpose/capabilities:** Operational admission/redeeming surface for identifying customers and completing eligible reservation or entitlement check-ins.
- **Use:** Identify the customer/access record, verify eligibility and remaining uses, then explicitly confirm the supported admission operation.
- **Limits:** Identity QR, reservation, ticket and pass are different credentials. Admission depends on current authorization/validity, not merely a readable code.
- **Source:** [Check-in](../app/pos/check-in/page.tsx); [buyer identity QR](../app/buyer/identity-qr-actions.ts).

### Inventory — `/inventory`
- **Purpose/capabilities:** Inspect stock levels by catalog item/location, maintain locations, perform supported stock adjustments/transfers, and configure commerce inventory policies.
- **Use:** Select the location, review availability, and apply the appropriate adjustment or transfer before relying on stock in POS/fulfillment.
- **Limits:** Transfers authorize both branches atomically. Stock availability/backorder markers do not guarantee every cart quantity is currently fulfillable.
- **Source:** [Inventory](../app/inventory/page.tsx); [actions](../app/inventory/actions.ts); [POS inventory](POS_INVENTORY.md).

### Printers — `/settings?tab=printers`
- **Purpose/capabilities:** Maintain printer configuration used by supported operational printing and inspect synchronization status in consuming modules.
- **Use:** Configure the printer/service and verify it in the intended POS or operational workflow before depending on printed output.
- **Limits:** Saving configuration or seeing a sync indicator does not prove hardware printed successfully.
- **Source:** [Printer settings](../app/components/settings/PrintersSection.tsx); [development boundaries](DEVELOPMENT.md).

## Buying

### Vendor Bills — `/bills`
- **Purpose/capabilities:** Maintain itemized purchase/vendor-bill records, totals, dates/status, payment terms and related financial documents.
- **Use:** Record the vendor obligation and review its due/payment state; use accounting synchronization for its supported ledger posting.
- **Limits:** A bill is not an approved purchase request, tender award, physical receipt or automatic bank reconciliation.
- **Source:** [Bills](../app/bills/page.tsx); [detail](../app/bills/[id]/page.tsx); [due dates](FINANCIAL_DUE_DATES.md); [accounting](ACCOUNTING.md).

### Transactions — `/transactions`
- **Purpose/capabilities:** Record and maintain expense transactions, categories and associations used by cost analysis and accounting.
- **Use:** Record an expense with its correct date/category and relevant campaign/business context, then review it in Costs or the ledger.
- **Limits:** These records are not the Payments wallet-operation history or proof of a bank/provider transfer.
- **Source:** [Transactions](../app/transactions/page.tsx); [detail](../app/transactions/[id]/page.tsx).

### Purchased Orders — `/purchases/orders`
- **Purpose/capabilities:** Browse commerce orders filed under the selected purchasing site and open buyer-facing order details.
- **Use:** Inspect what the business bought from another seller and review the associated order/access state.
- **Limits:** Purchasing-site ownership differs from seller `site_id`; this is not a full procurement purchase-order/receiving system.
- **Source:** [Purchased Orders](../app/purchases/orders/page.tsx); [buyer queries](../app/buyer/actions.ts).

### Purchased Subscriptions — `/purchases/subscriptions`
- **Purpose/capabilities:** Review subscriptions acquired through commerce under the purchasing context and their supported buyer lifecycle controls.
- **Use:** Open the acquired subscription to review its current status and available management action.
- **Limits:** Not customer subscriptions sold by the business or its Makinari plan. Management rights still depend on buyer identity and provider state.
- **Source:** [Purchased Subscriptions](../app/purchases/subscriptions/page.tsx); [buyer subscription actions](../app/buyer/subscription-actions.ts).

### Received Quotations — `/purchases/quotes`
- **Purpose/capabilities:** Review quotations received by the signed-in buyer, reject eligible offers, or proceed to quotation checkout.
- **Use:** Review the offer and complete its checkout when appropriate, filing the resulting purchase in the intended project.
- **Limits:** The list remains buyer-user scoped, not a shared company procurement inbox. Proceeding to checkout is not immediate acceptance or confirmed payment.
- **Source:** [Purchased Quotes](../app/purchases/quotes/page.tsx); [buyer queries](../app/buyer/actions.ts); [quote detail](../app/buyer/components/BuyerQuoteDetailView.tsx).

### Purchased Library — `/purchases/library`
- **Purpose/capabilities:** Browse acquired course, ticket, file, pass or license entitlements; open supported access experiences and eligible signed file downloads.
- **Use:** Locate the acquired digital offering and use its authorized viewing/download/booking experience.
- **Limits:** Site visibility is not automatically team-wide redemption/download permission. Status, expiry, buyer identity and remaining uses must be checked downstream.
- **Source:** [Purchased Library](../app/purchases/library/page.tsx); [library view](../app/buyer/components/BuyerLibraryView.tsx); [download actions](../app/catalog/digital-file-actions.ts).

## Finance

### Finance Reports — `/finance`
- **Purpose/capabilities:** Review Profit & Loss, Balance Sheet and Trial Balance from posted journals; choose period/currency, refresh and export CSV.
- **Use:** Select the accounting period and currency, inspect balances, and resolve journal/source discrepancies before relying on statements.
- **Limits:** No currency conversion. Generate Report opens journal synchronization, which can write entries; incomplete/invalid ledger coverage must not become assumed zero totals.
- **Source:** [Finance](../app/finance); [accounting contracts](ACCOUNTING.md).

### Journal Entries — `/accounting/entries`
- **Purpose/capabilities:** Inspect journal sources and debit/credit lines, open source documents, maintain permitted balanced manual journals, and synchronize source records for a period.
- **Use:** Trace an unexpected balance to its source; correct the source and synchronize, or enter an explicit authorized manual adjustment.
- **Limits:** Synchronization posts accounting records; it is not bank reconciliation. Generated journals and manual journals have different edit/delete rules.
- **Source:** [Journal Entries](../app/accounting/entries/page.tsx); [accounting](ACCOUNTING.md).

### Chart of Accounts — `/accounting`
- **Purpose/capabilities:** Maintain the site's accounting accounts and classification used by journal lines and financial statements.
- **Use:** Establish the appropriate account structure before posting manual entries or mapping operational sources.
- **Limits:** Account changes affect reporting classification, not the underlying commercial payment state; referential and role restrictions apply.
- **Source:** [Chart of Accounts](../app/accounting/page.tsx); [accounting](ACCOUNTING.md).

### Payments / Balances — `/payments`
- **Purpose/capabilities:** Inspect business wallet/balance summaries, recorded operations and withdrawal history; request permitted withdrawals through the configured payout flow.
- **Use:** Review available balances and operation evidence before initiating a withdrawal and checking its subsequent status.
- **Limits:** Wallet balances, AI credits, sales collections and ledger balances are separate measures. A requested payout is not a completed bank transfer.
- **Source:** [Payments](../app/payments/page.tsx); [balance history](../app/payments/payment-balance-history.ts).

## Reports

Reports analyze stored operational/tracking data, not hypothetical forecasts.
Choose the report, its section, and the applicable date/segment/currency filters.
Export the loaded section where supported; missing coverage is not zero activity.
See [report sections and data contracts](REPORTS.md), [exports](REPORT_EXPORTS.md),
and [demo data boundaries](DEMO_REPORTS.md).

### Performance — `/dashboard?tab=performance`
- **Purpose/capabilities:** Outcomes, Operations and AI usage sections compare recorded commercial/lead activity, conversations/tasks and AI consumption over time.
- **Use:** Review workload and operational outcomes, then open the underlying business module for action.
- **Limits:** Sales-record counts are not revenue or cash collection; date buckets and scope follow the report's disclosed contracts.

### Business Overview — `/dashboard?tab=overview`
- **Purpose/capabilities:** Summary, Unit economics and Activity sections combine business KPIs, sales/expense/purchase context and activity information.
- **Use:** Assess the business at a glance, then investigate financial or operational changes in the dedicated reports.
- **Limits:** Some activity and purchase context is site-wide even when a segment is selected; chart expenses/purchases do not reconstruct net accounting profit.

### Analytics — `/dashboard?tab=analytics`
- **Purpose/capabilities:** Distribution, Customer cohorts and Lead cohorts analyze recorded populations and retention patterns.
- **Use:** Compare distributions and cohort progression while respecting the selected window and incomplete-period disclosures.
- **Limits:** Customer cohorts are based on observed qualifying sales in the window, not necessarily lifetime-first purchases or confirmed payments; not all distributions separate currencies/statuses.

### Traffic — `/dashboard?tab=traffic`
- **Purpose/capabilities:** Acquisition, Audience and Sessions analyze session-entry attribution, sources, URLs, geography, devices/browsers and aggregate session activity.
- **Use:** Install tracking on the intended pages, preserve campaign UTMs, and inspect acquisition/coverage before drawing attribution conclusions.
- **Limits:** No segment filtering for session attribution; Direct / unknown is not proof of direct entry. Sessions is aggregate reporting, not an individual-session replay tool.

### Costs — `/costs`
- **Purpose/capabilities:** Summary and Categories analyze recorded expenses and eligible purchases, cost composition and sales-to-cost context; includes campaign filtering.
- **Use:** Review recorded spending and categories, then open Transactions or Bills to inspect/correct source records.
- **Limits:** Purchase coverage varies with filters; incompatible currencies or incomplete data can make efficiency unavailable. Cost efficiency is not accounting net profit.

### Sales Report — `/dashboard?tab=sales`
- **Purpose/capabilities:** Summary, Channels and Categories distinguish active sales, net collected cash, outstanding balances, trends and allocation breakdowns.
- **Use:** Select period/currency and compare commercial activity with actual collections before investigating an outstanding invoice.
- **Limits:** Outstanding is the current balance of selected-period sales; category allocations are proportional, and missing receipt/refund history remains unavailable.

### Social — `/dashboard?tab=social`
- **Purpose/capabilities:** Engagement, Networks & audience and Top posts analyze stored social metrics, connected-network results and post rankings.
- **Use:** Connect accounts and ensure metric ingestion is configured, then review published-content performance.
- **Limits:** Refresh reloads stored data, not necessarily provider synchronization. Metrics are accumulated snapshots; reach is not deduplicated and segment filtering is unsupported.

## Applications

### Applications hub — `/applications`
- **Purpose/capabilities:** Entry point for the workspace's application-related data and recorded development outputs.
- **Use:** Choose Database or Repositories; configure application credentials under Secrets when required.
- **Source:** [Applications](../app/applications/page.tsx).

### Database — `/applications/database`
- **Purpose/capabilities:** Inspect requirement-linked application databases, tables/columns and row counts; filter/sort/paginate data and perform authorized row insertion/edit/deletion.
- **Use:** Open an existing application database and inspect the table before applying an intentional data change.
- **Limits:** Requires provisioned tenant database infrastructure/RPCs, manager access and unrestricted location access. It does not provision databases; row editing/deletion requires a primary key.
- **Source:** [Database](../app/applications/database/page.tsx); [application actions](../app/applications/actions.ts).

### Repositories — `/applications/repositories`
- **Purpose/capabilities:** Browse recorded repository artifacts, repository/preview links and archive-based source contents associated with requirements.
- **Use:** Inspect a generated implementation and its external links; use the linked development workflow for changes.
- **Limits:** Not Git hosting or a commit/deploy interface. Source-viewer edits remain local; sending changes hands a message to robot chat rather than saving a repository.
- **Source:** [Repositories](../app/applications/repositories/page.tsx).

### Secrets — `/settings?tab=secrets`
- **Purpose/capabilities:** Maintain encrypted site integration credentials and metadata; authorized managers can replace, reveal or delete secrets.
- **Use:** Store a credential in its intended provider/use-case/scope and configure the consuming integration separately.
- **Limits:** Secrets are not automatically injected into deployment environments. Never copy revealed credentials into documentation or use this screen instead of a provider-specific connection flow.
- **Source:** [Secrets settings](../app/components/settings/SecretsSection.tsx); [Secrets API](../app/api/secrets/route.ts).

## Automation

### AI Workspace — `/robots`
- **Purpose/capabilities:** Work with assistant instances, instructions and interactive execution; inspect returned messages, logs, work artifacts and execution state.
- **Use:** Select the appropriate instance, provide scoped instructions, start supported work, and monitor its explicit result before issuing dependent actions.
- **Limits:** Needs external orchestration and any required runtime/provider capacity. A streamed step, accepted request or disconnected browser is not terminal completion; Stop requests cancellation.
- **Source:** [Robots workspace](../app/robots/robots-workspace.tsx); [execution boundaries](ARCHITECTURE.md).

### Context — `/context`
- **Purpose/capabilities:** Maintain shared company, branding, marketing, copy sequences and customer-journey guidance consumed by AI/business workflows.
- **Use:** Record accurate business facts, voice/tone, offerings and constraints before asking agents to communicate or generate content.
- **Limits:** Saved context is guidance, not authorization or guaranteed model compliance. Some company information overlaps Settings Company.
- **Source:** [Context](../app/context/page.tsx).

### Agent Configuration — `/agents`
- **Purpose/capabilities:** Maintain agent roles, personality/prompts and activity configuration; inspect related conversations/command records and launch supported activities.
- **Use:** Configure responsibility and instructions, select a supported activity, and inspect its actual execution result.
- **Limits:** Organizational hierarchy is not an execution graph; only wired activity launches execute, through the separate backend. Hidden tabs do not establish connector capabilities.
- **Source:** [Agents](../app/agents/page.tsx); [agent saving](../app/agents/save-agent.ts).

### Requirements — `/requirements`
- **Purpose/capabilities:** Maintain work briefs, instructions, status/completion and campaign/segment associations; inspect related implementation/work artifacts and planning metadata.
- **Use:** Write the acceptance intent and context, associate the business initiative, and follow execution/output through the supported agent workflow.
- **Limits:** Requirement planning/draft diagrams are not equivalent to persisted executable workflow nodes. Completion should be supported by the actual output.
- **Source:** [Requirements](../app/requirements/page.tsx); [detail](../app/requirements/[id]/page.tsx); [deletion lifecycle](INSTANCE_DELETION.md).

### Agent Channels — `/settings?tab=channels`
- **Purpose/capabilities:** Configure agent communication connections, sender identities and applicable email/phone/voice options; manage activation within licensed capacity.
- **Use:** Connect and verify the intended account/number, activate eligible capacity, then select that connection in messaging/publishing workflows.
- **Limits:** Configured, licensed, connected and active are different states. Sending and outbound calling remain provider- and consent-dependent.
- **Source:** [Channels](../app/components/settings/ChannelsSection.tsx); [activation](AGENT_CHANNEL_ACTIVATION.md); [numbers](AGENT_CHANNEL_NUMBERS.md).

### AI Activities — `/settings?tab=activities`
- **Purpose/capabilities:** Configure recurring/business activity inputs, activation and supported timing/selection options, including specialized outreach and standup settings.
- **Use:** Configure the activity's audience/input and timing before enabling it; inspect execution through the actual agent/backend workflow.
- **Limits:** A saved activity/schedule is configuration, not proof that the external scheduler or worker ran it.
- **Source:** [Activities](../app/components/settings/ActivitiesSection.tsx); [standup](DAILY_STANDUP_SETTINGS.md); [ICP mining lists](ICP_MINING_LIST_SELECTION.md).

### Skills — `/skills`
- **Purpose/capabilities:** Upload/paste/edit Markdown skills, enable/disable or delete permitted skills, and search/preview/import community instructions; inspect system skills and external-agent setup downloads.
- **Use:** Review the instructions and provenance before enabling/importing a skill and assigning it to supported agent work.
- **Limits:** Instructions are not installed executables. External-agent setup does not launch the external tool; catalog/import operations require the configured Skills API.
- **Source:** [Skills](../app/skills/page.tsx).

### Workflows — `/robots?mode=workflow`
- **Purpose/capabilities:** Persist visual trigger/step graphs, relations and instructions; configure manual, scheduled, event, webhook or channel-message triggers; request runs/tests and inspect recorded results.
- **Use:** Configure an enabled trigger, connect steps with appropriate success/failure conditions, then run and inspect explicit outcomes.
- **Limits:** Saving nodes/tools does not prove backend execution/provider support. Test requests are not a guarantee of side-effect isolation; channel-message triggers have execution restrictions.
- **Source:** [Workflow components](../app/components/workflows); [relation and execution contracts](ARCHITECTURE.md).

## Settings

Settings tabs share [the Settings page](../app/settings/page.tsx); some are grouped
under Operations, Applications or Automation above because that is their menu placement.

### General Settings — `/settings?tab=general`
- **Purpose/capabilities:** Maintain workspace name, logo, URL/language and general resources/tracking setup; access permitted site archival controls.
- **Use:** Keep workspace identity and tracked resources accurate; changing the site name can affect the derived Shop URL.
- **Source:** [General](../app/components/settings/GeneralSection.tsx); [site form](../app/components/settings/site-form.tsx); [archival](SITE_ARCHIVAL.md).

### Company — `/settings?tab=company`
- **Purpose/capabilities:** Maintain the business profile, locations, business hours, goals and SWOT information.
- **Use:** Establish the locations and operating context used by commercial/operational workflows and AI guidance.
- **Source:** [Company settings](../app/components/settings/CompanySection.tsx).

### Marketplace / Shop Settings — `/settings?tab=marketplace`
- **Purpose/capabilities:** Configure the site's public Shop presentation, sharing URL/QR, trust/shipping information, payment/payout options and location self-service ordering policy.
- **Use:** Configure the public selling experience and payment release rules, then separately verify catalog visibility and checkout readiness.
- **Limits:** This tab configures a seller's Shop; it is not the cross-site public Marketplace catalog. A QR/order request is not paid fulfillment authorization.
- **Source:** [Shop settings](../app/components/settings/ShopSection.tsx); [self-service](SHOP_SELF_SERVICE.md).

### Visit Settings — `/settings?tab=visits`
- **Purpose/capabilities:** Enable physical/online visit registration, configure terms and identity/signature/photo requirements, and set default duration.
- **Use:** Set the required evidence before opening visitor registration in Operations or the buyer portal.
- **Source:** [Visit settings](../app/components/settings/VisitsSection.tsx).

### Team — `/settings?tab=team`
- **Purpose/capabilities:** Invite/manage members, roles and activation; configure app access and eligible location exclusions in member cards.
- **Use:** Grant the minimum required role/apps/branches and explicitly save the member changes.
- **Limits:** Owners/admins are exempt from branch exclusions; location editing depends on the deployed enforcement gate. The historical record-assignment screen is currently hidden/redirected.
- **Source:** [Team](../app/components/settings/TeamSection.tsx); [location access enforcement](LOCATION_ACCESS_ENFORCEMENT.md); [license limits](SITE_LICENSE_LIMITS.md).

### Calendar — `/settings?tab=calendar`
- **Purpose/capabilities:** Maintain round-robin calendar definitions, member selection, duration/buffer and public booking links.
- **Use:** Choose eligible team members, define the calendar, and share its generated booking link after confirming availability setup.
- **Limits:** Personal calendar preferences belong in Profile; saving a definition does not establish provider calendar synchronization.
- **Source:** [Calendar settings](../app/components/settings/CalendarSection.tsx); [public booking](../app/book).

### Social Networks — `/settings?tab=social`
- **Purpose/capabilities:** Maintain social account connections and initiate supported OAuth/provider-specific connection flows.
- **Use:** Connect the exact business account and verify its state before selecting it for publishing or social reporting.
- **Limits:** Connection does not publish content or guarantee metrics ingestion; platform permissions, licensed capacity and provider availability apply.
- **Source:** [Social settings](../app/components/settings/SocialSection.tsx); [OAuth setup](SOCIAL_NETWORK_OAUTH_SETUP.md).

### Integrations — `/integrations`
- **Purpose/capabilities:** Maintain outbound webhook endpoints/event subscriptions and test requests; configure communication providers, marketplace merchant connections and supported Composio integrations.
- **Use:** Configure the intended integration through its specific flow and verify the supported event/delivery contract.
- **Limits:** The legacy displayed workflow-webhook URL is not an active general-purpose workflow entry point. Use current workflow trigger contracts; test delivery can have external effects.
- **Source:** [Integrations](../app/integrations/page.tsx); [marketplace orders](MARKETPLACE_ORDERS.md); [retired webhook marker](WORKFLOW_WEBHOOK_INTEGRATION.md).

### Billing — `/billing`
- **Purpose/capabilities:** Manage the site's Makinari plan, billing information, credits and eligible extras/trial/top-up options; inspect related billing history.
- **Use:** Review licensed resource capacity and credit balances before upgrading or buying additional capacity; activate an eligible trial only through its explicit action.
- **Limits:** Not merchant customer subscription management. Trial credits, purchased/protected balances and withdrawable funds have distinct rules; authoritative settlement owns paid upgrades.
- **Source:** [Billing](../app/billing/page.tsx); [trial](STARTUP_TRIAL.md); [credit reset](BILLING_CREDIT_RESET.md); [auto top-up](AUTO_TOP_UP.md).

### Security — `/security`
- **Purpose/capabilities:** Change account password, manage supported MFA, API keys, robot sessions and allowed domains.
- **Use:** Secure the account and maintain only the credentials/sessions/domains needed by authorized integrations.
- **Limits:** Account authentication controls and site resource permissions are different. Treat keys and reusable sessions as credentials, not shareable reference material.
- **Source:** [Security page](../app/security/page.tsx); [security policy](SECURITY.md); [resource provenance](SECURITY_RESOURCE_PROVENANCE.md).

## Public commerce and buyer portal

See [the companion guide](MODULES_COMMERCE_AND_ACCOUNT.md#public-commerce-and-buyer-portal)
for Shop, Marketplace, checkout, booking, buyer account tools, and public documents.

## Cross-module workflows

| Goal | Typical path | Completion evidence |
| --- | --- | --- |
| Develop and convert an audience | Segments → People → Leads → Campaigns / Chat → Deals → Quotations | Eligible checkout/order plus actual settlement, not pipeline value |
| Sell in store | Catalog + Inventory + Price Lists/Promotions → POS → Orders / Order Lines → Shipments | Confirmed payment and appropriate operational fulfillment |
| Sell online | Catalog + Shop Settings → Shop / Marketplace → Cart → Customer Order → Buyer Library or fulfillment | Settled order and authorized entitlement/delivery state |
| Admit a booked customer | Calendar/Catalog → Booking → Reservations → Check-in | Confirmed admission/redemption, not just a booking or identity QR |
| Register visitors | Visit Settings → Physical/online Visits → Visit record | Required recorded terms/evidence; not automatic purchase/access |
| Collect outstanding invoices | Customer Subscription / Sale → Accounts Receivable → Invoice payment | Authoritative receipt and updated outstanding balance |
| Analyze finances | Sales + Bills + Transactions → Journal synchronization → Journal Entries → Finance Reports | Valid posted ledger in the selected currency; not wallet balance |
| Produce and distribute content | Context + Assets → Content Creator / Content → Connected destination → Social Report | Actual provider publication/delivery and later stored metrics |
| Execute AI work | Context + Agent Configuration + Skills → Requirement / Workflow → AI Workspace → Artifacts | Explicit terminal outcome and inspected work output |

## Limits and maintenance

- **Not current capabilities:** a complete Suppliers/Purchase Requests/Tenders/
  awards/receiving/certifications suite or the unified `/home` portal. See
  [procurement design](PROCUREMENT_AND_TENDERS_DESIGN.md) and
  [certification design](PROCUREMENT_CERTIFICATIONS_DESIGN.md); existing commerce
  purchases and vendor bills must not be presented as implementing those designs.
- **Legacy is not current navigation:** old FAQ references, dormant components and
  remaining feature folders do not establish supported standalone modules.
  Companies is covered as a detail surface; Experiments is not a current menu module.
- **Source review is not live acceptance:** external payment, voice, publishing,
  tracking, hardware and deployed migration coverage were not exercised for this guide.
- **Avoid false guarantees:** not every legacy search/sort/control is fully wired.
  This guide intentionally describes supported core workflows, not every visible button.
- **Update with product changes:** recheck all entries in
  [navigation configuration](../app/config/navigation-areas.ts), their delegated
  pages/actions and integration guides whenever adding/removing a module or changing
  capabilities. Preserve the distinction between configuration and execution.
- This is the functional starting point for current modules. The older
  [APP FAQ](../APP-FAQ.md) is historical background, not current behavior authority.