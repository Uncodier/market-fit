import React from "react"
import { NotificationsProvider } from "./context/NotificationsContext"

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider>
      {children}
    </NotificationsProvider>
  )
} 