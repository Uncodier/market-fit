import * as React from "react"
import { cn } from "@/lib/utils"
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
  action?: React.ReactNode
  className?: string
  variant?: "simple" | "fancy"
}

export function EmptyState({
  icon = <span className="text-8xl">✨</span>,
  title,
  description,
  features,
  hint,
  action,
  className,
  variant = "fancy"
}: EmptyStateProps) {
  const isSimple = variant === "simple"
  
  return (
    <div className={cn(
      "flex items-center justify-center min-h-[calc(100vh-207px)] relative overflow-hidden", 
      className
    )}>
      {/* Floating background orbs - removed per user request */}
      
      <div className={cn(
        "text-center px-4 relative z-[1]",
        isSimple ? "max-w-md" : "max-w-2xl"
      )}>
        {isSimple ? (
          // Simple version: large iOS-style icon + title
          <>
            <div className="mb-8">
              {icon && (
                <div className="mb-8 text-muted-foreground/50 flex justify-center">
                  <div className="w-24 h-24 flex items-center justify-center [&>*]:!w-24 [&>*]:!h-24 [&_svg]:!stroke-current [&_svg]:!fill-current [&_svg_*]:!stroke-current [&_svg_*]:!fill-none text-primary">
                    {icon}
                  </div>
                </div>
              )}
              <h3 className="text-xl font-semibold text-foreground mb-3">{title}</h3>
              {description && (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  {description}
                </p>
              )}
            </div>
            
            {action && (
              <div className="mt-6">
                {action}
              </div>
            )}
          </>
        ) : (
          // Fancy version: completely redesigned
          <>
            {/* Hero section with icon */}
            <div className="mb-12 relative">
              <div className="relative mb-8 z-[2]">
                {/* Main icon container - auth style */}
                <div className="w-32 h-32 mx-auto rounded-2xl bg-primary/10 backdrop-blur-sm border border-primary/20 flex items-center justify-center shadow-lg">
                  <div className="text-primary [&>*]:!w-12 [&>*]:!h-12 [&_svg]:!stroke-primary [&_svg]:!fill-primary [&_svg_*]:!stroke-primary [&_svg_*]:!fill-none">
                    {icon}
                  </div>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-foreground mb-4 relative z-[2]">{title}</h2>
              {description && (
                <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto relative z-[2]">
                  {description}
                </p>
              )}
            </div>

            {/* Features section */}
            {features && features.length > 0 && (
              <div className="mb-10">
                <div className="flex flex-wrap justify-around gap-6 max-w-2xl mx-auto">
                  {features.map((feature, index) => (
                    <div key={index} className="bg-muted/30 backdrop-blur-sm rounded-xl p-6 border dark:border-white/5 border-black/5/50 shadow-sm flex-1 min-w-[280px] max-w-[320px]">
                      <h4 className="font-semibold text-foreground mb-3 text-center">{feature.title}</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground text-left">
                        {feature.items.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Hint text */}
            {hint && (
              <p className="text-xs text-muted-foreground/70 mb-8 max-w-md mx-auto leading-relaxed">
                {hint}
              </p>
            )}
            
            {/* Action button */}
            {action && (
              <div className="mt-8">
                {action}
              </div>
            )}
            
            {/* Automatic operation hint */}
            <div className="mt-12 pt-8 border-t dark:border-white/5 border-black/5/30">
              <p className="text-xs text-muted-foreground/60 max-w-lg mx-auto leading-relaxed text-center">
                💡 <strong>Most operations run automatically.</strong> Your AI agents work in the background without manual direction. Feel free to return later if you prefer not to actively manage them right now.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Custom animations from auth */}
      <style jsx>{`
        @keyframes float-slow {
          0% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(60px, -80px) scale(1.1); }
          50% { transform: translate(-40px, -120px) scale(0.9); }
          75% { transform: translate(-80px, -40px) scale(1.05); }
          100% { transform: translate(0, 0) scale(1); }
        }
        
        @keyframes float-medium {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-70px, 100px) scale(1.15); }
          66% { transform: translate(50px, -60px) scale(0.85); }
          100% { transform: translate(0, 0) scale(1); }
        }
        
        @keyframes float-fast {
          0% { transform: translate(0, 0) scale(1); }
          20% { transform: translate(-60px, -50px) scale(1.2); }
          40% { transform: translate(80px, -100px) scale(0.8); }
          60% { transform: translate(100px, 30px) scale(1.1); }
          80% { transform: translate(-20px, -140px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
        
        @keyframes float-reverse {
          0% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-90px, 70px) scale(0.85); }
          50% { transform: translate(60px, 130px) scale(1.2); }
          75% { transform: translate(120px, 40px) scale(0.95); }
          100% { transform: translate(0, 0) scale(1); }
        }
        
        .animate-float-slow {
          animation: float-slow 20s ease-in-out infinite;
        }
        
        .animate-float-medium {
          animation: float-medium 18s ease-in-out infinite;
        }
        
        .animate-float-fast {
          animation: float-fast 16s ease-in-out infinite;
        }
        
        .animate-float-reverse {
          animation: float-reverse 22s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

// IsEmpty is now just a wrapper that calls EmptyState with simple variant
export function IsEmpty({
  title,
  description,
  icon,
  action,
  className,
  variant = "simple"
}: Pick<EmptyStateProps, 'title' | 'description' | 'icon' | 'action' | 'className'> & { variant?: "simple" | "fancy" }) {
  return (
    <EmptyState
      variant={variant}
      title={title}
      description={description}
      icon={icon}
      action={action}
      className={className}
    />
  )
} 