import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

export type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  thumbIcon?: React.ReactNode
}

const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitives.Root>, SwitchProps>(
  ({ className, thumbIcon, ...props }, ref) => (
    <SwitchPrimitives.Root
      className={cn(
        thumbIcon && "group",
        "peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full font-inter border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full font-inter font-bold bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
          thumbIcon && "flex items-center justify-center overflow-hidden p-px"
        )}
      >
        {thumbIcon ? (
          <span className="flex size-full max-h-full max-w-full shrink-0 items-center justify-center text-muted-foreground group-data-[state=checked]:text-primary [&_svg]:size-3 [&_svg]:shrink-0">
            {thumbIcon}
          </span>
        ) : null}
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  )
)
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
