import { Rocket, Briefcase, Stethoscope, GraduationCap, Building, Home } from '@/app/components/ui/icons';

export const startupsUseCases = [
  {
    id: 'startups-general',
    name: 'Startups (General)',
    category: 'Startups',
    categories: ['All', 'Startups', 'B2B', 'B2C'],
    description: 'Find Product-Market Fit faster and scale your outbound to raise your next round.',
    seoTitle: 'GTM Automation for Startups | Scale Fast | Makinari',
    seoDescription: 'Find Product-Market Fit faster. Scale your outbound operations, gather rapid market feedback, and accelerate growth to raise your next round with Makinari.',
    longDescription: `For early-stage tech startups, speed of learning is the only sustainable competitive advantage. Before scaling, founders must rapidly test different value propositions, pricing models, and target personas to achieve true Product-Market Fit (PMF). The traditional approach is slow: hiring an expensive Head of Sales, building a large SDR team, and manually blasting generic cold emails for months.

Makinari completely rewrites the Go-To-Market playbook for early-stage companies. By deploying highly programmable AI agents, founders can simultaneously test 10 different value propositions across thousands of targeted prospects without increasing headcount or burning through seed funding. Makinari enables you to test different Go-To-Market hypotheses in real-time, instantly gathering statistically significant data on open rates, reply rates, and meeting booked rates for each persona.

For instance, a B2B SaaS startup building an HR tool can configure Makinari to A/B test a cost-saving message aimed at the CFO versus a productivity message aimed at the VP of HR. The AI agent sends out the personalized campaigns, analyzes the sentiment of the replies, and automatically schedules customer discovery interviews or product demos with interested prospects. 

Once PMF is established, Makinari seamlessly transitions from a discovery tool into a hyper-scalable outbound sales engine, fueling your pipeline to secure your next round of funding with undeniable traction metrics.`,
    keyWorkflows: [
      'A/B test different value propositions, messaging frameworks, and Ideal Customer Profiles simultaneously across thousands of prospects.',
      'Automate the massive outreach and scheduling required for qualitative customer discovery interviews.',
      'Scale your outbound sales motion exponentially the moment PMF is achieved, dramatically reducing Customer Acquisition Cost (CAC).'
    ],
    expectedOutcomes: 'Accelerate your path to Product-Market Fit by increasing customer interaction volume by 5x, achieving a predictable, scalable revenue engine globally without bloated marketing budgets.',
    timeToValue: 'Under 1 week',
    icon: <Rocket className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'startups-fintech',
    name: 'Fintechs',
    category: 'Startups',
    categories: ['All', 'Startups', 'B2B', 'B2C'],
    description: 'Scale user acquisition for financial products, automate onboarding, and improve customer support.',
    seoTitle: 'Fintech User Acquisition & Onboarding Automation | Makinari',
    seoDescription: 'Scale your fintech product. Automate secure user acquisition, streamline KYC/onboarding follow-ups, and improve financial customer support.',
    longDescription: `Fintech startups face incredibly unique challenges regarding user trust, regulatory compliance, and exceptionally complex onboarding flows. When a user creates an account for a new neobank, trading app, or B2B payment gateway, they are often hit with rigorous KYC/AML (Know Your Customer / Anti-Money Laundering) requirements. This friction causes massive drop-offs; users abandon the onboarding process when asked to upload sensitive documents.

Makinari helps fintechs scale user acquisition securely while automating the tedious, manual follow-ups required when users inevitably drop off during these critical onboarding stages. For example, if a user downloads your crypto trading app but stops after entering their email, the Makinari AI agent can trigger a secure SMS or WhatsApp message 15 minutes later. The message can politely remind them to complete their ID verification, address any security concerns by citing your bank-grade encryption protocols, and offer immediate assistance if they are having trouble scanning their driver's license.

Furthermore, fintechs demand hyper-personalized, ultra-secure customer support that builds trust. A generic chatbot frustrating a user who is trying to transfer $10,000 is a guaranteed way to increase churn. Makinari provides intelligent, context-aware AI agents that can rapidly verify a user's identity, intelligently answer complex financial product questions, and seamlessly hand off to a human compliance officer for sensitive transactions, ultimately increasing deposits and transaction volume.`,
    keyWorkflows: [
      'Automate highly complex abandoned cart/onboarding recovery sequences across email and secure SMS.',
      'Proactively answer security, compliance, and product FAQs instantly to build essential user trust.',
      'Scale B2B partnership outreach to secure API integrations, payment gateway partnerships, and channel sales.'
    ],
    expectedOutcomes: 'Recover up to 35% of abandoned KYC/onboarding flows, drastically reduce support response times to seconds, and significantly increase total transaction volume or Assets Under Management (AUM).',
    timeToValue: '2-3 weeks',
    icon: <Briefcase className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'startups-healthtech',
    name: 'Healthtechs',
    category: 'Startups',
    categories: ['All', 'Startups', 'B2B', 'B2C'],
    description: 'Connect with healthcare providers and patients securely to drive adoption of digital health solutions.',
    seoTitle: 'Healthtech Automation | Provider & Patient Outreach | Makinari',
    seoDescription: 'Drive adoption of your digital health solution. Securely automate outreach to healthcare providers, clinics, and patients with Makinari.',
    longDescription: `Selling into the healthcare industry requires navigating notoriously complex buying committees, strict compliance regulations (like HIPAA), and incredibly slow sales cycles. Healthtech companies must often convince a Chief Medical Officer of the clinical efficacy, the Head of IT of the security protocols, and the CFO of the financial ROI—all simultaneously. 

Makinari enables healthtech startups to meticulously map out and automate outreach to these massive clinical buying committees. Instead of a single SDR trying to track dozens of stakeholders across a hospital network, your programmable AI agent orchestrates multi-threaded campaigns. For instance, the agent can send a detailed, peer-reviewed clinical study to the Chief Medical Officer while simultaneously sending an ROI calculator spreadsheet to the hospital's CFO.

Beyond B2B sales, healthtech startups also face enormous challenges with patient adoption. If your startup provides a digital therapeutics app or remote patient monitoring hardware, getting patients to actually log in daily is critical. Makinari automates patient onboarding, sending gentle SMS reminders to log their vitals, answering preliminary medical device FAQs securely, and scheduling follow-up telemedicine appointments, significantly improving adherence rates.`,
    keyWorkflows: [
      'Map and deeply target complex buying committees within massive hospital networks and clinical groups.',
      'Automate long-term educational drip campaigns for clinical staff, sharing peer-reviewed studies and case reports.',
      'Streamline patient onboarding, medication adherence reminders, and telemedicine appointment scheduling.'
    ],
    expectedOutcomes: 'Shorten enterprise healthcare sales cycles by up to 30%, increase pilot program acceptance rates, and significantly improve patient adoption and adherence rates for digital health apps.',
    timeToValue: '2-4 weeks',
    icon: <Stethoscope className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'startups-edtech',
    name: 'Edtechs',
    category: 'Startups',
    categories: ['All', 'Startups', 'B2B', 'B2C'],
    description: 'Reach educational institutions and students to grow your user base and improve learning outcomes.',
    seoTitle: 'Edtech Go-To-Market Automation | Schools & Students | Makinari',
    seoDescription: 'Grow your Edtech user base. Automate outreach to school districts, universities, and students to accelerate adoption and enrollment.',
    longDescription: `Edtech startups operate in a unique environment where the end-user (students or teachers) is almost never the economic buyer (school district superintendents or university administrators). This necessitates running parallel Go-To-Market strategies: a bottom-up product-led growth (PLG) campaign targeting individual teachers for grass-roots adoption, and a top-down enterprise sales motion targeting the district administrators for district-wide licensing.

Makinari allows you to execute these complex, dual-funnel strategies seamlessly. For the top-down approach, an AI agent can analyze a specific school district's publicly available strategic goals for the academic year. If the district's primary goal is improving middle school math scores, the agent will automatically craft a highly personalized email to the superintendent citing that specific goal and offering a case study showing how your software improved math scores in a neighboring district.

For the bottom-up approach, Makinari automates product adoption campaigns. When a teacher signs up for a free trial, the AI agent monitors their usage. If they haven't created their first digital classroom within 48 hours, the agent sends an automated, helpful email offering a quick video tutorial. By automating both ends of the spectrum, you can drive massive user adoption and effectively convert free teacher accounts into lucrative district-wide enterprise contracts.`,
    keyWorkflows: [
      'Automate highly researched, top-down enterprise outreach to school district administrators and university provosts.',
      'Run intelligent, trigger-based bottom-up product adoption campaigns for teachers on freemium accounts.',
      'Nurture prospective students through the entire higher-education enrollment funnel, answering curriculum questions instantly.'
    ],
    expectedOutcomes: 'Increase enterprise pilot program requests by 50%, accelerate the conversion of free teacher accounts to paid district licenses, and dramatically improve student enrollment conversion rates.',
    timeToValue: '1-2 weeks',
    icon: <GraduationCap className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'startups-legaltech',
    name: 'Legaltechs',
    category: 'Startups',
    categories: ['All', 'Startups', 'B2B'],
    description: 'Automate outreach to law firms and corporate legal departments to showcase your tech solutions.',
    seoTitle: 'Legaltech Sales Automation | Reach Law Firms | Makinari',
    seoDescription: 'Automate your Legaltech sales pipeline. Target managing partners and corporate legal departments with highly personalized, intelligent outreach.',
    longDescription: `Law firms are notoriously traditional, incredibly hard to reach, and hyper-focused on billable hours. General, mass-blast marketing emails simply do not work in the legal sector. To sell legaltech software—whether it's AI contract review, e-discovery tools, or practice management software—you need hyper-personalized, heavily researched, case-study-driven outreach that proves immediate ROI to a managing partner.

Makinari enables your sales team to craft intelligent, highly customized messaging at scale. Instead of a generic pitch, your programmable AI agent can research a target law firm, identify their primary practice areas (e.g., intellectual property vs. corporate litigation), and automatically distribute specific case studies based on those exact practice areas. For example, the agent can pitch an e-discovery tool to a litigation partner by referencing a massive recent class-action lawsuit the firm handled, demonstrating exactly how many billable hours the tool would have saved during the document review phase.

Furthermore, lawyers guard their calendars fiercely. Makinari's AI agents can seamlessly negotiate demo scheduling over email, accommodating the erratic, high-pressure schedules of managing partners without requiring endless manual back-and-forth from your SDRs. This ensures your account executives only spend their time executing high-quality product demonstrations to highly qualified legal decision-makers.`,
    keyWorkflows: [
      'Automate highly personalized, deeply researched cold outreach to managing partners and corporate General Counsel (GC).',
      'Distribute specific, highly relevant case studies dynamically based on the firm\'s specific practice areas.',
      'Seamlessly negotiate and schedule software demos around incredibly tight, frequently changing legal calendars.'
    ],
    expectedOutcomes: 'Break into tier-1, historically impenetrable law firms faster, significantly increase demo booking rates with hard-to-reach managing partners, and shorten the typical 6-9 month legaltech sales cycle.',
    timeToValue: '2-3 weeks',
    icon: <Building className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'startups-proptech',
    name: 'Proptechs',
    category: 'Startups',
    categories: ['All', 'Startups', 'B2B', 'B2C'],
    description: 'Engage real estate agencies, property managers, and buyers to accelerate transactions.',
    seoTitle: 'Proptech GTM Automation | Real Estate & Property Managers | Makinari',
    seoDescription: 'Accelerate real estate transactions. Automate your Proptech platform\'s outreach to agencies, property managers, and buyers.',
    longDescription: `The real estate market moves incredibly fast, and Proptech startups operate in highly complex, multi-sided marketplace dynamics. To succeed, a Proptech platform must simultaneously engage multiple distinct stakeholders: onboarding independent real estate agents, pitching enterprise brokerages, convincing property managers, and fielding inquiries from end-consumer buyers and renters.

Makinari serves as the ultimate orchestration layer for these complex market dynamics. For the B2B side, Makinari automates the aggressive outreach and onboarding of new real estate professionals. An AI agent can target top-producing local agents on LinkedIn, pitch your platform's unique lead-generation or transaction-management capabilities, and automatically guide them through the software onboarding process. 

For the B2C side, Makinari manages the massive influx of property inquiries. When a buyer submits a viewing request for a property listing on your platform, the AI agent instantly engages the buyer via SMS to qualify their budget, timeline, and pre-approval status. It then automatically routes that highly qualified lead to the correct broker associated with the listing. Furthermore, Makinari can run automated re-engagement campaigns for stale property listings, prompting agents to lower the price or update the photos to accelerate the transaction liquidity of your marketplace.`,
    keyWorkflows: [
      'Automate the outbound recruitment, onboarding, and software training of new real estate agents and brokerages.',
      'Route thousands of consumer property inquiry leads instantly to the correct broker based on geography and listing ownership.',
      'Run automated re-engagement and price-reduction prompt campaigns for stale, aging property listings on your platform.'
    ],
    expectedOutcomes: 'Drastically accelerate the liquidity of your marketplace, rapidly scale your network of active real estate professionals, and reduce the average time-to-close on property transactions.',
    timeToValue: '2-3 weeks',
    icon: <Home className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  }
];
