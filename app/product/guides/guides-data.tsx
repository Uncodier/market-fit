import { 
  Mail, 
  Target, 
  Users, 
  Calendar, 
  MessageSquare, 
  TrendingUp, 
  Briefcase,
  Layers,
  Zap,
  BookOpen
} from '@/app/components/ui/icons';
import { LinkedInIcon } from '@/app/components/ui/social-icons';

export const guides = [
  {
    id: 'cold-email-mastery',
    name: 'Cold Email Mastery',
    category: 'Outbound',
    categories: ['All', 'Outbound', 'Sales'],
    description: 'Learn how to set up, optimize, and scale your cold email infrastructure for maximum deliverability and reply rates.',
    icon: <Mail className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },
  {
    id: 'linkedin-social-selling',
    name: 'LinkedIn Social Selling',
    category: 'Outbound',
    categories: ['All', 'Outbound', 'Sales'],
    description: 'A step-by-step guide to building authority and generating high-quality leads directly on LinkedIn.',
    icon: <LinkedInIcon className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },
  {
    id: 'account-based-marketing',
    name: 'Account-Based Marketing (ABM)',
    category: 'Strategy',
    categories: ['All', 'Strategy', 'Marketing', 'Sales'],
    description: 'How to target high-value accounts with personalized campaigns across multiple channels.',
    icon: <Target className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'lead-qualification-framework',
    name: 'Lead Qualification Frameworks',
    category: 'Sales',
    categories: ['All', 'Sales', 'Strategy'],
    description: 'Implement BANT, MEDDIC, and other frameworks to ensure your sales team only talks to qualified prospects.',
    icon: <Users className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'automated-meeting-scheduling',
    name: 'Automated Scheduling',
    category: 'Sales',
    categories: ['All', 'Sales', 'Inbound'],
    description: 'Reduce friction in the buyer journey by automating how prospects book meetings with your team.',
    icon: <Calendar className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  },
  {
    id: 'omnichannel-follow-up',
    name: 'Omnichannel Follow-ups',
    category: 'Marketing',
    categories: ['All', 'Marketing', 'Outbound'],
    description: 'Create cohesive follow-up sequences across email, LinkedIn, SMS, and WhatsApp.',
    icon: <MessageSquare className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'gtm-strategy-launch',
    name: 'GTM Strategy & Launch',
    category: 'Strategy',
    categories: ['All', 'Strategy', 'Marketing'],
    description: 'The complete playbook for launching a new product or entering a new market successfully.',
    icon: <TrendingUp className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  },
  {
    id: 'b2b-growth-hacking',
    name: 'B2B Growth Hacking',
    category: 'Marketing',
    categories: ['All', 'Marketing', 'Strategy'],
    description: 'Unconventional strategies to rapidly scale your B2B user base and revenue.',
    icon: <Zap className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'sales-playbooks',
    name: 'Building Sales Playbooks',
    category: 'Sales',
    categories: ['All', 'Sales', 'Strategy'],
    description: 'How to document your sales process to onboard new reps faster and increase win rates.',
    icon: <BookOpen className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  }
];