import { Agent, AgentActivity } from "@/app/types/agents"

// Define agent activities based on roles
const growthLeadActivities: AgentActivity[] = [
  {
    id: "gl1",
    name: "Task Monitoring",
    description: "Track progress of assigned tasks and ensure timely completion of deliverables",
    estimatedTime: "15-20 min",
    successRate: 95,
    executions: 142,
    status: "available"
  },
  {
    id: "gl2",
    name: "Stakeholder Coordination",
    description: "Facilitate decision-making processes with key stakeholders and project owners",
    estimatedTime: "25-30 min",
    successRate: 91,
    executions: 87,
    status: "available"
  },
  {
    id: "gl3",
    name: "Vendor Management",
    description: "Monitor vendor relationships, deliverables and ensure alignment with project goals",
    estimatedTime: "30-35 min",
    successRate: 88,
    executions: 63,
    status: "available"
  },
  {
    id: "gl4",
    name: "Task Validation",
    description: "Review completed tasks against requirements and provide quality assurance",
    estimatedTime: "20-25 min",
    successRate: 94,
    executions: 98,
    status: "available"
  },
  {
    id: "gl5",
    name: "Team Coordination",
    description: "Facilitate cross-functional collaboration, resolve conflicts and align team efforts with strategic goals",
    estimatedTime: "25-35 min",
    successRate: 93,
    executions: 117,
    status: "available"
  },
  {
    id: "gl6",
    name: "Daily Stand Up",
    description: "Generate comprehensive daily team progress report with insights and next steps",
    estimatedTime: "10-15 min",
    successRate: 96,
    executions: 78,
    status: "available"
  },
  {
    id: "gl7",
    name: "Assign Leads",
    description: "Automatically assign leads to appropriate team members based on criteria and workload",
    estimatedTime: "5-10 min",
    successRate: 94,
    executions: 145,
    status: "available"
  }
];

const dataAnalystActivities: AgentActivity[] = [
  {
    id: "da1",
    name: "User Behavior Analysis",
    description: "Analyze user activity patterns and engagement metrics across website and mobile app",
    estimatedTime: "25-30 min",
    successRate: 93,
    executions: 112,
    status: "available"
  },
  {
    id: "da2",
    name: "Sales Trend Analysis",
    description: "Identify and interpret sales patterns, growth opportunities and conversion metrics",
    estimatedTime: "20-25 min",
    successRate: 95,
    executions: 87,
    status: "available"
  },
  {
    id: "da3",
    name: "Cost Trend Analysis",
    description: "Monitor expense patterns, identify cost optimization opportunities and ROI evaluation",
    estimatedTime: "20-25 min",
    successRate: 91,
    executions: 74,
    status: "available"
  },
  {
    id: "da4",
    name: "Cohort Health Monitoring",
    description: "Track customer cohort performance, retention metrics, and lifetime value analysis",
    estimatedTime: "30-35 min",
    successRate: 89,
    executions: 68,
    status: "available"
  },
  {
    id: "da5",
    name: "Data-Driven Task Validation",
    description: "Verify completed tasks against performance data and validate with metric-based evidence",
    estimatedTime: "15-20 min",
    successRate: 96,
    executions: 94,
    status: "available"
  },
  {
    id: "da6",
    name: "Lead Segmentation",
    description: "Segment leads based on behavior, demographics and engagement patterns for targeted campaigns",
    estimatedTime: "30-35 min",
    successRate: 92,
    executions: 65,
    status: "available"
  },
  {
    id: "da7",
    name: "Deep Research",
    description: "Conduct comprehensive market research and competitive analysis to identify growth opportunities",
    estimatedTime: "45-60 min",
    successRate: 88,
    executions: 43,
    status: "available"
  }
];

const marketingActivities: AgentActivity[] = [
  {
    id: "mk1",
    name: "Create Marketing Campaign",
    description: "Develop a complete marketing campaign with creative, copy, and channel strategy",
    estimatedTime: "45-60 min",
    successRate: 90,
    executions: 62,
    status: "available"
  },
  {
    id: "mk2",
    name: "SEO Content Optimization",
    description: "Analyze and optimize website content for better search performance",
    estimatedTime: "30-35 min",
    successRate: 88,
    executions: 93,
    status: "available"
  },
  {
    id: "mk3",
    name: "A/B Test Design",
    description: "Create statistically valid A/B tests for landing pages or email campaigns",
    estimatedTime: "20-25 min",
    successRate: 92,
    executions: 104,
    status: "available"
  },
  {
    id: "mk4",
    name: "Analyze Segments",
    description: "Identify and analyze customer segments to optimize targeting and conversion strategies",
    estimatedTime: "25-30 min",
    successRate: 94,
    executions: 78,
    status: "available"
  },
  {
    id: "mk5",
    name: "Campaign Requirements Creation",
    description: "Develop detailed specifications and requirements documentation for marketing campaigns",
    estimatedTime: "30-40 min",
    successRate: 91,
    executions: 56,
    status: "available"
  }
];

const uxActivities: AgentActivity[] = [
  {
    id: "ux1",
    name: "Website Analysis",
    description: "Conduct comprehensive evaluation of website usability, information architecture and user experience",
    estimatedTime: "30-40 min",
    successRate: 92,
    executions: 67,
    status: "available"
  },
  {
    id: "ux2",
    name: "Application Analysis",
    description: "Evaluate mobile and desktop applications for usability issues, interaction design and user flows",
    estimatedTime: "35-45 min",
    successRate: 90,
    executions: 58,
    status: "available"
  },
  {
    id: "ux3",
    name: "Product Requirements Creation",
    description: "Develop detailed user-centered product requirements, specifications and design documentation",
    estimatedTime: "40-50 min",
    successRate: 88,
    executions: 42,
    status: "available"
  }
];

const salesActivities: AgentActivity[] = [
  {
    id: "sl1",
    name: "Lead Follow-up Management",
    description: "Systematically track and engage with leads through personalized communication sequences",
    estimatedTime: "20-25 min",
    successRate: 87,
    executions: 126,
    status: "available"
  },
  {
    id: "sl2",
    name: "Appointment Generation",
    description: "Create and schedule qualified sales meetings with prospects through effective outreach",
    estimatedTime: "15-20 min",
    successRate: 83,
    executions: 98,
    status: "available"
  },
  {
    id: "sl3",
    name: "Lead Generation",
    description: "Identify and qualify potential customers through various channels and targeting strategies",
    estimatedTime: "25-30 min",
    successRate: 85,
    executions: 112,
    status: "available"
  },
  {
    id: "sl4",
    name: "Lead Profile Research",
    description: "Analyze prospect backgrounds, needs, and pain points to create personalized sales approaches",
    estimatedTime: "20-25 min",
    successRate: 89,
    executions: 76,
    status: "available"
  },
  {
    id: "sl5",
    name: "Generate Sales Order",
    description: "Create complete sales orders with product details, pricing, and customer information",
    estimatedTime: "15-20 min",
    successRate: 94,
    executions: 83,
    status: "available"
  }
];

const customerSupportActivities: AgentActivity[] = [
  {
    id: "cs1",
    name: "Knowledge Base Management",
    description: "Create, update, and organize product documentation and user guides for self-service support",
    estimatedTime: "30-35 min",
    successRate: 94,
    executions: 84,
    status: "available"
  },
  {
    id: "cs2",
    name: "FAQ Development",
    description: "Identify common customer questions and create comprehensive answers for quick resolution",
    estimatedTime: "20-25 min",
    successRate: 96,
    executions: 112,
    status: "available"
  },
  {
    id: "cs3",
    name: "Escalation Management",
    description: "Handle complex customer issues and escalate to appropriate teams with complete context",
    estimatedTime: "25-30 min",
    successRate: 89,
    executions: 73,
    status: "available"
  },
  {
    id: "cs4",
    name: "Answer Emails",
    description: "Synchronize and respond to customer emails automatically with personalized responses",
    estimatedTime: "15-20 min",
    successRate: 92,
    executions: 156,
    status: "available"
  }
];

const contentActivities: AgentActivity[] = [
  {
    id: "ct1",
    name: "Content Calendar Creation",
    description: "Develop a content calendar with themes, topics, and publishing schedule",
    estimatedTime: "30-40 min",
    successRate: 93,
    executions: 58,
    status: "available"
  },
  {
    id: "ct2",
    name: "Email Sequence Copywriting",
    description: "Write engaging email sequences for nurturing prospects through the funnel",
    estimatedTime: "40-50 min",
    successRate: 87,
    executions: 72,
    status: "available"
  },
  {
    id: "ct3",
    name: "Landing Page Copywriting",
    description: "Create persuasive, conversion-focused copy for landing pages",
    estimatedTime: "25-35 min",
    successRate: 89,
    executions: 84,
    status: "available"
  }
];

export const agents: Agent[] = [
  {
    id: "1",
    name: "Growth Lead/Manager",
    description: "Strategy integration, team coordination, budget management, KPI tracking",
    type: "marketing",
    status: "active",
    conversations: 425,
    successRate: 92,
    lastActive: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    icon: "BarChart",
    activities: growthLeadActivities
  },
  {
    id: "4",
    name: "Data Analyst",
    description: "Data analysis, lead qualification, segmentation, performance metrics, optimization",
    type: "product",
    status: "active",
    conversations: 189,
    successRate: 94,
    lastActive: "2024-01-26",
    icon: "PieChart",
    activities: dataAnalystActivities
  },
  {
    id: "2",
    name: "Growth Marketer",
    description: "Marketing strategy, omnichannel campaigns, A/B testing, SEO techniques",
    type: "marketing",
    status: "active",
    conversations: 312,
    successRate: 88,
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    icon: "TrendingUp",
    activities: marketingActivities
  },
  {
    id: "3",
    name: "UX Designer",
    description: "Conversion optimization, UX/UI design for funnel, onboarding experience",
    type: "product",
    status: "active",
    conversations: 156,
    successRate: 83,
    lastActive: "2024-01-25",
    icon: "Smartphone",
    activities: uxActivities
  },
  {
    id: "5",
    name: "Sales/CRM Specialist",
    description: "Lead management, demos, systematic follow-up, sales cycle",
    type: "sales",
    status: "active",
    conversations: 278,
    successRate: 86,
    lastActive: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    icon: "ShoppingCart",
    activities: salesActivities
  },
  {
    id: "7",
    name: "Customer Support",
    description: "Knowledge base management, FAQ development, customer issue escalation",
    type: "sales",
    status: "active",
    conversations: 342,
    successRate: 91,
    lastActive: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    icon: "HelpCircle",
    activities: customerSupportActivities
  },
  {
    id: "6",
    name: "Content Creator & Copywriter",
    description: "Persuasive copywriting, site content, blog posts, email sequences",
    type: "marketing",
    status: "active",
    conversations: 209,
    successRate: 85,
    lastActive: "2024-01-24",
    icon: "FileText",
    activities: contentActivities
  }
];

// Sample command data
export const exampleCommands = [
  {
    id: "cmd1",
    name: "Generate SEO Content",
    description: "Create SEO optimized content for blog post",
    status: "completed",
    timestamp: "2024-01-30T10:15:00Z",
    duration: "45s"
  },
  {
    id: "cmd2",
    name: "Analyze Keyword Density",
    description: "Check keyword usage and suggest improvements",
    status: "completed",
    timestamp: "2024-01-30T09:45:00Z",
    duration: "12s"
  },
  {
    id: "cmd3",
    name: "Generate Meta Descriptions",
    description: "Create meta descriptions for 5 new blog posts",
    status: "failed",
    timestamp: "2024-01-29T16:20:00Z",
    errorMessage: "API rate limit exceeded"
  },
  {
    id: "cmd4",
    name: "Update Content Links",
    description: "Update internal links in existing content",
    status: "pending",
    timestamp: "2024-01-31T11:30:00Z"
  }
]; 