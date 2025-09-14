export interface RouteConfig {
  path: string;
  hasLayout: boolean;
}

export const routes: RouteConfig[] = [
  // Routes with layout (sidebar and topbar)
  { path: "/dashboard", hasLayout: true },
  { path: "/control-center", hasLayout: true },
  { path: "/segments", hasLayout: true },
  { path: "/content", hasLayout: true },
  { path: "/experiments", hasLayout: true },
  { path: "/requirements", hasLayout: true },
  { path: "/campaigns", hasLayout: true },
  { path: "/assets", hasLayout: true },
  { path: "/leads", hasLayout: true },
  { path: "/sales", hasLayout: true },
  { path: "/robots", hasLayout: true },
  { path: "/agents", hasLayout: true },
  { path: "/integrations", hasLayout: true },
  { path: "/chat", hasLayout: true },
  { path: "/notifications", hasLayout: true },
  { path: "/billing", hasLayout: true },
  { path: "/settings", hasLayout: true },
  { path: "/security", hasLayout: true },
  { path: "/help", hasLayout: true },
  { path: "/profile", hasLayout: true },
  { path: "/context", hasLayout: true },
  { path: "/create-site", hasLayout: false },
  
  // Routes without layout (default)
  { path: "/login", hasLayout: false },
  { path: "/register", hasLayout: false },
  { path: "/forgot-password", hasLayout: false },
  { path: "/reset-password", hasLayout: false },
  { path: "/verify-email", hasLayout: false },
  { path: "/error", hasLayout: false },
  { path: "/404", hasLayout: false },
  { path: "/500", hasLayout: false },
]

export function shouldUseLayout(pathname: string): boolean {
  // Check if the pathname matches any of our defined routes
  const route = routes.find(route => pathname.startsWith(route.path))
  
  // If we find a matching route, use its layout configuration
  if (route) {
    return route.hasLayout
  }
  
  // For dynamic routes (like /segments/[id], /agents/[id], etc.)
  // we check if the base path should have a layout
  const basePath = pathname.split('/')[1]
  const baseRoute = routes.find(route => route.path === `/${basePath}`)
  
  if (baseRoute) {
    return baseRoute.hasLayout
  }
  
  // Default to no layout for unknown routes
  return false
} 