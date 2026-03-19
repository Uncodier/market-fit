// Root middleware: re-export from app/middleware (the canonical implementation).
// proxy.ts at root had a bug (path is not defined at module scope) and is superseded.
export { middleware } from './app/middleware'

// config must be defined inline; Next.js cannot statically parse re-exported config
export const config = {
  matcher: [
    '/((?!_next/|static/|favicon|manifest.json|robots.txt|sitemap.xml|apple-touch-icon.png|browserconfig.xml|api/auth/logout).*)'
  ]
}
