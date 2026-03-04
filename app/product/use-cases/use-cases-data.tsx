import { 
  Building, 
  Briefcase, 
  Users, 
  ShoppingCart, 
  Stethoscope, 
  GraduationCap, 
  Zap, 
  NetworkTree, 
  TrendingUp, 
  DollarSign,
  User,
  Globe,
  Rocket,
  AppWindow as MonitorSmartphone,
  PenTool,
  Building as   Store,
  Home
} from '@/app/components/ui/icons';

export const useCases = [
  // Solopreneurs
  {
    id: 'solopreneurs-general',
    name: 'Solopreneurs (General)',
    category: 'Solopreneurs',
    categories: ['All', 'Solopreneurs', 'B2B', 'B2C'],
    description: 'Multiply your operational capacity with agents that prospect, qualify, and schedule for you 24/7.',
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
    icon: <PenTool className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },

  // SMBs
  {
    id: 'smbs-general',
    name: 'SMBs (General)',
    category: 'SMBs',
    categories: ['All', 'SMBs', 'B2B', 'B2C'],
    description: 'Build a scalable sales engine without the need to hire large commercial teams.',
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
    icon: <Zap className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },

  // Startups
  {
    id: 'startups-general',
    name: 'Startups (General)',
    category: 'Startups',
    categories: ['All', 'Startups', 'B2B', 'B2C'],
    description: 'Find Product-Market Fit faster and scale your outbound to raise your next round.',
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
    icon: <Home className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },

  // Scale Ups
  {
    id: 'scaleups',
    name: 'Scale Ups',
    category: 'Scale Ups',
    categories: ['All', 'Scale Ups', 'B2B', 'B2C'],
    description: 'Standardize revenue processes and dominate new markets with global Go-To-Market infrastructure.',
    icon: <TrendingUp className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  },

  // Enterprise
  {
    id: 'enterprise',
    name: 'Enterprise',
    category: 'Enterprise',
    categories: ['All', 'Enterprise', 'B2B', 'B2B2B', 'B2B2C'],
    description: 'Align departments, eliminate data silos, and optimize operational efficiency across the organization.',
    icon: <Building className="w-8 h-8 text-slate-400" />,
    color: 'slate',
    status: 'active'
  },

  // B2B Specific
  {
    id: 'b2b-accounting',
    name: 'Accounting Firms',
    category: 'B2B',
    categories: ['All', 'B2B', 'SMBs', 'Enterprise'],
    description: 'Automate the acquisition of new corporate clients and streamline prospect follow-ups.',
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
    icon: <Globe className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },

  // B2C Specific
  {
    id: 'b2c-real-estate',
    name: 'Real Estate',
    category: 'B2C',
    categories: ['All', 'B2C', 'SMBs', 'Enterprise', 'Solopreneurs'],
    description: 'Qualify potential buyers and automate property follow-ups.',
    icon: <Building className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'b2c-healthcare',
    name: 'Clinics & Healthcare',
    category: 'B2C',
    categories: ['All', 'B2C', 'SMBs', 'Enterprise'],
    description: 'Attract and manage new patients through segmented campaigns and automatic follow-ups.',
    icon: <Stethoscope className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'b2c-education',
    name: 'Education & Courses',
    category: 'B2C',
    categories: ['All', 'B2C', 'Solopreneurs', 'SMBs', 'Enterprise'],
    description: 'Increase enrollment by qualifying leads and nurturing prospects until registration.',
    icon: <GraduationCap className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },

  // B2B2B Specific
  {
    id: 'b2b2b-manufacturing',
    name: 'Manufacturing & Suppliers',
    category: 'B2B2B',
    categories: ['All', 'B2B2B', 'Enterprise', 'Scale Ups'],
    description: 'Reach wholesale distributors who in turn sell to other businesses.',
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
    icon: <DollarSign className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  }
];
