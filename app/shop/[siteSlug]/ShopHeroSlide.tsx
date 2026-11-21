import type { ReactNode } from "react"

// The cover starts behind the floating Shop header and its spacer.
export const shopHeroFrameClass = "text-white h-[580px] md:h-[550px] -mt-[88px] md:-mt-[104px] relative overflow-hidden bg-gray-100 dark:bg-gray-900"
export const shopHeroImageClass = "object-cover md:object-center object-top w-full h-full"
export const shopHeroTitleClass = "text-4xl md:text-6xl font-black mb-3 md:mb-6 leading-tight max-w-3xl drop-shadow-md"
export const shopHeroSubtitleClass = "text-base md:text-xl text-gray-300 max-w-xl mb-6 md:mb-10 drop-shadow-md"
export const shopHeroCtaClass = "h-14 px-8 text-lg rounded-full font-semibold shadow-lg"

export function ShopHeroSlide({ background, children, bottom }: { background: ReactNode; children: ReactNode; bottom?: ReactNode }) {
  return (
    <div className="relative flex h-full items-center">
      <div className="absolute inset-0 z-0">
        {background}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent md:bg-gradient-to-r md:from-black/80 md:via-black/50 md:to-transparent" />
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10 text-center md:text-left flex flex-col items-center md:items-start w-full pt-[88px] md:pt-[104px] pb-20">
        {children}
      </div>
      {bottom}
    </div>
  )
}