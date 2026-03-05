import { Briefcase, Zap, TrendingUp, Globe } from '@/app/components/ui/icons';

export const b2bUseCases = [
  {
    id: 'b2b-accounting',
    name: 'Accounting Firms',
    category: 'B2B',
    categories: ['All', 'B2B', 'SMBs', 'Enterprise'],
    description: 'Automate the acquisition of new corporate clients and streamline prospect follow-ups.',
    seoTitle: 'AI Lead Generation for Accounting Firms | B2B Growth | Makinari',
    seoDescription: 'Grow your accounting or CPA firm. Automate the acquisition of corporate clients, streamline follow-ups, and book more consultations.',
    longDescription: `Accounting and CPA firms thrive on immense trust, meticulous attention to detail, and timely, professional communication. However, the partners at these firms are often entirely consumed by the "busy season," spending up to 80 hours a week completing tax returns or managing complex audits. During this time, business development grinds to an absolute halt, and the firm struggles to acquire high-value, recurring corporate clients, resigning themselves to a stagnant book of business.

Makinari solves this critical growth bottleneck by allowing accounting firms to target rapidly growing businesses that desperately need robust financial advisory services—without requiring any partner time for manual prospecting. By tracking public signals, a Makinari AI agent can continuously monitor when a startup in your city closes a Series A funding round. It automatically triggers a highly personalized congratulatory email to the CEO and CFO, seamlessly transitioning into an offer for fractional CFO services or a complimentary audit of their newly complicated capitalization table.

Furthermore, Makinari entirely automates the initial qualification of incoming consultation requests. Instead of a highly-paid partner spending 30 minutes on a "bad fit" prospect who just wants a basic personal tax return, the AI agent asks specific intake questions about entity structure, annual revenue, and accounting software. Only highly qualified corporate prospects are then routed directly to the appropriate partner's calendar, completely streamlining the firm's growth trajectory.`,
    keyWorkflows: [
      'Target funded startups, rapidly scaling SMBs, and mid-market companies with automated, highly personalized financial advisory pitches.',
      'Automate the exhaustive intake process and follow-up for complex corporate tax consultation requests, entirely replacing manual qualification.',
      'Nurture the existing book of business automatically, analyzing client profiles for lucrative fractional CFO, audit, or M&A advisory upsells.'
    ],
    expectedOutcomes: 'Increase high-value, recurring corporate client acquisition by up to 30%, completely eliminate partner hours wasted on manual prospecting or unqualified consultations, and ensure massive firm scalability.',
    timeToValue: '2 weeks',
    icon: <Briefcase className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },
  {
    id: 'b2b-software',
    name: 'Software & SaaS',
    category: 'B2B',
    categories: ['All', 'B2B', 'Startups', 'Scale Ups', 'Enterprise'],
    description: 'Scale your outbound sales and automatically qualify leads for your sales team.',
    seoTitle: 'B2B SaaS Sales Automation | Scale Outbound | Makinari',
    seoDescription: 'Scale your SaaS outbound sales. Automatically qualify trial users, orchestrate intent-driven outreach, and close more software deals.',
    longDescription: `The B2B SaaS landscape has become hyper-competitive; generic outbound blasts and basic "request a demo" forms are no longer enough. Modern software buyers demand deeply personalized buying experiences, and reaching the right buyer at the exact moment of intent is absolutely critical to winning the deal. 

Makinari enables SaaS companies to build highly sophisticated, entirely intent-driven pipelines. By integrating deeply with your product telemetry (e.g., Mixpanel, Segment) and third-party data providers (e.g., Clearbit, Apollo), Makinari's AI agents orchestrate a truly programmable GTM motion. For example, if a freemium user from an Enterprise target account hits a specific feature usage limit—say, inviting their 10th team member to the workspace—a Makinari agent automatically triggers a personalized email appearing to come directly from an Account Executive (AE). The email highlights their team's heavy usage, offers a seamless upgrade path to an Enterprise plan, and provides a direct calendar link to discuss volume pricing.

Makinari bridges the difficult gap between Product-Led Growth (PLG) and Sales-Led motions by automatically qualifying freemium and trial users into Product-Qualified Leads (PQLs). Furthermore, Makinari agents can monitor public job boards; if a target company posts a job for a "Salesforce Administrator," the agent instantly contacts the VP of Sales at that company, pitching your data hygiene software exactly when they are experiencing extreme pain with their CRM. This ensures your AEs spend 100% of their time engaged in active closing negotiations.`,
    keyWorkflows: [
      'Trigger highly personalized, context-aware outbound outreach based entirely on external intent signals like tech stack installations or new job postings.',
      'Automatically analyze product telemetry to qualify thousands of freemium or trial users into high-value Product-Qualified Leads (PQLs) for your sales team.',
      'Automate complex, multi-stakeholder renewal and expansion campaigns for Customer Success teams, drastically reducing churn and increasing Net Dollar Retention.'
    ],
    expectedOutcomes: 'Double your pipeline generation velocity, significantly increase free-to-paid conversion rates by executing perfectly timed, contextual touchpoints, and increase the closing efficiency of your AEs.',
    timeToValue: '1-2 weeks',
    icon: <Zap className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },
  {
    id: 'b2b-consulting',
    name: 'Business Consulting',
    category: 'B2B',
    categories: ['All', 'B2B', 'Solopreneurs', 'SMBs'],
    description: 'Find growing companies that need your advisory services.',
    seoTitle: 'Client Acquisition for Business Consultants | B2B | Makinari',
    seoDescription: 'Find growing companies that need advisory services. Automate prospecting and book more executive meetings for your consulting firm.',
    longDescription: `Management, operations, and strategic business consultants sell highly specialized expertise to C-suite executives. The fundamental challenge of scaling a consulting firm is that to sell a six-figure advisory engagement, you must consistently get your proprietary frameworks in front of CEOs and decision-makers precisely when they are experiencing severe organizational pain. Mass marketing campaigns fall entirely flat with this demographic.

Makinari provides the ultimate solution by enabling consultants to scrape, monitor, and instantly act upon critical company news and trigger events. A Makinari AI agent can continuously scan the market for specific signals—such as a mid-market manufacturing firm announcing a massive Merger & Acquisition (M&A) deal, a sudden change in C-level leadership, or a public company reporting three consecutive quarters of declining earnings.

Immediately upon detecting these signals, the AI agent crafts a deeply researched, highly personalized outreach message to the CEO or board members. The email references the specific trigger event (e.g., "Congratulations on the acquisition of XYZ Corp") and seamlessly introduces your specific post-merger integration framework or turnaround consulting strategy. The agent then distributes your relevant thought-leadership content, whitepapers, or case studies, gently nurturing the executive prospect until a highly qualified strategic discovery call is scheduled directly on your calendar.`,
    keyWorkflows: [
      'Relentlessly monitor specific market trigger events (M&A activity, major funding rounds, executive turnover) for perfectly timed executive outreach.',
      'Automate the highly personalized distribution of proprietary thought-leadership content, frameworks, and case studies to C-suite prospects.',
      'Seamlessly qualify prospect timelines and budgets before scheduling strategic, high-stakes discovery calls directly onto the partner calendar.'
    ],
    expectedOutcomes: 'Significantly reduce the massive amount of partner time historically spent researching prospects, fill your calendar with highly qualified executive meetings, and drastically lower the Customer Acquisition Cost of a consulting engagement.',
    timeToValue: '2 weeks',
    icon: <TrendingUp className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },
  {
    id: 'b2b-logistics',
    name: 'Logistics & Transportation',
    category: 'B2B',
    categories: ['All', 'B2B', 'Scale Ups', 'Enterprise'],
    description: 'Connect with supply chain directors and operations managers.',
    seoTitle: 'B2B Sales Automation for Logistics & Transportation | Makinari',
    seoDescription: 'Connect with supply chain directors. Automate your B2B logistics sales pipeline, qualify freight leads, and grow your transportation business.',
    longDescription: `The global logistics, freight forwarding, and 3PL (Third-Party Logistics) industry is incredibly fast-paced, highly transactional, and fundamentally relationship-driven. However, freight brokers and logistics sales reps waste countless hours manually calculating spot rates, responding to low-volume quote requests, and making hundreds of generic cold calls to supply chain directors who are too busy fighting fires to answer the phone.

Makinari completely transforms the logistics sales process by automating both the rigorous outbound prospecting and the meticulous inbound quoting workflows. For outbound growth, a Makinari AI agent can systematically identify and target e-commerce directors and supply chain managers at rapidly growing retail brands. The agent pitches your firm's specific lane capacity or warehousing solutions exactly when those brands are expanding into new regions or experiencing seasonal volume spikes.

For inbound operations, Makinari is a game-changer. When a prospective shipper emails your team requesting a quote, the AI agent can intelligently extract the origin zip code, destination zip code, weight, and freight class directly from their attached PDF packing list or email body. The agent queries your internal pricing API or rate matrix, adds the appropriate margin, and replies to the shipper with an accurate quote within two minutes instead of the industry standard two hours. This incredible speed-to-quote guarantees a massive increase in won freight volume.`,
    keyWorkflows: [
      'Systematically target high-volume e-commerce, manufacturing, and retail supply chain directors automatically using intent signals like warehouse expansions.',
      'Completely automate the initial freight quote qualification process by extracting lane data from emails and querying internal rate APIs instantly.',
      'Run aggressive, automated re-engagement campaigns targeting dormant shippers with updated lane capacity, spot rates, and seasonal service offerings.'
    ],
    expectedOutcomes: 'Massively increase your active shipper base, achieve an industry-leading speed-to-quote, and reduce the crippling administrative overhead of manual rate calculation and data entry by up to 60%.',
    timeToValue: '2-3 weeks',
    icon: <Globe className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  }
];
