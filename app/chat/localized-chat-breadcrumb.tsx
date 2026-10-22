"use client"

import { Breadcrumb } from "@/app/components/navigation/Breadcrumb"
import * as Icons from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export function LocalizedChatBreadcrumb() {
  const { t } = useLocalization()

  return (
    <div className="flex justify-between items-center w-full pr-8">
      <Breadcrumb
        items={[
          {
            href: "/",
            label: t("details.chat.home"),
            icon: <Icons.Home className="h-3.5 w-3.5" />,
          },
          {
            href: "/agents",
            label: t("details.chat.agents"),
            icon: <Icons.Users className="h-3.5 w-3.5" />,
          },
          {
            href: "#",
            label: t("details.chat.title"),
            icon: <Icons.MessageSquare className="h-3.5 w-3.5" />,
          },
        ]}
      />
    </div>
  )
}