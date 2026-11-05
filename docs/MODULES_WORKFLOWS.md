# Module workflows and shared limits

Companion to [the module guide](MODULES.md), updated **2026-11-04**. Core workflow
summaries retain their 2026-10-23 source review; procurement/account paths reflect
the newer local implementation. No live environment acceptance is claimed.

## Cross-module workflows

| Goal | Typical path | Completion evidence |
| --- | --- | --- |
| Develop and convert an audience | Segments → People → Leads → Campaigns / Chat → Deals → Quotations | Eligible checkout/order plus actual settlement, not pipeline value |
| Sell in store | Catalog + Inventory + Price Lists/Promotions → POS → Orders / Order Lines → Shipments | Confirmed payment and appropriate operational fulfillment |
| Sell online | Catalog + Shop Settings → Shop / Marketplace → Cart → Customer Order → Account Library or fulfillment | Settled order and authorized entitlement/delivery state |
| Admit a booked customer | Calendar/Catalog → Booking → Reservations → Check-in | Confirmed admission/redemption, not just a booking or identity QR |
| Register visitors | Visit Settings → Physical/online Visits → Visit record | Required recorded terms/evidence; not automatic purchase/access |
| Collect outstanding invoices | Customer Subscription / Sale → Accounts Receivable → Invoice payment | Authoritative receipt and updated outstanding balance |
| Analyze finances | Sales + Bills + Transactions → Journal synchronization → Journal Entries → Finance Reports | Valid posted ledger in the selected currency; not wallet balance |
| Produce and distribute content | Context + Assets → Content Creator / Content → Connected destination → Social Report | Actual provider publication/delivery and later stored metrics |
| Execute AI work | Context + Agent Configuration + Skills → Requirement / Workflow → AI Workspace → Artifacts | Explicit terminal outcome and inspected work output |
| Replenish low stock | Inventory Minimums → draft Request → human approval | Approved demand, not an automatic purchase or stock receipt |
| Buy through a tender | Suppliers + Request → Tender → publication approval → supplier submission → opened quotation → award/order approvals | Generated approved order; acceptance, stock receipt, bill allocation and payment remain distinct |
| Share supplier evidence | Home Profile → private revision → explicit submission selection → opening-aware buyer review | Pinned shared evidence, not authenticity or eligibility certification |

See [procurement boundaries](MODULES_PROCUREMENT.md#end-to-end-boundaries-and-verification)
and [account routes](MODULES_COMMERCE_AND_ACCOUNT.md#unified-account--home).

## Limits and maintenance

- **Procurement is partial, not absent:** Suppliers, Requests, human Approvals,
  Tenders, quotations/orders, Minimums and additive `/home` tools have implemented
  slices. Full receiving/bill allocation, organization credential authority,
  operational AI/escalation and complete buyer URL migration remain unfinished.
- **Legacy is not current navigation:** old FAQ references, dormant components and
  feature folders do not establish supported standalone modules. Companies is a
  detail surface; Experiments is not a current menu module.
- **Source review is not live acceptance:** external payment, voice, publishing,
  tracking, hardware and deployed migration coverage were not exercised for these guides.
- **Avoid false guarantees:** not every legacy search/sort/control is fully wired.
  The guides describe supported core workflows, not every visible button.
- **Update with product changes:** recheck [navigation](../app/config/navigation-areas.ts),
  delegated pages/actions and integration guides when adding/removing a module or
  changing capabilities. Preserve the distinction between configuration and execution.
- The older [APP FAQ](../APP-FAQ.md) is historical background, not current behavior authority.