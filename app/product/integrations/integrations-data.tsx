import React from 'react';
import { 
  SiSlack, SiGmail, SiLinkedin, SiWhatsapp, 
  SiHubspot, SiSalesforce, SiStripe, SiNotion, 
  SiAirtable, SiOpenai, SiPostgresql, SiSupabase, 
  SiGooglesheets, SiZendesk, SiShopify, SiMailchimp, SiDiscord,
  SiFacebook, SiX, SiInstagram, SiTiktok, SiThreads,
  SiBluesky, SiYoutube, SiPinterest, SiGoogle
} from 'react-icons/si';

export const categories = [
  "All",
  "CRM",
  "Communication",
  "Productivity",
  "Database",
  "AI & ML",
  "Social Media"
];

export const integrations = [
  {
    id: 'slack',
    name: 'Slack',
    category: 'Communication',
    description: 'Send notifications, create channels, and manage messages directly from Makinari.',
    icon: <SiSlack className="w-8 h-8 text-[#E01E5A]" />,
    status: 'active',
    isOpenClaw: true
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'Communication',
    description: 'Automate email outreach, read incoming messages, and draft responses.',
    icon: <SiGmail className="w-8 h-8 text-[#EA4335]" />,
    status: 'active',
    isOpenClaw: true,
    isCore: true
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    category: 'Social Media',
    description: 'Automate connections, send messages, and publish posts automatically.',
    icon: <SiLinkedin className="w-8 h-8 text-[#0A66C2]" />,
    status: 'active',
    isOpenClaw: true
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    category: 'Communication',
    description: 'Engage with customers via WhatsApp Business API seamlessly.',
    icon: <SiWhatsapp className="w-8 h-8 text-[#25D366]" />,
    status: 'active',
    isOpenClaw: true,
    isCore: true
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    description: 'Sync contacts, deals, and activities between Makinari and HubSpot.',
    icon: <SiHubspot className="w-8 h-8 text-[#FF7A59]" />,
    status: 'active',
    isOpenClaw: true
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'CRM',
    description: 'Keep your Salesforce records up to date with AI-driven workflows.',
    icon: <SiSalesforce className="w-8 h-8 text-[#00A1E0]" />,
    status: 'beta',
    isOpenClaw: true
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Productivity',
    description: 'Trigger workflows based on new payments, subscriptions, and invoices.',
    icon: <SiStripe className="w-8 h-8 text-[#008CDD]" />,
    status: 'active',
    isOpenClaw: true,
    isCore: true
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Productivity',
    description: 'Create pages, update databases, and manage tasks in Notion.',
    icon: <SiNotion className="w-8 h-8 dark:text-white text-black" />,
    status: 'active',
    isOpenClaw: true
  },
  {
    id: 'airtable',
    name: 'Airtable',
    category: 'Database',
    description: 'Read and write data to your Airtable bases instantly.',
    icon: <SiAirtable className="w-8 h-8 text-[#18BFFF]" />,
    status: 'active',
    isOpenClaw: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'AI & ML',
    description: 'Use GPT models for text generation, analysis, and data extraction.',
    icon: <SiOpenai className="w-8 h-8 dark:text-white text-black" />,
    status: 'active',
    isOpenClaw: true,
    isCore: true
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'Database',
    description: 'Connect directly to your Postgres database to read and write records.',
    icon: <SiPostgresql className="w-8 h-8 text-[#4169E1]" />,
    status: 'active',
    isOpenClaw: true,
    isCore: true
  },
  {
    id: 'supabase',
    name: 'Supabase',
    category: 'Database',
    description: 'Integrate with Supabase auth, database, and storage services.',
    icon: <SiSupabase className="w-8 h-8 text-[#3ECF8E]" />,
    status: 'active',
    isOpenClaw: true,
    isCore: true
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    category: 'Productivity',
    description: 'Update spreadsheets, create new rows, and trigger automations on changes.',
    icon: <SiGooglesheets className="w-8 h-8 text-[#34A853]" />,
    status: 'active',
    isOpenClaw: true
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    category: 'Communication',
    description: 'Manage support tickets, create users, and automate customer service.',
    icon: <SiZendesk className="w-8 h-8 text-[#03363D] dark:text-[#17494D]" />,
    status: 'active',
    isOpenClaw: true
  }
];


export const moreIntegrations = [
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'Productivity',
    description: 'Trigger actions on new orders, update inventory, and manage customers.',
    icon: <SiShopify className="w-8 h-8 text-[#95BF47]" />,
    status: 'active',
    isOpenClaw: true
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    category: 'CRM',
    description: 'Add subscribers, create campaigns, and track email performance.',
    icon: <SiMailchimp className="w-8 h-8 text-[#FFE01B] dark:text-[#FFE01B] bg-black rounded-full" />,
    status: 'active',
    isOpenClaw: true
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'Communication',
    description: 'Send channel messages, assign roles, and build custom chat bots.',
    icon: <SiDiscord className="w-8 h-8 text-[#5865F2]" />,
    status: 'beta',
    isOpenClaw: true
  },
  {
    id: 'facebook',
    name: 'Facebook',
    category: 'Social Media',
    description: 'Publish posts, read comments, and manage your Facebook page.',
    icon: <SiFacebook className="w-8 h-8 text-[#1877F2]" />,
    status: 'active',
    isOpenClaw: true,
    isCore: true
  },
  {
    id: 'x-twitter',
    name: 'X (Twitter)',
    category: 'Social Media',
    description: 'Schedule tweets, monitor mentions, and engage with your audience.',
    icon: <SiX className="w-8 h-8 dark:text-white text-black" />,
    status: 'coming_soon',
    isOpenClaw: true
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'Social Media',
    description: 'Publish photos and reels, track engagement, and reply to comments.',
    icon: <SiInstagram className="w-8 h-8 text-[#E4405F]" />,
    status: 'coming_soon',
    isOpenClaw: true
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'Social Media',
    description: 'Upload videos, manage your profile, and analyze performance.',
    icon: <SiTiktok className="w-8 h-8 dark:text-white text-black" />,
    status: 'coming_soon',
    isOpenClaw: true
  },
  {
    id: 'threads',
    name: 'Threads',
    category: 'Social Media',
    description: 'Share text updates and join public conversations automatically.',
    icon: <SiThreads className="w-8 h-8 dark:text-white text-black" />,
    status: 'coming_soon',
    isOpenClaw: true
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    category: 'Social Media',
    description: 'Post updates and interact with the decentralized social network.',
    icon: <SiBluesky className="w-8 h-8 text-[#0085FF]" />,
    status: 'coming_soon',
    isOpenClaw: true
  },
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'Social Media',
    description: 'Manage your channel, schedule video uploads, and track metrics.',
    icon: <SiYoutube className="w-8 h-8 text-[#FF0000]" />,
    status: 'coming_soon',
    isOpenClaw: true
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    category: 'Social Media',
    description: 'Create pins, manage boards, and automate visual discovery.',
    icon: <SiPinterest className="w-8 h-8 text-[#E60023]" />,
    status: 'coming_soon',
    isOpenClaw: true
  },
  {
    id: 'google-business',
    name: 'Google Business',
    category: 'Social Media',
    description: 'Update your business profile, post offers, and manage reviews.',
    icon: <SiGoogle className="w-8 h-8 text-[#4285F4]" />,
    status: 'coming_soon',
    isOpenClaw: true
  }
];

integrations.push(...moreIntegrations);
