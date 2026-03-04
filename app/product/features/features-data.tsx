import React from 'react';
import { 
  Search, Users, Building, Target, Megaphone, Mail, Phone, TrendingUp, Bot, NetworkTree, CheckSquare, Zap, Clock, ShieldCheck, User, Star, CreditCard, DollarSign, PieChart, BarChart, Video
} from '@/app/components/ui/icons';

export const features = [
  // Find Stage
  {
    id: 'tam-sourcing',
    name: 'TAM Sourcing',
    stage: 'Find',
    category: 'Discovery',
    description: 'Identify and build your total addressable market with precision targeting and intent data.',
    icon: <Search className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'contact-enrichment',
    name: 'Contact Enrichment',
    stage: 'Find',
    category: 'Data',
    description: 'Automatically append missing contact details like emails, phone numbers, and social profiles.',
    icon: <User className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'company-enrichment',
    name: 'Company Enrichment',
    stage: 'Find',
    category: 'Data',
    description: 'Get deep insights into target companies including tech stack, revenue, and headcount.',
    icon: <Building className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'intent-signals',
    name: 'Intent Signals',
    stage: 'Find',
    category: 'Discovery',
    description: 'Know exactly when accounts are actively researching solutions like yours.',
    icon: <Zap className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  {
    id: 'lead-scoring',
    name: 'Lead Scoring',
    stage: 'Find',
    category: 'AI',
    description: 'Prioritize your outreach based on automated engagement and fit scoring.',
    icon: <Star className="w-8 h-8 text-orange-400" />,
    color: 'orange',
    status: 'active'
  },
  
  // Contact Stage
  {
    id: 'domain-inbox',
    name: 'Domain & Inbox Purchase',
    stage: 'Contact',
    category: 'Infrastructure',
    description: 'Instantly buy and configure sending domains and inboxes without technical setup.',
    icon: <CreditCard className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },
  {
    id: 'inbox-warming',
    name: 'Inbox Warming',
    stage: 'Contact',
    category: 'Deliverability',
    description: 'Automatically warm up your email infrastructure to ensure maximum deliverability.',
    icon: <CheckSquare className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },
  {
    id: 'sequencing',
    name: 'Sequencing',
    stage: 'Contact',
    category: 'Outreach',
    description: 'Build multi-channel, multi-step automated sequences that drive replies.',
    icon: <NetworkTree className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },
  {
    id: 'dialer',
    name: 'Dialer',
    stage: 'Contact',
    category: 'Outreach',
    description: 'Make and log calls directly from your browser with local presence dialing.',
    icon: <Phone className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'coming_soon'
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    stage: 'Contact',
    category: 'Meetings',
    description: 'Let prospects book time on your calendar directly from your outreach.',
    icon: <Clock className="w-8 h-8 text-blue-400" />,
    color: 'blue',
    status: 'active'
  },

  // Sell Stage
  {
    id: 'ad-management',
    name: 'Ad Management',
    stage: 'Sell',
    category: 'Marketing',
    description: 'Launch and optimize campaigns across multiple platforms from one interface.',
    icon: <Megaphone className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'inbound-automation',
    name: 'Inbound Automation',
    stage: 'Sell',
    category: 'Marketing',
    description: 'Instantly capture and route inbound leads to the right rep with full context.',
    icon: <Zap className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'seo-content',
    name: 'SEO & Content Automation',
    stage: 'Sell',
    category: 'Marketing',
    description: 'Generate high-ranking content and optimize your site automatically.',
    icon: <PieChart className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'smart-composer',
    name: 'Smart Email Composer',
    stage: 'Sell',
    category: 'AI',
    description: 'Draft hyper-personalized emails instantly using account context and AI.',
    icon: <Mail className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'smart-logging',
    name: 'Smart Task Logging',
    stage: 'Sell',
    category: 'Productivity',
    description: 'Automatically log all activities and sync them to your CRM without data entry.',
    icon: <CheckSquare className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'active'
  },
  {
    id: 'meet-recording',
    name: 'Meet Recording',
    stage: 'Sell',
    category: 'Sales',
    description: 'Automatically record, transcribe, and analyze your sales meetings for actionable insights.',
    icon: <Video className="w-8 h-8 text-emerald-400" />,
    color: 'emerald',
    status: 'coming_soon'
  },

  // Manage Stage
  {
    id: 'crm',
    name: 'CRM',
    stage: 'Manage',
    category: 'Core',
    description: 'A powerful, lightning-fast CRM built specifically for modern revenue teams.',
    icon: <Users className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  },
  {
    id: 'ai-copilot',
    name: 'Ask AI Copilot',
    stage: 'Manage',
    category: 'AI',
    description: 'Your intelligent assistant for account research, deal strategy, and content creation.',
    icon: <Bot className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  },
  {
    id: 'reporting',
    name: 'Reporting',
    stage: 'Manage',
    category: 'Analytics',
    description: 'Deep insights into your pipeline, team performance, and revenue forecasting.',
    icon: <PieChart className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  },
  {
    id: 'workflows',
    name: 'Workflows',
    stage: 'Manage',
    category: 'Automation',
    description: 'Build powerful custom automations without writing a single line of code.',
    icon: <NetworkTree className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  },
  {
    id: 'integrations',
    name: 'Integrations',
    stage: 'Manage',
    category: 'Core',
    description: 'Connect seamlessly with all your favorite tools across your revenue stack.',
    icon: <Zap className="w-8 h-8 text-violet-400" />,
    color: 'violet',
    status: 'active'
  }
];
