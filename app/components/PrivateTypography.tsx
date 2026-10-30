import { shouldUseLayout } from "../config/routes"

/** Keep workspace and account typography separate from public brand surfaces. */
export function PrivateTypography({ pathname, children }: {
  pathname: string
  children: React.ReactNode
}) {
  const path = pathname.split(/[?#]/)[0]
  const privateRoute = shouldUseLayout(path) ||
    ["/home", "/buyer"].some(route => path === route || path.startsWith(`${route}/`))

  return (
    <div className="contents" data-private-typography={privateRoute ? "" : undefined}>
      {children}
    </div>
  )
}