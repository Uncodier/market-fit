import { PlusCircle } from "./icons"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  features?: {
    title: string
    items: string[]
  }[]
  hint?: string
}

export function EmptyState({
  icon = <span className="text-8xl">✨</span>,
  title,
  description,
  features,
  hint
}: EmptyStateProps) {
  return (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center">
      <div className="text-center max-w-[420px] mx-auto space-y-8">
        <div className="w-48 h-48 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-1 ring-primary/20">
          {icon}
        </div>
        <div className="space-y-6">
          <h3 className="text-2xl font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
          {features && features.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {features.map((feature, index) => (
                <div key={index} className="space-y-2">
                  <p className="font-medium text-foreground">{feature.title}</p>
                  <ul className="space-y-1 text-xs">
                    {feature.items.map((item, idx) => (
                      <li key={idx}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {hint && (
            <p className="text-xs text-muted-foreground/80">
              {hint}
            </p>
          )}
        </div>
      </div>
    </div>
  )
} 