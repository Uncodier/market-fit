import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"

export interface BuyerProfile {
  id: string
  name: string | null
  avatar_url: string | null
}

function buyerInitial(name: string | null) {
  const trimmed = name?.trim() || ""
  // Buscar primero una letra para evitar que salgan números (que confunden con un contador)
  const letterMatch = trimmed.match(/\p{L}/u)
  if (letterMatch) {
    return letterMatch[0].toUpperCase()
  }
  // Fallback al primer caracter si no hay letras
  const char = trimmed.replace(/[^\p{L}\p{N}]/gu, "").charAt(0) || trimmed.charAt(0)
  return char ? char.toUpperCase() : "?"
}

export function BuyerAvatarStack({
  buyers,
  totalCount,
  size = "md",
}: {
  buyers: BuyerProfile[]
  totalCount?: number
  size?: "sm" | "md" | "lg"
}) {
  if (!buyers || buyers.length === 0) return null

  const sizeClasses = {
    sm: "h-5 w-5 border-2 text-[8px]",
    md: "h-6 w-6 border-2 text-[10px]",
    lg: "h-8 w-8 border-[3px] text-xs",
  }
  const s = sizeClasses[size]

  return (
    <div className="flex items-center">
      {buyers.slice(0, 4).map((buyer, i) => (
        <Avatar
          key={buyer.id}
          className={`${s} ${
            i > 0 ? "-ml-2" : ""
          } rounded-full border-background relative z-[1] shrink-0 bg-muted`}
          style={{ zIndex: 10 - i }}
        >
          {buyer.avatar_url ? (
            <AvatarImage src={buyer.avatar_url} alt={buyer.name || ""} className="object-cover" />
          ) : null}
          <AvatarFallback>{buyerInitial(buyer.name)}</AvatarFallback>
        </Avatar>
      ))}
      {typeof totalCount === "number" && totalCount > Math.min(buyers.length, 4) && (
        <span className="ml-1.5 text-xs font-medium text-muted-foreground">
          +{totalCount - Math.min(buyers.length, 4)}
        </span>
      )}
    </div>
  )
}
