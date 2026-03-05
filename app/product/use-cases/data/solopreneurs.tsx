import { User, AppWindow as MonitorSmartphone, PenTool } from '@/app/components/ui/icons';

export const solopreneurUseCases = [
  {
    id: 'solopreneurs-general',
    name: 'Solopreneurs (General)',
    category: 'Solopreneurs',
    categories: ['All', 'Solopreneurs', 'B2B', 'B2C'],
    description: 'Multiply your operational capacity with agents that prospect, qualify, and schedule for you 24/7.',
    seoTitle: 'AI Agents for Solopreneurs | Automate Your Prospecting | Makinari',
    seoDescription: 'Scale your solopreneur business with Makinari AI agents. Automate lead qualification, scheduling, and prospecting 24/7 without hiring an assistant.',
    longDescription: `As a solopreneur, your time is your most valuable asset, yet you are forced to wear every single hat—from CEO and lead developer to marketing manager and sales development rep (SDR). This constant context-switching destroys your ability to focus on deep work and severely limits your earning potential. Every hour spent manually scraping LinkedIn, sending cold emails, or playing calendar ping-pong with a prospect is an hour you aren't doing the actual billable work you are an expert in. 

Makinari empowers independent professionals to multiply their operational capacity by deploying custom, programmable AI agents that work tirelessly 24/7 in the background. Imagine no longer having to worry about pipeline generation. For example, a solo business consultant can configure a Makinari agent to monitor LinkedIn and specific industry forums for intent signals—such as a prospect asking for software recommendations or a company announcing a new round of funding. 

Once the signal is detected, the agent automatically drafts a highly personalized, context-aware outreach message, answers the prospect's initial questions based on your specific consulting frameworks, and handles the entire back-and-forth conversation until a discovery call is booked straight into your calendar.

By leveraging our intelligent Go-To-Market (GTM) infrastructure, you can maintain a constant, predictable pipeline of highly qualified leads, seamlessly handle administrative busywork, and focus entirely on delivering high-impact, transformative work to your clients. This isn't just about saving a few hours a week; it's about fundamentally changing the unit economics and the ultimate scalability of a one-person business.`,
    keyWorkflows: [
      'Automate initial email outreach and multi-channel prospecting to build a consistent pipeline without manual effort.',
      'Qualify inbound leads instantly via your website or social channels, ensuring you only speak to prospects with actual budget.',
      'Schedule appointments seamlessly directly into your calendar without the endless back-and-forth email chains.'
    ],
    expectedOutcomes: 'Increase your pipeline of booked meetings by up to 40% and save over 15 hours per week on manual data entry, lead research, and repetitive follow-ups, allowing you to take on more clients.',
    timeToValue: 'Under 3 days',
    icon: <User className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },
  {
    id: 'solopreneurs-digital-products',
    name: 'Digital Product Creators',
    category: 'Solopreneurs',
    categories: ['All', 'Solopreneurs', 'B2C'],
    description: 'Automate customer support, handle refund requests, and upsell your digital courses or templates.',
    seoTitle: 'Automation for Digital Product Creators | Upsell & Support | Makinari',
    seoDescription: 'Automate your digital product business. Let Makinari AI handle customer support, refund requests, and course upsells on autopilot.',
    longDescription: `Creators selling digital products, such as online courses, software templates, or e-books, operate in a high-volume, low-margin environment. When you sell a $50 product, you need thousands of customers to build a sustainable business. However, thousands of customers inevitably bring thousands of support tickets: "I can't access my course module," "How do I download the PDF?", or "Can I get a refund?". This endless stream of tier-1 support requests can quickly drown a solo creator, turning a passive income stream into an active nightmare.

Makinari acts as your 24/7 automated support and sales assistant, designed specifically to handle the unique challenges of the creator economy. When a customer submits a ticket, your AI agent instantly references your product documentation, FAQs, and policy guidelines to resolve common queries without human intervention. 

Beyond just support, Makinari is an automated revenue generator. For example, if a customer successfully completes your "Beginner SEO" course, the AI agent can automatically trigger a personalized email sequence congratulating them on their progress and offering a time-sensitive discount for your "Advanced Technical SEO Mastery" masterclass. If a customer requests a refund, the agent can automatically process it based on your exact refund window policies, or intelligently offer a 1-on-1 coaching call as an alternative to retain the revenue.

By automating your post-purchase customer journey, you can dramatically reduce support ticket volume by up to 70% while simultaneously increasing your average customer lifetime value (LTV) through timely, automated, and context-aware upselling.`,
    keyWorkflows: [
      'Instantly resolve tier-1 support tickets and FAQs to provide immediate value to your students or buyers.',
      'Automate the handling and routing of refund requests to comply strictly with your terms and conditions.',
      'Trigger highly targeted upsell and cross-sell campaigns immediately post-purchase or upon course completion.'
    ],
    expectedOutcomes: 'Recover dozens of hours every month previously lost to repetitive customer service tasks, while simultaneously increasing backend revenue by 20-30% through automated upsell sequences.',
    timeToValue: 'Under 1 week',
    icon: <MonitorSmartphone className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },
  {
    id: 'solopreneurs-freelancers',
    name: 'Freelancers & Consultants',
    category: 'Solopreneurs',
    categories: ['All', 'Solopreneurs', 'B2B'],
    description: 'Keep a steady stream of incoming client inquiries without spending hours on manual cold outreach.',
    seoTitle: 'Client Acquisition for Freelancers & Consultants | Makinari',
    seoDescription: 'Keep your freelance pipeline full. Automate cold outreach, lead qualification, and client onboarding with Makinari AI agents.',
    longDescription: `The feast-or-famine cycle is the single biggest hurdle for freelancers, independent contractors, and solo consultants. When you are busy executing client work during the "feast" months, you don't have time to prospect. Consequently, when the project ends, you find yourself staring at an empty pipeline, initiating the stressful "famine" phase. Makinari eliminates this vicious cycle entirely by running your outbound lead generation and client nurturing on complete autopilot.

By defining your exact Ideal Customer Profile (ICP), Makinari allows you to deploy AI agents that continuously discover, contact, and warm up prospects while you focus entirely on your billable client deliverables. For instance, a freelance UI/UX designer can instruct their agent to continuously monitor job boards, startup funding announcements, and social media for companies actively looking for design help. 

The agent will then send a hyper-personalized outreach message, seamlessly citing the company's recent funding round, and link directly to a highly relevant case study from the designer's portfolio. When the prospect replies with interest, the agent answers preliminary questions regarding pricing ranges and timelines, and pushes qualified leads directly to the freelancer's calendar. 

Furthermore, the agent can automate the nurturing of past clients, sending them periodic, value-driven check-ins to stimulate referral business and repeat engagements. With Makinari, you achieve a consistent, highly predictable client pipeline and completely eradicate the anxiety of the famine months.`,
    keyWorkflows: [
      'Run personalized, multi-step cold email and LinkedIn campaigns targeting specific decision-makers in your niche.',
      'Automatically nurture past and dormant clients to generate a steady stream of referrals and repeat business.',
      'Automate the initial onboarding data collection for new clients, sending contracts and intake forms instantly.'
    ],
    expectedOutcomes: 'Achieve a highly consistent, predictable client pipeline, completely eliminate the "famine" months caused by a lack of prospecting time, and increase your effective hourly rate by focusing only on delivery.',
    timeToValue: 'Under 3 days',
    icon: <PenTool className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  }
];
