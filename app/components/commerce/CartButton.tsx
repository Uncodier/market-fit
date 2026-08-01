import React from "react"
import { Button } from "@/app/components/ui/button"
import { ShoppingCart } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

export interface CartButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  cartCount: number
  subtotal?: number
  currency?: string
  href?: string
  hideIfEmpty?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "shell"
  badgeClassName?: string
  iconClassName?: string
}

export const CartButton = React.forwardRef<HTMLButtonElement, CartButtonProps>(
  ({
    cartCount,
    subtotal,
    currency = 'USD',
    href,
    hideIfEmpty = false,
    variant = "ghost",
    className,
    badgeClassName,
    iconClassName,
    ...props
  }, ref) => {
    const { formatPrice } = useDisplayCurrency()

    if (hideIfEmpty && cartCount === 0) return null

    const isShell = variant === "shell"
    
    // Default styling applied if it's not the new shell variant
    const buttonClass = isShell 
      ? className 
      : cn("relative rounded-full shadow-sm hover:shadow transition-all", className)

    const content = (
      <div className="relative inline-flex">
        <Button 
          ref={ref}
          variant={isShell ? "ghost" : variant}
          className={buttonClass}
          {...props}
        >
        <ShoppingCart className={cn("h-5 w-5", iconClassName)} />
        {subtotal !== undefined && subtotal > 0 && (
          <span className="font-bold ml-2">
            {formatPrice(subtotal, currency)}
          </span>
        )}
      </Button>
      {cartCount > 0 && (
        <span 
          className={cn(
            isShell 
              ? "absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full shadow-sm pointer-events-none z-10"
              : "absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[11px] font-bold h-6 w-6 flex items-center justify-center rounded-full border-2 border-background shadow-sm pointer-events-none z-10",
            badgeClassName
          )}
        >
          {cartCount}
        </span>
      )}
    </div>
  )

  if (href) {
    return <Link href={href} className="inline-flex">{content}</Link>
  }

  return content
})

CartButton.displayName = "CartButton"