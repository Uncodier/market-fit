import { MakinariIsotype } from "@/app/components/ui/makinari-isotype"

export function MakinariHeaderIsotype({ alt = "Makinari", className = "md:hidden" }: {
  alt?: string
  className?: string
}) {
  return <MakinariIsotype alt={alt} className={className} />
}