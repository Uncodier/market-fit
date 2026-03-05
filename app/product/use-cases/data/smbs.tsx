import { Briefcase, Building as Store, Zap } from '@/app/components/ui/icons';

export const smbsUseCases = [
  {
    id: 'smbs-general',
    name: 'SMBs (General)',
    category: 'SMBs',
    categories: ['All', 'SMBs', 'B2B', 'B2C'],
    description: 'Build a scalable sales engine without the need to hire large commercial teams.',
    seoTitle: 'AI Sales Automation for SMBs | Scale Revenue | Makinari',
    seoDescription: 'Build a scalable sales engine for your small-to-medium business. Automate lead gen and sales operations without hiring a large commercial team.',
    longDescription: `Growing a small-to-medium business typically requires a massive investment in headcount for sales, marketing, and business development operations. For an SMB generating between $1M and $10M in revenue, the cost of hiring, training, and retaining a dedicated team of Sales Development Reps (SDRs) is often prohibitive, especially when SDR turnover rates are notoriously high. As the business owner or sales director, you are constantly battling to maintain lead volume while keeping Customer Acquisition Costs (CAC) manageable.

Makinari offers a powerful alternative: a completely automated, programmable revenue engine powered by intelligent AI agents. Generate, qualify, and distribute leads to your core closing team efficiently, effectively giving you an entire SDR department that never sleeps, never takes a sick day, and never asks for a raise. With Makinari, you can deploy a fleet of AI SDRs to prospect across multiple industries simultaneously, personalizing every single email, LinkedIn message, and SMS based on the exact pain points of the target prospect.

For example, a B2B commercial cleaning business can deploy an AI agent to target office managers in their city, dynamically inserting the square footage of the prospect's office building into the outreach email. When the office manager replies asking for pricing details, the AI agent instantly answers with a ballpark estimate and seamlessly routes the qualified lead to the head of sales to close the deal.

By automating the top-of-the-funnel prospecting, your existing human sales team can focus 100% of their time on high-value conversations, demos, and closing negotiations, drastically improving their win rates.`,
    keyWorkflows: [
      'Deploy autonomous SDR agents for highly targeted outbound prospecting across email and LinkedIn.',
      'Qualify and route inbound leads to the correct sales closer instantly, ensuring zero lead leakage.',
      'Automate CRM data entry and deal tracking, completely eliminating manual admin work for your reps.'
    ],
    expectedOutcomes: 'Lower your Customer Acquisition Cost (CAC) by up to 50%, double your top-of-funnel sales capacity without adding new headcount, and significantly improve your lead-to-close velocity.',
    timeToValue: 'Under 2 weeks',
    icon: <Briefcase className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'smbs-local-services',
    name: 'Local Service Providers',
    category: 'SMBs',
    categories: ['All', 'SMBs', 'B2C'],
    description: 'Book more appointments for plumbing, HVAC, or cleaning services with instant AI response to local leads.',
    seoTitle: 'AI Booking for Local Services | HVAC, Plumbing & Cleaning | Makinari',
    seoDescription: 'Capture more local leads. Makinari AI responds instantly to inquiries and books appointments for plumbing, HVAC, and cleaning service providers.',
    longDescription: `In local, home service industries such as plumbing, HVAC, electrical, and roofing, the speed to lead is the single most critical factor in winning a job. The first business to respond to a customer's inquiry usually secures the contract. If a homeowner has a burst pipe at 8:00 PM on a Saturday, they are calling down the Google search results list. If you miss that call, you lose a $5,000 job to a competitor.

Makinari ensures you never miss a lead by providing instant, AI-driven responses via SMS, WhatsApp, or web chat. It answers common pricing questions, qualifies the scope of the work needed, checks your dispatch calendar, and books the appointment directly into your service management system. For example, if a customer texts your business number asking for emergency HVAC repair, the Makinari AI agent instantly replies, asks for the make and model of the unit, confirms the service address, provides an emergency dispatch fee quote, and schedules the technician—all in under two minutes.

This level of immediate, 24/7 responsiveness dramatically improves your lead conversion rate from platforms like Google Local Services, Yelp, and Thumbtack. You no longer need to hire expensive after-hours answering services that just take messages. Makinari actually qualifies the job and secures the appointment, ensuring your technicians wake up to a fully booked schedule.`,
    keyWorkflows: [
      'Respond instantly to all inbound SMS, social media, and web chat leads, 24/7/365.',
      'Pre-qualify the service requirements, location, and urgency of the customer\'s problem.',
      'Book appointments directly into your dispatch software and collect preliminary dispatch fees.'
    ],
    expectedOutcomes: 'Capture up to 80% of after-hours and weekend leads, drastically improve your lead-to-appointment conversion rate, and reduce reliance on third-party answering services.',
    timeToValue: 'Under 1 week',
    icon: <Store className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'smbs-agencies',
    name: 'Marketing Agencies',
    category: 'SMBs',
    categories: ['All', 'SMBs', 'B2B'],
    description: 'White-label AI agents for your clients or use them internally to generate more qualified leads for your agency.',
    seoTitle: 'AI Agents for Marketing Agencies | White-Label Solutions | Makinari',
    seoDescription: 'Generate more qualified leads for your agency or white-label Makinari AI agents to offer scalable outbound solutions to your own clients.',
    longDescription: `Marketing and advertising agencies are under constant pressure to prove Return on Investment (ROI) to their clients. The biggest point of friction often isn't generating the lead—it's that the client's internal sales team fails to follow up with the lead fast enough, resulting in low conversion rates and the client ultimately blaming the agency for "poor quality leads." 

Makinari solves this massive retention problem by allowing marketing agencies to white-label intelligent AI follow-up agents. Instead of just delivering a spreadsheet of Facebook ad leads to your client, you deliver pre-qualified, booked appointments directly to their calendar. Set up dedicated outbound environments for your clients, automate client reporting, and guarantee the follow-up of every single lead your marketing campaigns generate.

Furthermore, marketing agencies can leverage Makinari as their own internal growth engine to sign high-ticket retainers. The agency space is incredibly saturated; sending generic cold emails offering "SEO services" no longer works. Makinari allows your agency to run highly sophisticated, intent-driven outbound campaigns. For instance, an AI agent can track when an e-commerce brand hires a new VP of Marketing, instantly triggering a personalized email pitching your agency's paid social expertise, significantly increasing your chances of securing a massive contract.`,
    keyWorkflows: [
      'Run highly sophisticated internal outbound campaigns targeting specific intent signals to land high-ticket retainers.',
      'Deploy custom AI receptionists and SDRs as a white-labeled service for your client accounts.',
      'Automate the immediate follow-up and qualification of leads generated by your paid ad campaigns to prove ROI.'
    ],
    expectedOutcomes: 'Add a highly profitable, high-margin recurring revenue stream through white-labeled AI services, dramatically improve client retention by proving ROI, and consistently sign larger retainer contracts.',
    timeToValue: 'Under 2 weeks',
    icon: <Zap className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  }
];
