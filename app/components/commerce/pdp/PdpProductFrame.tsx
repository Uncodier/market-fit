import type { ReactNode } from "react"

export function PdpProductFrame({ gallery, children, below }: {
  gallery: ReactNode
  children: ReactNode
  below?: ReactNode
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20">
        <div className="min-w-0">
          <div className="lg:sticky lg:top-28">{gallery}</div>
        </div>
        <div className="flex min-w-0 flex-col py-0 sm:py-4 lg:py-8">{children}</div>
      </div>
      {below}
    </div>
  )
}