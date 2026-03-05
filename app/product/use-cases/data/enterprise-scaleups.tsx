import { TrendingUp, Building } from '@/app/components/ui/icons';

export const scaleupsEnterpriseUseCases = [
  {
    id: 'scaleups',
    name: 'Scale Ups',
    category: 'Scale Ups',
    categories: ['All', 'Scale Ups', 'B2B', 'B2C'],
    description: 'Standardize revenue processes and dominate new markets with global Go-To-Market infrastructure.',
    seoTitle: 'GTM Infrastructure for Scale Ups | Enter New Markets | Makinari',
    seoDescription: 'Standardize your revenue processes and dominate global markets. Makinari provides the programmable GTM infrastructure needed for Scale Ups.',
    longDescription: `As a startup successfully transitions into a Scale Up (post-Series B, hitting $10M+ ARR), the ad-hoc sales processes and founder-led growth tactics that worked early on completely break down. To sustain rapid growth, Scale Ups must aggressively enter entirely new geographic markets and launch adjacent product lines, which requires robust, highly programmable, and globally scalable Go-To-Market infrastructure. 

Makinari provides the unified architecture necessary to deploy multi-language, multi-region sales strategies simultaneously. Instead of hiring localized SDR teams in Germany, Spain, and France—a process that takes months of recruiting, onboarding, and training—Makinari allows you to instantly deploy native-language AI SDR agents in those new geographic markets. These AI agents can translate your existing, proven outbound playbooks, localize the cultural nuances of the messaging, and begin setting qualified appointments for your centralized Account Executives (AEs) within days.

Furthermore, as you expand your product suite, cross-selling becomes critical to increasing Net Revenue Retention (NRR). Makinari automates the analysis of your existing customer base, identifies accounts with a high propensity to buy your new product lines based on product usage telemetry, and automatically triggers an expansion campaign from their dedicated Customer Success Manager (CSM). By standardizing lead scoring and routing globally, Makinari eliminates the operational friction of hyper-growth.`,
    keyWorkflows: [
      'Instantly deploy localized, multi-language AI SDRs to aggressively test and penetrate new international geographic markets.',
      'Standardize complex lead scoring, enrichment, and global routing logic across distributed, multi-regional sales teams.',
      'Automate intelligent cross-selling and up-selling campaigns for new product lines to your existing user base.'
    ],
    expectedOutcomes: 'Successfully launch into new international markets 3x faster without massive upfront hiring costs, establish a predictable, scalable global revenue engine, and significantly increase Net Revenue Retention (NRR).',
    timeToValue: '3-4 weeks',
    icon: <TrendingUp className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    category: 'Enterprise',
    categories: ['All', 'Enterprise', 'B2B', 'B2B2B', 'B2B2C'],
    description: 'Align departments, eliminate data silos, and optimize operational efficiency across the organization.',
    seoTitle: 'Enterprise Revenue Architecture | RevOps & Automation | Makinari',
    seoDescription: 'Unify your Enterprise GTM motion. Eliminate data silos, align sales and marketing, and deploy custom programmatic AI solutions with Makinari.',
    longDescription: `Large enterprises universally suffer from massive operational inefficiencies: fragmented data across dozens of legacy systems, deeply misaligned sales and marketing departments, and sluggish execution speed. Revenue Operations (RevOps) teams spend the majority of their time simply trying to sync data between a bloated Salesforce instance, Marketo, and Outreach, rather than actually engineering revenue.

Makinari serves as the ultimate, unified orchestration layer for Enterprise RevOps. By utilizing our advanced Model Context Protocol (MCP) and custom headless APIs, enterprises can securely connect their proprietary data warehouses directly to autonomous AI agents. This enables the execution of incredibly complex, highly personalized Account-Based Marketing (ABM) campaigns at an unprecedented global scale.

For example, an enterprise selling a $500k cybersecurity solution can orchestrate a multi-threaded ABM campaign targeting the Fortune 500. A Makinari agent can automatically map out the 15-person buying committee at a target account, analyze the company's recent 10-K filings for cybersecurity risk disclosures, and deploy a hyper-personalized, coordinated sequence of emails, direct mail triggers, and LinkedIn messages to the CISO, CIO, and CFO simultaneously. Makinari perfectly aligns marketing's air cover with sales' ground troops, eliminating data silos and automating global revenue forecasting, pipeline hygiene, and deal progression.`,
    keyWorkflows: [
      'Orchestrate and execute highly complex, multi-threaded Account-Based Marketing (ABM) campaigns at a massive global scale.',
      'Unify CRM, marketing automation, data warehouses, and proprietary internal data securely via the Model Context Protocol (MCP).',
      'Automate global revenue forecasting, enforce rigid pipeline hygiene, and eliminate the manual data entry burden on enterprise AEs.'
    ],
    expectedOutcomes: 'Eliminate millions of dollars in operational inefficiencies and software redundancy, perfectly align global sales and marketing motions, and drastically improve enterprise-level win rates and deal velocity.',
    timeToValue: '4-8 weeks',
    icon: <Building className="w-8 h-8 text-slate-400" />,
    color: 'slate',
    status: 'active'
  }
];
