"use client"

import dynamic from "next/dynamic"
import { useLocalization } from "@/app/context/LocalizationContext"

function RequirementLoading() {
  const { t } = useLocalization()
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      {t("details.loading")}
    </div>
  )
}

const RequirementDetailPage = dynamic(() => import("./requirement-item-client"), {
  ssr: false,
  loading: () => <RequirementLoading />,
})

export default function Page(props: { params: Promise<{ id: string }> }) {
  return <RequirementDetailPage {...props} />
}
