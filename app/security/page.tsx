"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Input } from "@/app/components/ui/input"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { cn } from "@/lib/utils"
import { 
  Shield, 
  Eye, 
  Settings,
  LogOut,
  Check,
  X
} from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import { useAuth } from "@/app/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"

// Define MFA factor interface
interface MfaFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  verified: boolean;
}

// Password schema with validation
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string()
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// MFA settings schema
const mfaSchema = z.object({
  enabled: z.boolean().default(false)
});

type PasswordFormValues = z.infer<typeof passwordSchema>;
type MfaFormValues = z.infer<typeof mfaSchema>;

// Default values for password form
const defaultPasswordValues: Partial<PasswordFormValues> = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

// Default values for MFA form
const defaultMfaValues: MfaFormValues = {
  enabled: false
};

export default function SecurityPage() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMfaSetup, setIsMfaSetup] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [setupStep, setSetupStep] = useState<'initial' | 'setup' | 'verify'>('initial');
  
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

  // Handle password update
  const handleUpdatePassword = async (data: PasswordFormValues) => {
    try {
      setIsSaving(true);
      const supabase = createClient();
      
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword
      });
      
      if (error) {
        throw error;
      }
      
      toast.success("Password updated successfully");
      passwordForm.reset(defaultPasswordValues);
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error(error instanceof Error ? error.message : "Error updating password");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle MFA setup
  const handleMfaSetup = async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      // Start MFA setup
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp'
      });
      
      if (error) {
        throw error;
      }
      
      setQrCodeUrl(data.totp.qr_code);
      setFactorId(data.id);
      setSetupStep('setup');
    } catch (error) {
      console.error("Error setting up MFA:", error);
      toast.error(error instanceof Error ? error.message : "Error setting up MFA");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle MFA verification
  const handleVerifyMfa = async () => {
    if (!factorId || !verificationCode) {
      toast.error("Verification code is required");
      return;
    }
    
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      // Verify the factor with the provided code
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verificationCode
      });
      
      if (error) {
        throw error;
      }
      
      setIsMfaSetup(true);
      mfaForm.setValue("enabled", true);
      setSetupStep('initial');
      toast.success("MFA setup successfully");
    } catch (error) {
      console.error("Error verifying MFA:", error);
      toast.error(error instanceof Error ? error.message : "Invalid verification code");
    } finally {
      setIsLoading(false);
    }
  };

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
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
          <div className="flex-1" />
          <Button 
            disabled={isSaving}
            type="submit"
            form="password-form"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </StickyHeader>
      
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit(handleUpdatePassword)}
            id="password-form"
            className="space-y-12"
          >
            <div className="space-y-12">
              <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Change Password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Current Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Settings className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base transition-colors duration-200 pr-12" 
                              placeholder="Enter your current password" 
                              type={showCurrentPassword ? "text" : "password"}
                              {...field} 
                            />
                            <button
                              type="button"
                              className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            >
                              {showCurrentPassword ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <LogOut className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base transition-colors duration-200 pr-12" 
                              placeholder="Enter your new password"
                              type={showNewPassword ? "text" : "password"}
                              {...field} 
                            />
                            <button
                              type="button"
                              className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                              {showNewPassword ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="flex items-center text-xs space-x-1">
                            {/[A-Z]/.test(field.value || '') ? 
                              <Check className="h-3 w-3 text-green-500" /> : 
                              <X className="h-3 w-3 text-muted-foreground" />
                            }
                            <span className={cn(
                              /[A-Z]/.test(field.value || '') ? 'text-green-500' : 'text-muted-foreground'
                            )}>Uppercase letter</span>
                          </div>
                          <div className="flex items-center text-xs space-x-1">
                            {/[a-z]/.test(field.value || '') ? 
                              <Check className="h-3 w-3 text-green-500" /> : 
                              <X className="h-3 w-3 text-muted-foreground" />
                            }
                            <span className={cn(
                              /[a-z]/.test(field.value || '') ? 'text-green-500' : 'text-muted-foreground'
                            )}>Lowercase letter</span>
                          </div>
                          <div className="flex items-center text-xs space-x-1">
                            {/[0-9]/.test(field.value || '') ? 
                              <Check className="h-3 w-3 text-green-500" /> : 
                              <X className="h-3 w-3 text-muted-foreground" />
                            }
                            <span className={cn(
                              /[0-9]/.test(field.value || '') ? 'text-green-500' : 'text-muted-foreground'
                            )}>Number</span>
                          </div>
                          <div className="flex items-center text-xs space-x-1">
                            {/[^A-Za-z0-9]/.test(field.value || '') ? 
                              <Check className="h-3 w-3 text-green-500" /> : 
                              <X className="h-3 w-3 text-muted-foreground" />
                            }
                            <span className={cn(
                              /[^A-Za-z0-9]/.test(field.value || '') ? 'text-green-500' : 'text-muted-foreground'
                            )}>Special character</span>
                          </div>
                          <div className="flex items-center text-xs space-x-1">
                            {(field.value?.length || 0) >= 8 ? 
                              <Check className="h-3 w-3 text-green-500" /> : 
                              <X className="h-3 w-3 text-muted-foreground" />
                            }
                            <span className={cn(
                              (field.value?.length || 0) >= 8 ? 'text-green-500' : 'text-muted-foreground'
                            )}>8+ characters</span>
                          </div>
                        </div>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <LogOut className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base transition-colors duration-200 pr-12" 
                              placeholder="Confirm your new password"
                              type={showConfirmPassword ? "text" : "password"}
                              {...field} 
                            />
                            <button
                              type="button"
                              className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? <Eye className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="px-8 py-6">
                  <CardTitle className="text-xl font-semibold">Two-Factor Authentication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 px-8 pb-8">
                  <Form {...mfaForm}>
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
                        />
                      </div>
                    </div>
                  </Form>

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
                      <div className="space-y-4">
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
                        <div className="flex gap-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSetupStep('initial')}
                            disabled={isLoading}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={handleVerifyMfa}
                            disabled={isLoading || verificationCode.length !== 6}
                          >
                            {isLoading ? "Verifying..." : "Verify"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
} 