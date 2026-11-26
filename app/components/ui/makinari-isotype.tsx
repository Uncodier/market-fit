import Image from "next/image"
import { cn } from "@/lib/utils"

type Props = {
  alt?: string
  className?: string
  height?: number
  loading?: "eager" | "lazy"
}

export function MakinariIsotype({ alt = "Makinari", className, height = 24, loading }: Props) {
  return (
    <Image
      src="/images/isotipo.svg"
      alt={alt}
      width={Math.round(height * 1281 / 1488)}
      height={height}
      loading={loading}
      style={{ height, width: "auto" }}
      className={cn("w-auto shrink-0 brightness-0 dark:brightness-100", className)}
    />
  )
}