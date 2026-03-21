"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form } from "@/app/components/ui/form"
import { useAuth } from "@/app/hooks/use-auth"
import { ChangePasswordCard } from "./change-password-card"
import { TwoFactorCard } from "./two-factor-card"
import { 
  passwordSchema, 
  mfaSchema, 
  PasswordFormValues, 
  MfaFormValues, 
  defaultPasswordValues, 
  defaultMfaValues 
} from "./authentication-types"

interface AuthenticationSettingsProps {
  onPasswordUpdated: (updated: boolean) => void;
}

export function AuthenticationSettings({ onPasswordUpdated }: AuthenticationSettingsProps) {
  const { user } = useAuth();
  const [hasPasswordChanges, setHasPasswordChanges] = useState(false);

  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: defaultPasswordValues,
  });

  // MFA form
  const mfaForm = useForm<MfaFormValues>({
    resolver: zodResolver(mfaSchema),
    defaultValues: defaultMfaValues,
  });

  // Watch for password form changes
  useEffect(() => {
    const subscription = passwordForm.watch(() => {
      setHasPasswordChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [passwordForm.watch]);

  return (
    <>
      <Form {...passwordForm}>
        <div className="space-y-12">
          <ChangePasswordCard 
            passwordForm={passwordForm}
            hasPasswordChanges={hasPasswordChanges}
            onPasswordUpdated={onPasswordUpdated}
            setHasPasswordChanges={setHasPasswordChanges}
            defaultPasswordValues={defaultPasswordValues}
          />
        </div>
      </Form>
      
      <div className="mt-12">
        <Form {...mfaForm}>
          <TwoFactorCard 
            mfaForm={mfaForm} 
            user={user} 
          />
        </Form>
      </div>
    </>
  );
}