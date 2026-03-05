import { NetworkTree, Building, ShoppingCart, DollarSign } from '@/app/components/ui/icons';

export const b2b2xUseCases = [
  // B2B2B Specific
  {
    id: 'b2b2b-manufacturing',
    name: 'Manufacturing & Suppliers',
    category: 'B2B2B',
    categories: ['All', 'B2B2B', 'Enterprise', 'Scale Ups'],
    description: 'Reach wholesale distributors who in turn sell to other businesses.',
    seoTitle: 'B2B2B Manufacturing Sales Automation | Wholesale | Makinari',
    seoDescription: 'Automate your manufacturing sales pipeline. Reach wholesale distributors and streamline the B2B2B procurement process with Makinari.',
    longDescription: `Manufacturers and large-scale industrial suppliers face an incredibly complex, multi-tiered value chain, needing to secure massive wholesale distributors who then, in turn, sell their products to local businesses, contractors, or specialized retailers. The B2B2B procurement process is historically archaic, relying on massive PDF catalogs, manual pricing matrices, and deeply entrenched relationships built over decades on the golf course. To rapidly scale market share and penetrate new geographic territories, manufacturers cannot rely solely on a handful of veteran field sales reps; they need a systematic, automated engine to identify, contact, and onboard new regional distributors at scale.

Makinari automates the immense heavy lifting of this expansion strategy. By leveraging intelligent Go-To-Market infrastructure, a Makinari AI agent systematically maps out every regional wholesaler, specialized distributor, and major procurement firm within a target territory. The agent initiates contact with the VP of Purchasing or Supply Chain Director, pitching your highly specific manufacturing capabilities, bulk pricing advantages, or superior supply chain reliability. 

When a distributor inevitably replies requesting a massive catalog or a custom pricing quote for a 50-SKU order, the Makinari agent instantly parses the request. It dynamically generates a personalized response containing the relevant product tear sheets, checks current inventory levels via API, and provides an accurate, tier-based pricing estimate. Furthermore, Makinari orchestrates the notoriously sluggish vendor onboarding process, automatically collecting compliance documents, tax IDs, and credit applications, ensuring your new distribution partners are ready to purchase in a fraction of the time it typically takes.`,
    keyWorkflows: [
      'Systematically identify and aggressively target large, high-volume regional wholesale distributors and complex procurement networks.',
      'Completely automate rapid, highly accurate responses for bulk pricing inquiries, inventory checks, and massive catalog requests.',
      'Streamline the tedious new supplier onboarding process, automatically collecting rigid compliance documents, tax forms, and credit applications.'
    ],
    expectedOutcomes: 'Expand your lucrative distribution network significantly faster into untapped territories, radically reduce the friction of manual vendor onboarding, and increase overall factory utilization rates by securing larger wholesale contracts.',
    timeToValue: '3-4 weeks',
    icon: <NetworkTree className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'b2b2b-franchises',
    name: 'Franchises',
    category: 'B2B2B',
    categories: ['All', 'B2B2B', 'Enterprise'],
    description: 'Expand your network by finding master franchisors and investment groups.',
    seoTitle: 'Franchise Sales & Expansion Automation | Makinari',
    seoDescription: 'Expand your franchise network efficiently. Automate outreach to master franchisors, investment groups, and qualified operators.',
    longDescription: `Growing a national or international franchise network is not simply a matter of selling a product; it is about recruiting highly qualified business operators and sophisticated investment groups who possess both the operational acumen and the massive liquid capital required to launch multiple locations. The franchise development process is incredibly rigorous. A franchisor must meticulously qualify a candidate's net worth, evaluate their prior business experience, and carefully guide them through the incredibly complex legal labyrinth of the Franchise Disclosure Document (FDD).

Makinari completely automates the highly strategic recruitment of these elite franchisees. Instead of relying on passive, low-quality leads from franchise portal websites, Makinari enables your franchise development team to proactively target specific financial profiles. An AI agent can scrape LinkedIn and financial databases for executives who recently exited a company, high-net-worth individuals, or existing multi-unit operators of non-competing brands. 

The Makinari agent sends a highly personalized, confidential outreach message detailing the exceptional unit economics and rapid ROI of your franchise model. When an operator expresses interest, the AI agent immediately qualifies their liquid investment capabilities upfront via a secure intake form. Once financially qualified, Makinari seamlessly automates the legally mandated distribution and tracking of the massive Franchise Disclosure Document (FDD), ensuring strict compliance while coordinating regional discovery days, executive interviews, and final real estate site selection meetings directly onto the development team's calendar.`,
    keyWorkflows: [
      'Proactively target and rigorously qualify potential multi-unit franchisees, master franchisors, and private equity groups based on strict liquid capital requirements.',
      'Completely automate the legally compliant distribution, electronic signature tracking, and follow-up of the complex Franchise Disclosure Document (FDD).',
      'Seamlessly coordinate the massive logistical undertaking of scheduling regional discovery days, executive team interviews, and real estate site tours.'
    ],
    expectedOutcomes: 'Dramatically accelerate the expansion of your national franchise network, ensure your highly paid development team only spends time with financially qualified, high-intent operators, and drastically reduce the time-to-launch for new units.',
    timeToValue: '3 weeks',
    icon: <Building className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },

  // B2B2C Specific
  {
    id: 'b2b2c-retail',
    name: 'Retail through Distributors',
    category: 'B2B2C',
    categories: ['All', 'B2B2C', 'Enterprise', 'Scale Ups'],
    description: 'Empower your sales channels (B2B) so they can better reach the end consumer (C).',
    seoTitle: 'B2B2C Retail Channel Sales Automation | Makinari',
    seoDescription: 'Empower your retail channels. Automate B2B distribution sales while providing tools to help them reach the end consumer.',
    longDescription: `Consumer brands that rely primarily on selling through vast networks of retail distributors, big-box stores, or independent boutique shops face an incredibly difficult dual challenge: they must constantly manage the B2B relationship to ensure the retailer keeps their product on the shelf, while simultaneously executing marketing campaigns that influence the end B2C purchase to drive actual foot traffic. The brand is entirely dependent on the retailer's ability to sell, yet often lacks the direct tools to help them succeed at the local level.

Makinari serves as the ultimate bridge in the B2B2C retail environment. For the B2B relationship, Makinari automates the critical task of inventory management and channel enablement. A Makinari AI agent seamlessly integrates with your ERP to monitor wholesale purchasing patterns. If an independent retailer hasn't re-ordered your flagship product in 45 days, the agent automatically triggers a highly personalized email to the store owner, highlighting a new bulk-discount promotion or a seasonal restock incentive, ensuring you never lose valuable shelf space to a competitor.

Furthermore, Makinari empowers your channel partners to drive B2C demand. Your brand can provide a white-labeled instance of Makinari to your top-tier retailers, allowing them to instantly deploy localized, co-marketing SMS or email campaigns to their own customer lists. By providing the exact messaging, the promotional offer, and the automated AI delivery mechanism, you make your brand the absolute easiest product in their store to sell, forging unshakeable loyalty with your distribution network while skyrocketing end-consumer sales.`,
    keyWorkflows: [
      'Completely automate inventory monitoring and intelligent re-order prompts for your massive network of independent retail partners and distributors.',
      'Seamlessly coordinate and deploy localized, co-branded marketing campaigns enabling your retailers to aggressively drive local end-consumer foot traffic.',
      'Streamline complex channel partner onboarding, automate product education, and distribute dynamic visual merchandising guidelines.'
    ],
    expectedOutcomes: 'Massively increase overall channel sales volume, forge unshakeable partner loyalty by making your brand the easiest one to sell, and completely eliminate out-of-stock scenarios at the local retail level.',
    timeToValue: '3-4 weeks',
    icon: <ShoppingCart className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  },
  {
    id: 'b2b2c-insurance',
    name: 'Insurance & Brokers',
    category: 'B2B2C',
    categories: ['All', 'B2B2C', 'Enterprise', 'SMBs'],
    description: 'Equip your network of agents (B2B) with tools to close policies (C).',
    seoTitle: 'Insurance Agency & Broker Automation | B2B2C | Makinari',
    seoDescription: 'Equip your insurance brokers with powerful AI tools. Automate policy renewals, lead qualification, and agent recruitment.',
    longDescription: `Major insurance carriers—whether focused on life, health, auto, or commercial property and casualty—rely overwhelmingly on massive, decentralized networks of independent brokers and captive agencies to sell policies to the end consumer. The carrier's growth is entirely constrained by two factors: their ability to continuously recruit top-performing independent agencies (the B2B motion), and the individual broker's ability to efficiently process consumer leads and retain existing policyholders (the B2C motion).

Makinari provides a revolutionary dual-engine for the insurance industry. First, the carrier utilizes Makinari's AI agents to aggressively recruit high-producing independent agencies. The AI systematically targets top local brokers, pitches the carrier's superior commission structures or innovative new policy products, and entirely automates the complex, heavily regulated agent contracting and appointment process.

Second, the carrier deploys Makinari as a powerful, white-labeled technological advantage for those newly recruited brokers. A local insurance agent is often overwhelmed by low-quality internet leads and the massive administrative burden of annual policy renewals. Makinari equips that local broker with an AI agent that instantly engages every inbound consumer lead via SMS, pre-qualifies their specific coverage needs, collects preliminary underwriting data, and schedules a consultation. Crucially, the AI agent also automates the entire policy renewal lifecycle, sending timely reminders 60, 30, and 15 days before expiration, dynamically offering cross-sell opportunities (e.g., bundling auto and home), and drastically improving retention across the entire carrier network.`,
    keyWorkflows: [
      'Completely automate the highly competitive recruitment, rigid compliance onboarding, and state appointment of independent insurance brokers and agencies.',
      'Provide powerful, white-labeled AI agents for local brokers to instantly qualify inbound consumer internet leads and collect vital preliminary underwriting data.',
      'Execute highly segmented, automated cross-selling campaigns and critical policy renewal reminders across the entire decentralized broker network.'
    ],
    expectedOutcomes: 'Aggressively expand your national independent broker network, drastically improve consumer policy retention rates, and significantly increase the average policies-per-household metric across all consumer segments.',
    timeToValue: '3-4 weeks',
    icon: <DollarSign className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  }
];
