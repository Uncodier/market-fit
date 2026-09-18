"use client"

import { Button } from "@/app/components/ui/button"
import { Google, WhatsApp } from "@/app/components/ui/icons"
import { Separator } from "@/app/components/ui/separator"
import type {
  AuthMode,
  ReferralCodeStatus,
} from "./auth-form-schema"

type AuthFormFooterProps = {
  authMode: AuthMode
  referralCodeStatus: ReferralCodeStatus
  isShopContext: boolean
  waitlistSuccess: boolean
  loading: boolean
  t: (key: string) => string
  onModeChange: (mode: AuthMode) => void
  onToggleMode: () => void
  onGoogleSignIn: () => Promise<void>
}

export function AuthFormFooter({
  authMode,
  referralCodeStatus,
  isShopContext,
  waitlistSuccess,
  loading,
  t,
  onModeChange,
  onToggleMode,
  onGoogleSignIn,
}: AuthFormFooterProps) {
  const showAlternativeActions =
    !isShopContext && !waitlistSuccess && authMode !== "reset_password"

  return (
    <>
      {showAlternativeActions && (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 font-medium text-muted-foreground">
              {t("auth.orContinue") || "Or continue with"}
            </span>
          </div>
        </div>
      )}

      {showAlternativeActions && (
        <Button
          type="button"
          tint="whatsapp"
          className="w-full font-medium font-inter neu-auth-whatsapp-btn transition-opacity hover:opacity-90"
          onClick={() => window.open("https://wa.me/15512886610", "_blank")}
        >
          <WhatsApp className="mr-2 h-4 w-4 text-white" />
          {t("auth.whatsappBtn") || "Use Makinari on WhatsApp"}
        </Button>
      )}

      {false && !waitlistSuccess && authMode !== "reset_password" && (
        <Button
          type="button"
          variant="outline"
          className="w-full font-medium font-inter"
          onClick={onGoogleSignIn}
          disabled={loading}
        >
          <Google className="mr-2 h-4 w-4" />
          Google
          {authMode === "sign_up" && referralCodeStatus !== "valid" && (
            <span className="ml-2 text-xs opacity-60">
              (Referral code required)
            </span>
          )}
        </Button>
      )}

      {!waitlistSuccess && (
        <div className="mt-6 space-y-3 text-center">
          {authMode === "reset_password" ? (
            <button
              type="button"
              onClick={() => onModeChange("sign_in")}
              className="text-sm text-muted-foreground transition-colors font-inter hover:text-foreground"
            >
              {t("auth.rememberPassword") || "Remember your password?"}{" "}
              <span className="font-medium text-primary hover:underline">
                {t("auth.signInLink") || "Sign in"}
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {authMode === "sign_in"
                  ? t("auth.noAccount") || "Don't have an account?"
                  : t("auth.hasAccount") || "Already have an account?"}
              </span>
              <button
                type="button"
                onClick={onToggleMode}
                className="text-sm font-medium text-primary transition-colors font-inter hover:underline"
              >
                {authMode === "sign_in"
                  ? t("auth.signUpLink") || "Sign up"
                  : t("auth.signInLink") || "Sign in"}
              </button>
            </div>
          )}
          {false && authMode === "sign_in" && (
            <p className="text-xs text-muted-foreground">
              💡 If you signed up with Google, please use the Google button above
            </p>
          )}
        </div>
      )}
    </>
  )
}
