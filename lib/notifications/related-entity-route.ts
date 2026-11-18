export interface NotificationTarget {
  href: string
  label: string
}

const detailRoutes: Record<string, { path: string; label: string }> = {
  task: { path: "/control-center", label: "Go to task" },
  lead: { path: "/leads", label: "Go to lead" },
  campaign: { path: "/campaigns", label: "Go to campaign" },
  content: { path: "/content", label: "Go to content" },
  requirement: { path: "/requirements", label: "Go to requirement" },
  segment: { path: "/segments", label: "Go to segment" },
}

/** Accept only same-app paths, never an external or executable notification URL. */
export function safeNotificationActionUrl(value?: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return null
  try {
    const url = new URL(value, "https://notifications.invalid")
    const decodedPath = decodeURIComponent(url.pathname)
    if (url.origin !== "https://notifications.invalid" || decodedPath.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decodedPath)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

function getEntityTarget(type?: string, id?: string): NotificationTarget | null {
  if (type && id && id !== "." && id !== "..") {
    if (type === "conversation") {
      return { href: `/chat?${new URLSearchParams({ conversationId: id })}`, label: "Go to chat" }
    }
    if (type === "instance") {
      return { href: `/robots?${new URLSearchParams({ instance: id })}`, label: "Go to instance" }
    }
    // Sites have no detail route. The picker requires an explicit workspace choice.
    if (type === "site") return { href: "/projects", label: "Go to projects" }
    if (Object.hasOwn(detailRoutes, type)) {
      const route = detailRoutes[type]
      return { href: `${route.path}/${encodeURIComponent(id)}`, label: route.label }
    }
  }
  return null
}

/** Message is the details source; identifiers are used only for navigation. */
export function getNotificationTarget(notification: {
  related_entity_type?: string | null
  related_entity_id?: string | null
  action_url?: string | null
}): NotificationTarget | null {
  const target = getEntityTarget(notification.related_entity_type?.trim().toLowerCase(), notification.related_entity_id?.trim())
  const href = safeNotificationActionUrl(notification.action_url)
  // Older emitters used /sites/:id paths, but the app has no /sites route.
  if (href && !/^\/sites(?:\/|\?|#|$)/.test(href)) {
    return { href, label: href === target?.href ? target.label : "Go to details" }
  }
  return target
}