"use client"

import { CheckCircle2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export type PasswordError = {
  code?: string
  message: string
  details?: { code?: string; message: string } | string
}

export function validatePassword(pwd: string) {
  if (pwd.length < 8) return 'auth.flows.password.tooShort'
  if (!/(?=.*[a-z])/.test(pwd)) return 'auth.flows.password.needsLowercase'
  if (!/(?=.*[A-Z])/.test(pwd)) return 'auth.flows.password.needsUppercase'
  if (!/(?=.*\d)/.test(pwd)) return 'auth.flows.password.needsNumber'
  return null
}

export function passwordUpdateErrorKey(error: { code?: string; message: string }) {
  if (error.code === 'same_password' || error.message === 'New password should be different from the old password.') {
    return 'auth.flows.password.samePassword'
  }
  if (error.code === 'weak_password') return 'auth.flows.password.weakPassword'
  return 'auth.flows.password.failed'
}

export function PasswordRequirements({ password }: { password: string }) {
  const { t } = useLocalization()
  const requirements = [
    { key: 'length', met: password.length >= 8 },
    { key: 'lowercase', met: /(?=.*[a-z])/.test(password) },
    { key: 'uppercase', met: /(?=.*[A-Z])/.test(password) },
    { key: 'number', met: /(?=.*\d)/.test(password) },
  ]

  return (
    <div className="bg-muted rounded-lg p-4">
      <h4 className="text-sm font-medium text-foreground mb-2">{t('auth.flows.password.requirements')}</h4>
      <ul className="text-xs text-muted-foreground space-y-1">
        {requirements.map(({ key, met }) => (
          <li key={key} className="flex items-center">
            <CheckCircle2 className={`h-3 w-3 mr-2 ${met ? 'text-green-500' : 'text-muted-foreground'}`} />
            {t(`auth.flows.password.requirement.${key}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}