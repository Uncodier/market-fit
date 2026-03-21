"use client"

import { useState, useEffect } from "react"
import { UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import {
  FormLabel,
  FormDescription,
} from "@/app/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Switch } from "@/app/components/ui/switch"
import { createClient } from "@/lib/supabase/client"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Shield } from "@/app/components/ui/icons"
import { MfaFormValues, MfaFactor } from "./authentication-types"
import { User } from "@supabase/supabase-js"

interface TwoFactorCardProps {
  mfaForm: UseFormReturn<MfaFormValues>;
  user: User | null;
}

export function TwoFactorCard({ mfaForm, user }: TwoFactorCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isMfaSetup, setIsMfaSetup] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [setupStep, setSetupStep] = useState<'initial' | 'setup' | 'verify'>('initial');

  // Check if MFA is enabled
  useEffect(() => {
    const checkMfaStatus = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const supabase = createClient();
        
        // Get the user's factors (MFA methods)
        const { data, error } = await supabase.auth.mfa.listFactors();
        
        if (error) {
          throw error;
        }
        
        // Check if any TOTP factor is verified
        const enabledFactor = data.totp.find((factor: MfaFactor) => factor.verified === true);
        if (enabledFactor) {
          setIsMfaSetup(true);
          setFactorId(enabledFactor.id);
          mfaForm.setValue("enabled", true);
        } else {
          setIsMfaSetup(false);
          mfaForm.setValue("enabled", false);
        }
      } catch (error) {
        console.error("Error checking MFA status:", error);
        toast.error("Could not check MFA status");
      } finally {
        setIsLoading(false);
      }
    };

    checkMfaStatus();
  }, [user, mfaForm]);

  // Handle MFA setup
  const handleMfaSetup = async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      // Primero verificamos si hay un factor existente
      const { data: existingFactors, error: listError } = await supabase.auth.mfa.listFactors()
      
      if (listError) throw listError

      // Buscar un factor TOTP no verificado
      const existingFactor = existingFactors.totp.find((factor: MfaFactor) => !factor.verified)

      if (existingFactor) {
        // Si existe un factor no verificado, lo usamos
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: existingFactor.id
        })

        if (challengeError) throw challengeError

        setQrCodeUrl(challengeData.totp.qr_code)
        setFactorId(existingFactor.id)
        setSetupStep('setup')
        return
      }

      // Si no hay factor existente, creamos uno nuevo
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Market Fit',
        friendlyName: `MFA-${new Date().getTime()}`
      })
      
      if (error) {
        // Si el error es de factor duplicado, intentamos obtener el existente
        if (error.message?.includes("already exists")) {
          const { data: factors } = await supabase.auth.mfa.listFactors()
          const unverifiedFactor = factors.totp.find((factor: MfaFactor) => !factor.verified)
          
          if (unverifiedFactor) {
            const { data: challenge } = await supabase.auth.mfa.challenge({
              factorId: unverifiedFactor.id
            })
            
            setQrCodeUrl(challenge.totp.qr_code)
            setFactorId(unverifiedFactor.id)
            setSetupStep('setup')
            return
          }
        }
        throw error
      }

      setQrCodeUrl(data.totp.qr_code)
      setFactorId(data.id)
      setSetupStep('setup')
    } catch (error) {
      console.error("Error setting up MFA:", error)
      toast.error(error instanceof Error ? error.message : "Error setting up MFA")
      // Si hay un error, reseteamos el switch
      mfaForm.setValue("enabled", false)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle MFA cancel
  const handleMfaCancel = async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      if (factorId) {
        await supabase.auth.mfa.unenroll({
          factorId
        })
      }

      setFactorId(null)
      setQrCodeUrl(null)
      setVerificationCode("")
      setSetupStep('initial')
      mfaForm.setValue("enabled", false)
    } catch (error) {
      console.error("Error canceling MFA setup:", error)
      toast.error("Failed to cancel MFA setup")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle MFA verification
  const handleVerifyMfa = async () => {
    if (!factorId || !verificationCode) {
      toast.error("Verification code is required")
      return
    }
    
    try {
      setIsLoading(true)
      const supabase = createClient()
      
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        code: verificationCode
      })
      
      if (error) throw error

      setIsMfaSetup(true)
      mfaForm.setValue("enabled", true)
      setSetupStep('initial')
      toast.success("MFA setup successfully")
    } catch (error) {
      console.error("Error verifying MFA:", error)
      toast.error(error instanceof Error ? error.message : "Invalid verification code")
      // Si hay un error en la verificación, no reseteamos el switch aún
    } finally {
      setIsLoading(false)
    }
  }

  // Handle MFA disable
  const handleDisableMfa = async () => {
    if (!factorId) {
      toast.error("No MFA factor found");
      return;
    }
    
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      // Unenroll the factor
      const { error } = await supabase.auth.mfa.unenroll({
        factorId
      });
      
      if (error) {
        throw error;
      }
      
      setIsMfaSetup(false);
      mfaForm.setValue("enabled", false);
      setFactorId(null);
      toast.success("MFA disabled successfully");
    } catch (error) {
      console.error("Error disabling MFA:", error);
      toast.error(error instanceof Error ? error.message : "Error disabling MFA");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle MFA toggle
  const handleMfaToggle = (checked: boolean) => {
    if (checked && !isMfaSetup) {
      // Enable MFA
      handleMfaSetup();
    } else if (!checked && isMfaSetup) {
      // Disable MFA
      handleDisableMfa();
    }
  };

  return (
    <Card id="two-factor-authentication" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">Two-Factor Authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 px-8">
        <div className="flex flex-row items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/5 transition-colors duration-200">
          <div className="space-y-0.5">
            <FormLabel className="text-base">
              Two-Factor Authentication (2FA)
            </FormLabel>
            <FormDescription>
              Add an extra layer of security to your account
            </FormDescription>
          </div>
          <div className="flex items-center gap-4">
            <Switch
              checked={mfaForm.watch("enabled")}
              onCheckedChange={handleMfaToggle}
              disabled={isLoading || setupStep !== 'initial'}
              className="safari-switch"
            />
          </div>
        </div>

        {setupStep === 'setup' && qrCodeUrl && (
          <div className="mt-6 space-y-4 p-4 border border-border rounded-lg">
            <h3 className="font-medium">Scan QR Code</h3>
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="flex justify-center py-4">
              <div className="border border-border p-2 rounded-lg bg-white">
                <img src={qrCodeUrl} alt="QR Code for 2FA" className="h-48 w-48" />
              </div>
            </div>
            <div>
              <FormLabel className="text-sm font-medium">Verification Code</FormLabel>
              <div className="relative mt-1">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-12 h-12 text-base transition-colors duration-200" 
                  placeholder="Enter 6-digit code from your app"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
      {setupStep === 'setup' && qrCodeUrl && (
        <ActionFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleMfaCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleVerifyMfa}
            disabled={isLoading || verificationCode.length !== 6}
          >
            {isLoading ? "Verifying..." : "Verify"}
          </Button>
        </ActionFooter>
      )}
    </Card>
  )
}