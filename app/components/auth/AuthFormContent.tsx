"use client"

import type { Dispatch, SetStateAction } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/app/components/ui/alert"
import { Button } from "@/app/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form"
import { InputWithIcon } from "@/app/components/ui/input-with-icon"
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  Shield,
  Tag,
  User,
} from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { AuthFormFooter } from "./AuthFormFooter"
import type {
  AuthFormValues,
  AuthMode,
  ReferralCodeStatus,
  ResetPasswordValues,
} from "./auth-form-schema"

type AuthFormContentProps = {
  authMode: AuthMode
  form: UseFormReturn<AuthFormValues>
  resetForm: UseFormReturn<ResetPasswordValues>
  referralCodeStatus: ReferralCodeStatus
  isShopContext: boolean
  waitlistSuccess: boolean
  resetPasswordSuccess: boolean
  loading: boolean
  errorMessage: string | null
  showPassword: boolean
  mfaRequired: boolean
  mfaCode: string
  mfaVerifying: boolean
  t: (key: string) => string
  setMfaCode: Dispatch<SetStateAction<string>>
  onSubmit: (values: AuthFormValues) => Promise<void>
  onResetPasswordSubmit: (values: ResetPasswordValues) => Promise<void>
  onTogglePassword: () => void
  onMfaVerify: () => Promise<void>
  onMfaCancel: () => void
  onModeChange: (mode: AuthMode) => void
  onToggleMode: () => void
  onGoogleSignIn: () => Promise<void>
}

export function AuthFormContent(props: AuthFormContentProps) {
  const {
    authMode,
    form,
    resetForm,
    referralCodeStatus,
    isShopContext,
    waitlistSuccess,
    resetPasswordSuccess,
    loading,
    errorMessage,
    showPassword,
    mfaRequired,
    mfaCode,
    mfaVerifying,
    t,
  } = props

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert
          variant={
            errorMessage.includes("Check your email") || resetPasswordSuccess
              ? "default"
              : "destructive"
          }
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="m-0">{errorMessage}</AlertDescription>
          </div>
        </Alert>
      )}

      {authMode === "sign_up" && referralCodeStatus === "invalid" && (
        <Alert>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="m-0">
              {t("auth.invalidReferralCode") ||
                "Invalid referral code. You can still create your account without it."}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {authMode === "sign_up" && referralCodeStatus === "valid" && (
        <Alert
          variant="default"
          className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
        >
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
            <AlertDescription className="m-0 text-green-800 dark:text-green-200">
              {t("auth.validReferralCode") ||
                "Valid referral code! You can now create your account."}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {authMode === "reset_password" ? (
        <Form {...resetForm}>
          <form
            onSubmit={resetForm.handleSubmit(props.onResetPasswordSubmit)}
            className="space-y-5"
          >
            <FormField
              control={resetForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">
                    {t("auth.email") || "Email address"}
                  </FormLabel>
                  <FormControl>
                    <InputWithIcon
                      leftIcon={<Mail className="h-4 w-4 text-muted-foreground" />}
                      className="h-12 border-0 text-sm neu-auth-input-light focus-visible:ring-0 dark:neu-auth-input"
                      placeholder={t("auth.emailPlaceholder") || "name@example.com"}
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="mt-1 text-xs" />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="mt-6 w-full font-medium font-inter neu-auth-btn"
              disabled={loading || resetPasswordSuccess}
            >
              {loading
                ? t("auth.sending") || "Sending..."
                : t("auth.sendResetLink") || "Send Reset Link"}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-5">
            {authMode === "sign_up" && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("auth.name") || "Name"}
                    </FormLabel>
                    <FormControl>
                      <InputWithIcon
                        leftIcon={<User className="h-4 w-4 text-muted-foreground" />}
                        className="h-12 border-0 text-sm neu-auth-input-light focus-visible:ring-0 dark:neu-auth-input"
                        placeholder={t("auth.namePlaceholder") || "Your name"}
                        type="text"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="mt-1 text-xs" />
                  </FormItem>
                )}
              />
            )}

            {authMode === "sign_up" && (
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">
                      {t("auth.phone") || "Phone number"}{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <InputWithIcon
                        leftIcon={<Phone className="h-4 w-4 text-muted-foreground" />}
                        className="h-12 border-0 text-sm neu-auth-input-light focus-visible:ring-0 dark:neu-auth-input"
                        placeholder={
                          t("auth.phonePlaceholder") || "+1 (555) 000-0000"
                        }
                        type="tel"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="mt-1 text-xs" />
                  </FormItem>
                )}
              />
            )}

            {authMode === "sign_up" && !isShopContext && (
              <>
                <FormField
                  control={form.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">
                        {t("auth.referralCode") || "Referral Code"}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {t("auth.optional") || "(optional)"}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <InputWithIcon
                          leftIcon={<Tag className="h-4 w-4 text-muted-foreground" />}
                          rightIcon={
                            referralCodeStatus === "valid" ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : referralCodeStatus === "checking" ? (
                              <LoadingSkeleton size="sm" />
                            ) : null
                          }
                          className="h-12 border-0 text-sm neu-auth-input-light focus-visible:ring-0 dark:neu-auth-input"
                          placeholder={t("auth.enterCode") || "Enter code"}
                          type="text"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="mt-1 text-xs" />
                    </FormItem>
                  )}
                />
                {referralCodeStatus === "unchecked" && (
                  <p className="text-xs text-muted-foreground">
                    {t("auth.haveReferralCode") ||
                      "💡 Have a referral code? Enter it above for instant access."}
                  </p>
                )}
              </>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">
                    {t("auth.email") || "Email address"}
                  </FormLabel>
                  <FormControl>
                    <InputWithIcon
                      leftIcon={<Mail className="h-4 w-4 text-muted-foreground" />}
                      className="h-12 border-0 text-sm neu-auth-input-light focus-visible:ring-0 dark:neu-auth-input"
                      placeholder={t("auth.emailPlaceholder") || "name@example.com"}
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="mt-1 text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">
                    {t("auth.password") || "Password"}
                  </FormLabel>
                  <FormControl>
                    <InputWithIcon
                      leftIcon={<Lock className="h-4 w-4 text-muted-foreground" />}
                      rightIconButton={
                        <button
                          type="button"
                          className="h-4 w-4 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          aria-pressed={showPassword}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                      onRightIconClick={props.onTogglePassword}
                      className="h-12 border-0 text-sm neu-auth-input-light focus-visible:ring-0 dark:neu-auth-input"
                      type={showPassword ? "text" : "password"}
                      placeholder={
                        authMode === "sign_up"
                          ? t("auth.createPassword") || "Create a password"
                          : t("auth.passwordPlaceholder") || "Enter your password"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="mt-1 text-xs" />
                </FormItem>
              )}
            />

            {mfaRequired && authMode === "sign_in" && (
              <div className="space-y-4 rounded-lg border border-black/5 bg-muted/30 p-4 dark:border-white/5">
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Shield className="h-4 w-4" />
                    {t("auth.mfa.title") || "Enter verification code"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t("auth.mfa.desc") ||
                      "Enter the 6-digit code from your authenticator app"}
                  </p>
                </div>
                <div className="space-y-3">
                  <InputWithIcon
                    leftIcon={<Shield className="h-4 w-4 text-muted-foreground" />}
                    className="h-12 border-0 text-base neu-auth-input-light focus-visible:ring-0 dark:neu-auth-input"
                    aria-label="Verification code"
                    placeholder="000000"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(event) =>
                      props.setMfaCode(event.target.value.replace(/\D/g, ""))
                    }
                    disabled={mfaVerifying}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={props.onMfaVerify}
                      disabled={mfaVerifying || mfaCode.length !== 6}
                      className="flex-1 font-medium font-inter neu-auth-btn"
                    >
                      {mfaVerifying
                        ? t("auth.mfa.verifying") || "Verifying..."
                        : t("auth.mfa.verify") || "Verify"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={props.onMfaCancel}
                      disabled={mfaVerifying}
                      className="font-medium"
                    >
                      {t("auth.mfa.cancel") || "Cancel"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {authMode === "sign_in" && !mfaRequired && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => props.onModeChange("reset_password")}
                  className="text-sm text-primary font-inter hover:underline"
                >
                  {t("auth.forgotPassword") || "Forgot password?"}
                </button>
              </div>
            )}

            {!mfaRequired && (
              <Button
                type="submit"
                className="mt-6 w-full font-medium font-inter neu-auth-btn"
                disabled={loading}
              >
                {loading
                  ? authMode === "sign_in"
                    ? t("auth.signingIn") || "Signing in..."
                    : t("auth.creating") || "Creating account..."
                  : authMode === "sign_in"
                    ? t("auth.signInBtn") || "Sign In"
                    : !isShopContext &&
                        referralCodeStatus === "unchecked"
                      ? t("auth.getStarted") || "Get Started"
                      : t("auth.signUpBtn") || "Create Account"}
              </Button>
            )}
          </form>
        </Form>
      )}

      <AuthFormFooter
        authMode={authMode}
        referralCodeStatus={referralCodeStatus}
        isShopContext={isShopContext}
        waitlistSuccess={waitlistSuccess}
        loading={loading}
        t={t}
        onModeChange={props.onModeChange}
        onToggleMode={props.onToggleMode}
        onGoogleSignIn={props.onGoogleSignIn}
      />
    </div>
  )
}
