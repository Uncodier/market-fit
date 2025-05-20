import { cn } from "@/lib/utils"

interface CurrentTimeIndicatorProps {
  timePosition: number
  showLabel?: boolean
  currentTime: Date
  className?: string
}

export function CurrentTimeIndicator({ 
  timePosition, 
  showLabel = true, 
  currentTime,
  className 
}: CurrentTimeIndicatorProps) {
  return (
    <>
      <div 
        className={cn(
          "absolute left-0 right-0 border-t border-accent/70 z-[1]",
          className
        )}
        style={{ 
          top: `${timePosition}px`,
          transform: 'translateY(-1px)'
        }}
      />
      {showLabel && (
        <div 
          className="absolute left-0 w-[100px] bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-r-sm z-20 font-medium"
          style={{ 
            top: `${timePosition}px`,
            transform: 'translateY(-50%)',
            marginLeft: '-100px'
          }}
        >
          {currentTime.toLocaleTimeString('en-US', { 
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })}
        </div>
      )}
    </>
  )
} 