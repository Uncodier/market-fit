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

/** Icon-only shell control (matches shellClasses.iconButton sizing). */
const shellIconOnly =
  "h-9 w-9 shrink-0 p-0 rounded-full font-inter inline-flex items-center justify-center text-slate-600 dark:text-white/70 bg-transparent shadow-none border-0 transition-colors duration-200 hover:text-slate-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/15"

/** Expanded shell control: cart icon + price. Never use aspect-square here. */
const shellWithPrice =
  "h-9 w-auto max-w-none shrink-0 rounded-full font-inter inline-flex items-center justify-center gap-2.5 pl-3.5 pr-3 text-slate-600 dark:text-white/70 bg-transparent shadow-none border-0 transition-colors duration-200 hover:text-slate-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/15"

type CartButtonElement = HTMLButtonElement | HTMLAnchorElement

export const CartButton = React.forwardRef<CartButtonElement, CartButtonProps>(
  (
    {
      cartCount,
      subtotal,
      currency = "USD",
      href,
      hideIfEmpty = false,
      variant = "ghost",
      className,
      badgeClassName,
      iconClassName,
      ...props
    },
    ref
  ) => {
    const { formatPrice } = useDisplayCurrency()

    if (hideIfEmpty && cartCount === 0) return null

    const isShell = variant === "shell"
    const showPrice = subtotal !== undefined && subtotal > 0
    const cartLabel =
      props["aria-label"] ||
      (cartCount === 1 ? "Open cart, 1 item" : `Open cart, ${cartCount} items`)

    const badge = cartCount > 0 ? (
      <span
        className={cn(
          isShell
            ? cn(
                // Fixed square + shrink-0 keeps the pill circular (flex parents otherwise squash it)
                "absolute bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 min-w-4 shrink-0 aspect-square flex items-center justify-center rounded-full leading-none shadow-sm pointer-events-none z-10 tabular-nums",
                cartCount > 9 && "w-auto min-w-4 px-1 aspect-auto",
                // With price to the right, anchor badge on the icon's top-left so it never covers "MX$…"
                showPrice ? "-top-1.5 -left-1.5" : "-top-1.5 -right-1.5"
              )
            : "absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[11px] font-bold h-6 w-6 min-w-6 shrink-0 aspect-square flex items-center justify-center rounded-full border-2 border-background shadow-sm pointer-events-none z-10 leading-none",
          badgeClassName
        )}
      >
        {cartCount}
      </span>
    ) : null

    const shellContent = (
      <>
        <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-visible">
          <ShoppingCart className={cn("h-4 w-4 shrink-0", iconClassName)} />
          {badge}
        </span>
        {showPrice ? (
          <span className="font-bold text-sm whitespace-nowrap tabular-nums leading-none">
            {formatPrice(subtotal!, currency)}
          </span>
        ) : null}
      </>
    )

    const standardContent = (
      <>
        <ShoppingCart className={cn("h-5 w-5", iconClassName)} />
        {showPrice ? (
          <span className="font-bold ml-2 whitespace-nowrap">
            {formatPrice(subtotal!, currency)}
          </span>
        ) : null}
      </>
    )

    if (href) {
      const {
        disabled,
        form: _form,
        formAction: _formAction,
        formEncType: _formEncType,
        formMethod: _formMethod,
        formNoValidate: _formNoValidate,
        formTarget: _formTarget,
        name: _name,
        type: _type,
        value: _value,
        onClick,
        ...linkProps
      } = props
      const anchorProps =
        linkProps as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>
      const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (disabled) {
          event.preventDefault()
          return
        }
        onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>)
      }

      if (isShell) {
        return (
          <Link
            ref={ref as React.ForwardedRef<HTMLAnchorElement>}
            href={href}
            className={cn(
              "relative",
              showPrice ? shellWithPrice : cn(shellIconOnly, className)
            )}
            style={
              showPrice
                ? { width: "auto", minWidth: "fit-content", aspectRatio: "auto" }
                : undefined
            }
            {...anchorProps}
            aria-disabled={disabled || undefined}
            aria-label={cartLabel}
            onClick={handleLinkClick}
          >
            {shellContent}
          </Link>
        )
      }

      return (
        <div className="relative inline-flex shrink-0">
          <Button
            asChild
            ref={ref as React.ForwardedRef<HTMLButtonElement>}
            variant={variant}
            className={cn("relative rounded-full shadow-sm hover:shadow transition-all", className)}
            aria-disabled={disabled || undefined}
            aria-label={cartLabel}
          >
            <Link href={href} {...anchorProps} onClick={handleLinkClick}>
              {standardContent}
            </Link>
          </Button>
          {badge}
        </div>
      )
    }

    if (isShell) {
      return (
        <button
          ref={ref as React.ForwardedRef<HTMLButtonElement>}
          type="button"
          // When showing price, do not merge caller iconButton classes (w-9 / aspect-square / !min-w-0)
          // — they collapse the control and the price overflows onto the avatar.
          className={cn(
            "relative",
            showPrice ? shellWithPrice : cn(shellIconOnly, className)
          )}
          style={
            showPrice
              ? { width: "auto", minWidth: "fit-content", aspectRatio: "auto" }
              : undefined
          }
          {...props}
          aria-label={cartLabel}
        >
          {shellContent}
        </button>
      )
    }

    return (
      <div className="relative inline-flex shrink-0">
        <Button
          ref={ref as React.ForwardedRef<HTMLButtonElement>}
          variant={variant}
          className={cn("relative rounded-full shadow-sm hover:shadow transition-all", className)}
          {...props}
          aria-label={cartLabel}
        >
          {standardContent}
        </Button>
        {badge}
      </div>
    )
  }
)

CartButton.displayName = "CartButton"
