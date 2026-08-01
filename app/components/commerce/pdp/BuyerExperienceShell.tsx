"use client"
export function BuyerExperienceShell({
  backUrl,
  children,
}: {
  backUrl: string
  children: React.ReactNode
}) {
  return (
    <div className="w-full min-h-0 flex flex-col relative">
      {children}
    </div>
  )
}
