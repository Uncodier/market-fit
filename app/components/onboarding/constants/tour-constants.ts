export type TourStep = {
  id: string;
  title: string;
  content: string;
  selector: string;
  icon: string;
  path?: string;
  action?: 'click'; // Optional action to trigger after step is highlighted or before next step
};

export const steps: TourStep[] = [
  {
    id: "onboarding",
    icon: "📋",
    title: "Onboarding",
    content: "Welcome! Start your journey here by tracking your setup progress and ensuring your project's success.",
    selector: "#tour-onboarding-widget",
    path: "/onboarding",
  },
  {
    id: "apps",
    icon: "📦",
    title: "Apps",
    content: "Your Command Center. Access all your business apps from here: Marketing, Sales, Operations, and Finance.",
    selector: "#tour-apps-nav",
    path: "/dashboard?tab=overview", // Aseguramos que se mantenga en una vista con Sidebar para mostrar el icono de grid
  },
  {
    id: "chat-input",
    icon: "💬",
    title: "Ask Anything",
    content: "Meet your AI Partner. Don't want to navigate menus? Just ask the AI to analyze data or do the work for you.",
    selector: "#tour-chat-input",
    path: "/robots",
  },
  {
    id: "agents",
    icon: "✨",
    title: "Agents",
    content: "Delegate complex work to specialized AI Agents, like customer support, data entry, or sales outreach.",
    selector: "#tour-agents-nav",
    path: "/robots",
  },
  {
    id: "content",
    icon: "🚀",
    title: "Content Creator",
    content: "Create stunning campaigns, social media posts, and videos instantly with AI.",
    selector: "#tour-content-nav",
    path: "/robots?mode=imprenta",
  },
  {
    id: "workflows",
    icon: "🤖",
    title: "Workflows",
    content: "Put your business on autopilot. Build smart workflows to automate repetitive daily tasks.",
    selector: "#tour-workflows-nav",
    path: "/robots?mode=workflow",
  },
  {
    id: "leads",
    icon: "🎯",
    title: "Leads App",
    content: "Start growing. Manage your potential customers and close more deals seamlessly.",
    selector: "#tour-app-leads",
    path: "/navigation", // Este sí viaja adentro del grid
  },
  {
    id: "find-people",
    icon: "🔍",
    title: "Find People",
    content: "Need more prospects? Discover and connect with new contacts tailored to your business.",
    selector: "#tour-app-people",
    path: "/navigation",
  },
  {
    id: "agents-config",
    icon: "⚙️",
    title: "Agents Configuration",
    content: "You're all set! Fine-tune your AI settings here to match your exact business needs.",
    selector: "#tour-app-agentsConfiguration",
    path: "/navigation",
  },
];
