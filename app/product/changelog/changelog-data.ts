export const changelogData = [
  {
    id: "v1-5-0",
    version: "v1.5.0",
    date: "March 2026",
    title: "Product Agents & UI Improvements",
    description: "Introduced the new Product Agents page and improved icon handling across the platform.",
    highlights: [
      "Added new Product Agents page for better AI agent management",
      "Fixed icon exports and imports in use cases data for visual consistency"
    ],
    details: "In this release, we focused on expanding our product offerings with the new Product Agents page, allowing users to better manage their AI agents. We also did a comprehensive sweep of our icon system, fixing various export and import issues to ensure a consistent visual experience across the entire platform. The UI has been polished to provide a smoother navigation experience.",
    type: "feature"
  },
  {
    id: "v1-4-2",
    version: "v1.4.2",
    date: "February 2026",
    title: "Safari Compatibility & Social Media Integration",
    description: "A major focus on cross-browser compatibility, specifically for Safari, alongside new content asset management and social media integrations.",
    highlights: [
      "Improved Safari compatibility and UI consistency across chat components",
      "Added content asset management features (fetch, attach, detach assets)",
      "Enhanced social media integration with active status inference",
      "Enhanced chat message rendering with remark-gfm support",
      "Refactored SimpleMessagesView to enhance step management",
      "Implemented lead qualification activity with error handling"
    ],
    details: "Safari users will notice a significant improvement in UI consistency, particularly in our chat components. We've introduced a robust content asset management system, allowing you to fetch, attach, and detach assets seamlessly. Social media integration has been upgraded to automatically infer active status. Additionally, our chat messages now support GitHub Flavored Markdown (remark-gfm) for richer formatting.",
    type: "update"
  },
  {
    id: "v1-3-0",
    version: "v1.3.0",
    date: "January 2026",
    title: "Social Networks Addon & UX Consolidation",
    description: "Launched the initial version of the Social Networks addon and delivered numerous UI/UX improvements across all apps.",
    highlights: [
      "Launched v0 Social Networks addon",
      "Added support for new lead statuses: cold and not-qualified",
      "Added command review on all chat messages",
      "Improved pending conversations filtering and prioritization",
      "Fixed lead updating and added better visual feedback"
    ],
    details: "This month marks the debut of our highly anticipated Social Networks addon, bringing your social channels directly into the platform. We've refined our CRM capabilities by adding 'cold' and 'not-qualified' lead statuses. Quality control is easier with the new command review feature on chat messages. We've also tweaked the algorithms for filtering and prioritizing pending conversations for better workflow efficiency.",
    type: "feature"
  },
  {
    id: "v1-2-5",
    version: "v1.2.5",
    date: "December 2025",
    title: "Next.js Upgrade & Agent Mail",
    description: "Upgraded the core framework to Next.js 16 and React 19, introduced a new UX for agent mail, and streamlined the signup process.",
    highlights: [
      "Updated to Next.js 16 and React 19",
      "Introduced new Agent Mail UX",
      "Removed requirements for signup",
      "Added v0 for message confirmation",
      "Improved settings and context UX",
      "Added new navigation icons"
    ],
    details: "A massive under-the-hood upgrade brings the platform to Next.js 16 and React 19, significantly boosting performance and developer experience. We've completely redesigned the Agent Mail user experience for better clarity and ease of use. The signup process has been streamlined by removing unnecessary requirements, making onboarding frictionless. We also rolled out the initial version of message confirmation.",
    type: "update"
  },
  {
    id: "v1-1-0",
    version: "v1.1.0",
    date: "November 2025",
    title: "2FA, Video Generation & Analytics",
    description: "A feature-packed month introducing video generation, manual enrichment in Find People, and Two-Factor Authentication.",
    highlights: [
      "Added video generation to makinas",
      "Added support for Two-Factor Authentication (2FA)",
      "Introduced manual enrichment feature in Find People",
      "New metrics for meetings KPIs",
      "Added new activities on settings for inbound notifications",
      "Improved filters for chats screen",
      "Implemented CORS and CSP for security enhancements"
    ],
    details: "Security takes a front seat with the introduction of Two-Factor Authentication (2FA). Our AI agents (Makinas) can now generate videos, adding a powerful new dimension to your automated content. The 'Find People' tool now supports manual data enrichment. Finally, we've added deep metrics and KPIs specifically for meetings, giving you better insights into your scheduling performance.",
    type: "feature"
  }
];
