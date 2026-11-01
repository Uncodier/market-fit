# First-class ICP modes: Marketing Agency and Content Creator

**Status:** Proposed product specification; no runtime changes implemented.
**Date:** 2026-10-31.
**Parent:** [UX personalization plan](UX_PERSONALIZATION_DESIGN.md).
**Contracts:** [Business catalog](UX_PERSONALIZATION_BUSINESS_CATALOG.md),
[execution rules](UX_PERSONALIZATION_EXECUTION_RULES.md), and
[template lifecycle](UX_PERSONALIZATION_TEMPLATES_AND_DECISIONS.md).

## 1. Explicit product decision

**Marketing Agency** and **Content Creator** are priority ICPs, not hidden examples
under professional services or entertainment. Present both as named, first-class
usage choices alongside the other business choices in onboarding and Site Settings.
Also offer both as curated personal experience lenses in My experience.

Stable usage IDs:

| Usage preset | Display label | Existing canonical business leaf |
| --- | --- | --- |
| marketing_agency | Marketing Agency | services.agency |
| content_creator | Content Creator | entertainment.creator |

These are explicit entry aliases to existing leaves, not two duplicate business
schemas or two additional leaves. The catalog remains 29 leaves. Selecting either
does not require choosing its associated industry; preserve the industry fact.

Keep **usage preset**, **functional role**, and **experience mode** distinct:
Marketing Agency/Content Creator is the usage lens; designer/marketing/owner is
the functional role; Focused/Standard/Complete controls presentation breadth.

## 2. Entry points and persistence

- **Onboarding:** show named cards before the industry/variant drill-down, with
  equal prominence and explicit helper text. Selection opens the questions below.
- **Site Settings:** Business & Experience includes a usage-preset selector with
  both choices. Preview changed vocabulary, priorities and template suggestions.
- **Personal preferences:** either lens may override presentation on this site or
  as an account default. Never create categories or connect client accounts from
  a personal choice. Site identity and business schema remain unchanged.
- **Team Settings:** show recommended roles for the site's selected usage preset;
  managers explicitly create/assign them. No automatic membership permission change.
- Store `usage_preset_id` in the versioned UX preference document, with site and
  personal scopes already defined by the parent. It is not a new permission field.
- At site setup, alias normalization selects the canonical leaf. For personal
  overrides, normalize the presentation lens only, not the site's leaf/industry.
- Existing sites must opt in. Do not auto-assign from connected social accounts,
  profile role, company name, domain, or headcount.

## 3. Marketing Agency: questions and decision tree

Questions, all explicit and skippable:

1. Do you manage your agency brand, client brands, or both?
2. What work matters most: campaigns, organic content, creative production,
   lead generation, client delivery, commercial proposals, or reporting?
3. Do you work alone or with account managers, strategists, creators and designers?
4. Are client brands represented by separate authorized sites or in one workspace?
5. Do you need briefs, deliverables, account plans, or documented review feedback?

```text
Marketing Agency selected -> normalize services.agency; preserve industry
|-- Agency brand only -> current site commercial/content work
|-- Client brands -> choose explicit authorized site; no cross-tenant aggregation
`-- Both -> separate scoped work; switching sites rebinds every destination
    |-- Campaign management -> campaigns + segments + promotions
    |-- Organic/content production -> contentCreator + content + assets
    |-- Lead generation -> leads + deals + campaigns; existing consent rules
    |-- Creative briefs -> editorial_briefs + production_briefs
    |-- Client delivery -> deliverables + controlCenter
    |-- Account strategy -> account_plans
    |-- Review feedback -> review_notes, not an approval workflow
    |-- Proposals/retainers -> quotations + subscriptions, if selected and supported
    `-- Reporting -> reportSocial/reportTraffic/reportPerformance as applicable
        -> same-site configured data; missing metrics remain unavailable

Role lens -> account strategy / campaign work / creation / design / delivery / owner
`-- Resolve personal overrides -> access -> mode -> actual state -> CTA/copy
```

Module priority: campaigns, contentCreator, content, assets, records, controlCenter.
Add selected sales/reporting modules from the tree; do not emphasize POS or inventory
unless explicitly requested. Existing All tools remains available by mode/access.

Recommended roles reuse existing UX IDs: owner for agency leadership, sales for
account/commercial management, marketing for strategist/campaign manager,
content_creator, designer, operations for delivery coordination, finance.
Friendly role labels are site UX labels; IDs and access roles remain unchanged.

## 4. Content Creator: questions and decision tree

1. Do you create for your own brand, sponsors/clients, or both?
2. What do you create: social posts, short video, long-form video, audio, blog,
   newsletters, or learning products?
3. What matters most: ideas/scripts, production, publishing, sponsorships,
   digital sales/courses, or performance review?
4. Do you work alone or with editors, designers and collaborators?
5. Which exact supported accounts/destinations are connected to the active site?

```text
Content Creator selected -> normalize entertainment.creator; preserve industry
|-- Own brand -> scoped brand content and assets
|-- Sponsored/client work -> sponsorship_briefs + deliverables + optional deals
`-- Both -> distinguish commitments and destination; no automatic account routing
    |-- Ideas/scripts -> editorial_briefs + content; existing teleprompter if applicable
    |-- Production -> contentCreator + assets + deliverables
    |-- Social/blog/newsletter -> configured supported publish destinations
    |   |-- Missing/inactive/ambiguous -> destination setup; no publish-ready claim
    |   `-- Exact authorized destination -> review -> explicit supported action
    |-- Sponsorships -> sponsorship_briefs + deals/quotations if needed
    |-- Digital products -> catalog + sales
    |-- Courses/coaching -> existing course/service catalog + reservations if needed
    `-- Performance -> reportSocial/reportTraffic where configured data exists

Solo/team -> guidance only -> selected role -> personal mode -> state/CTA/copy
```

Module priority: contentCreator, content, assets, records; secondary by selected
need: deals, quotations, catalog, sales, reservations, reportSocial, reportTraffic.
Do not rename commercial contacts to “Followers”: Leads is not a follower directory.

Roles: content_creator (including creator/editor labels), designer, marketing,
sales for sponsorship coordination, operations for production coordination, owner.
No assumption that a creator has a marketing team or wants agency-oriented copy.

## 5. Templates, fields and `/navigation` shortcuts

Reuse the 52-template registry; no new template IDs are required for these modes.
All installation, storage-key, relation, upgrade and privacy rules remain applicable.

| Mode | Template | Relevant existing fields/relations | Collection label / create CTA |
| --- | --- | --- | --- |
| Agency | account_plans | objective, next_review_on, next_step; approved person/staff | Client account plans / Add client account plan |
| Agency | production_briefs | scope, production_on, delivery_notes; person/staff | Client creative briefs / Add client creative brief |
| Agency | editorial_briefs | objective, audience, due_on; campaign/staff | Editorial briefs / Add editorial brief |
| Agency | deliverables | due_on, brief, delivery_notes; production brief/staff | Client deliverables / Add client deliverable |
| Agency | review_notes | scope, reviewed_on, summary, next_step; staff | Client review notes / Add client review note |
| Creator | editorial_briefs | objective, audience, due_on; campaign/staff | Ideas & scripts / Add content brief |
| Creator | production_briefs | scope, production_on, delivery_notes; person/staff | Production briefs / Add production brief |
| Creator | sponsorship_briefs | sponsor_ref, commitments, due_on; person/deal | Sponsorship briefs / Add sponsorship brief |
| Creator | deliverables | due_on, brief, delivery_notes; production brief/staff | Content deliverables / Add content deliverable |
| Creator | review_notes | scope, reviewed_on, summary, next_step; staff | Content review notes / Add content review note |

“Ideas & scripts” contains briefs and linked supported content, not a new video
editor or script-generation engine. Reviews are documented notes, not publication
approval, electronic signatures, client portals or authenticated client feedback.

Agency shortcut order: M(campaigns), C(account_plans), C(production_briefs),
V(deliverables,my_work), M(contentCreator), selected report modules.
Creator shortcut order: M(contentCreator), C(editorial_briefs), M(content),
M(assets), C(sponsorship_briefs) if selected, V(deliverables,my_work).
Emit collection links only after installation and access validation; offer gallery
suggestions otherwise. Preserve personal pin/dismiss intent and exact site scope.

## 6. CTAs, copy, icons and state outcomes

| Surface/state | Marketing Agency | Content Creator |
| --- | --- | --- |
| Onboarding card helper | Coordinate client campaigns, creative briefs, delivery and reporting. | Plan, create and publish content for your brand and sponsorships. |
| Workspace helper | Work on the selected brand's campaigns and deliverables. Switch sites explicitly for another client. | Turn content briefs into supported production and publishing workflows. |
| No templates, authorized installer | Review agency templates | Review creator templates |
| Installed empty brief collection | Add client creative brief | Add content brief |
| Main module navigation CTA | Open campaigns / Open Content Creator | Open Content Creator / Open content |
| Missing publishing connection | Configure this site's publishing destinations | Connect a supported publishing destination |
| Review notes helper | Record review context; notes do not authorize publishing. | Record revisions and feedback; publishing remains a separate action. |
| Missing metrics | Configure supported data sources; no report-ready claim | Configure supported data sources; no audience/revenue estimate |

Keep the canonical Content Creator module name in both modes; a mode is not a new
route. Use approved media/briefcase/checklist icons for agency collections and
media/pencil/checklist for creator collections, with localized accessible labels.
Guided/concise, error/empty/denied, and Complete use the shared state/copy contracts.
All five supported locales need distinct reviewed agency/creator terminology.

## 7. Tenant, publishing and product boundaries

- A client's site, social connection and publish destination are server-authorized
  resources, not names in a Record. No cross-client reads or sends from a selected
  persona, contact relation, brand label or client-provided tenant/account ID.
- In one site, grouping Records by client does not establish client-level ACLs.
  Restricted client collaboration requires separately implemented/tested controls;
  recommend separate authorized sites where isolation is required.
- Respect [exact connected-account destinations](CONTENT_CREATOR_DESTINATIONS.md).
  Removed or foreign accounts fail; never switch to another client/channel.
- Setup/personalization does not run AI, publish, schedule jobs, send outreach,
  spend advertising budget, create subscriptions or synchronize external accounts.
- No multi-client dashboard, campaign attribution, ad buying, influencer discovery,
  video timeline, client approval portal, follower analytics or royalty accounting
  is implied unless the existing capability is separately verified and supported.

## 8. Delivery and acceptance

Include both first-class modes in the initial onboarding/settings/personalization
release, not a future inferred industry branch. Existing lifecycle phases still apply.

Tests must prove: both named cards discoverable without industry drill-down; aliases
normalize to existing leaves; industry is retained; personal selection changes only
presentation; all relevant template IDs resolve; tailored questions/summaries/copy;
pins survive mode changes; Complete does not remove access restrictions; switching
clients resets destinations; missing connections and data show truthful setup states;
changing personas never sends, publishes or installs categories.

Acceptance scenarios: solo agency; multi-client team agency; solo creator with own
brand; creator with sponsorships; creator selling courses; agency with creator lens;
creator with agency lens; unauthorized foreign-client destination; both modes in
all five locales and all three experience modes. Use fictional disposable data.