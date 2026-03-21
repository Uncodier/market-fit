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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card"
import { QuickNav, type QuickNavSection } from "@/app/components/ui/quick-nav"
import { cn } from "@/lib/utils"
import { 
  Shield, 
  Eye, 
  Settings,
  LogOut,
  Check,
  X,
  Key,
  Globe,
  Trash2,
  Bot,
  PlusCircle
} from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import { useAuth } from "@/app/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { useAllowedDomains } from "@/app/hooks/use-allowed-domains"
import { AddDomainDialog } from "@/app/components/domains/add-domain-dialog"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useSite } from "@/app/context/SiteContext"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { ApiKeysList } from "@/app/components/api-keys/api-keys-list"
import { RobotSessionsList } from "@/app/components/security/robot-sessions-list"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog"

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

// Section configurations for quick navigation
const authenticationSections: QuickNavSection[] = [
  { id: "change-password", title: "Change Password" },
  { id: "two-factor-authentication", title: "Two-Factor Authentication" },
]

const getInitialApiKeysSections = (): QuickNavSection[] => [
  { 
    id: "api-keys", 
    title: "API Keys",
    children: []
  },
]

const robotSessionsSections: QuickNavSection[] = [
  { id: "robot-sessions", title: "Robot Sessions" },
]

const getInitialAllowedDomainsSections = (): QuickNavSection[] => [
  { 
    id: "allowed-domains", 
    title: "Allowed Domains",
    children: []
  },
]

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
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [activeTab, setActiveTab] = useState("authentication");
  const [hasPasswordChanges, setHasPasswordChanges] = useState(false);
  const [apiKeysSections, setApiKeysSections] = useState<QuickNavSection[]>(getInitialApiKeysSections())
  const [allowedDomainsSections, setAllowedDomainsSections] = useState<QuickNavSection[]>(getInitialAllowedDomainsSections())

  // Listen for API keys updates
  useEffect(() => {
    const handleApiKeysUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setApiKeysSections([
        {
          id: "api-keys",
          title: "API Keys",
          children: items
        }
      ]);
    };

    window.addEventListener('apiKeysUpdated', handleApiKeysUpdate as EventListener);
    return () => {
      window.removeEventListener('apiKeysUpdated', handleApiKeysUpdate as EventListener);
    };
  }, []);

  // Listen for allowed domains updates
  useEffect(() => {
    const handleAllowedDomainsUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setAllowedDomainsSections([
        {
          id: "allowed-domains",
          title: "Allowed Domains",
          children: items
        }
      ]);
    };

    window.addEventListener('allowedDomainsUpdated', handleAllowedDomainsUpdate as EventListener);
    return () => {
      window.removeEventListener('allowedDomainsUpdated', handleAllowedDomainsUpdate as EventListener);
    };
  }, []);

  // Get current sections based on active tab
  const getCurrentSections = (): QuickNavSection[] => {
    switch (activeTab) {
      case "authentication":
        return authenticationSections
      case "api_keys":
        return apiKeysSections
      case "robot_sessions":
        return robotSessionsSections
      case "allowed_domains":
        return allowedDomainsSections
      default:
        return []
    }
  }
  
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
      setPasswordUpdated(false);
      const supabase = createClient();
      
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword
      });
      
      if (error) {
        throw error;
      }
      
      // Show success toast and reset form
      toast.success("Password updated successfully");
      setPasswordUpdated(true);
      passwordForm.reset(defaultPasswordValues);
      
      // Reset password visibility states
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      
      // Reset password changes flag to disable save button
      setHasPasswordChanges(false);
      
      // Automatically clear success message after some time
      setTimeout(() => {
        setPasswordUpdated(false);
      }, 5000);
      
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
    <div className="flex-1">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="flex items-center justify-between px-16 w-full">
            <TabsList className="w-auto">
              <TabsTrigger value="authentication" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Authentication
              </TabsTrigger>
              <TabsTrigger value="api_keys" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="robot_sessions" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Robot Sessions
              </TabsTrigger>
              <TabsTrigger value="allowed_domains" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Allowed Domains
              </TabsTrigger>
            </TabsList>
            <div className="flex-1">
              {passwordUpdated && (
                <div className="flex items-center text-green-500">
                  <Check className="h-4 w-4 mr-2" />
                  <span>Password successfully updated</span>
                </div>
              )}
            </div>
          </div>
        </StickyHeader>
        
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-16">
          <TabsContent value="authentication">
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit(handleUpdatePassword)}
                id="password-form"
                className="space-y-12"
              >
                <div className="space-y-12">
                  <Card id="change-password" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardHeader className="px-8 py-6">
                      <CardTitle className="text-xl font-semibold">Change Password</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8 px-8">
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
                                  className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground safari-eye-button"
                                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                  aria-label="Toggle password visibility"
                                >
                                  <Eye className="h-4 w-4" />
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
                                  className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground safari-eye-button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  aria-label="Toggle password visibility"
                                >
                                  <Eye className="h-4 w-4" />
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
                                  className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground safari-eye-button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  aria-label="Toggle password visibility"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs mt-2" />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <ActionFooter>
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={!hasPasswordChanges || isSaving}
                      >
                        {isSaving ? "Saving..." : "Save Password"}
                      </Button>
                    </ActionFooter>
                  </Card>

                  <Card id="two-factor-authentication" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardHeader className="px-8 py-6">
                      <CardTitle className="text-xl font-semibold">Two-Factor Authentication</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8 px-8">
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
                              className="safari-switch"
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
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="api_keys">
            <ApiKeysList />
          </TabsContent>

          <TabsContent value="robot_sessions">
            <Card id="robot-sessions" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="px-8 py-6">
                <CardTitle className="text-xl font-semibold">Robot Sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 px-8 pb-8 w-full">
                <div className="text-sm text-muted-foreground">
                  Manage automation authentication sessions for makinas. These sessions store browser authentication data that can be reused across automation instances.
                </div>
                <RobotSessionsList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allowed_domains">
            <AllowedDomainsList />
          </TabsContent>
            </div>
            <QuickNav sections={getCurrentSections()} />
          </div>
        </div>
      </Tabs>
    </div>
  )
}

function AllowedDomainsList() {
  const { domains, isLoading, isSubmitting, addDomain, deleteDomain } = useAllowedDomains()
  const { currentSite } = useSite()

  // Emit domains update event whenever list changes
  useEffect(() => {
    if (domains.length > 0) {
      const domainsData = domains.map((domain, index) => ({
        id: `allowed-domain-${index}`,
        title: domain.domain || `Domain ${index + 1}`,
      }));
      
      window.dispatchEvent(new CustomEvent('allowedDomainsUpdated', { 
        detail: domainsData 
      }));
    }
  }, [domains]);

  if (!currentSite) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <EmptyCard
          icon={<Globe className="h-10 w-10 text-muted-foreground" />}
          title="Select a site"
          description="Please select a site to manage allowed domains"
        />
      </div>
    )
  }

  return (
    <div id="allowed-domains" className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Allowed Domains</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which domains are allowed to make requests to your API
          </p>
        </div>
        <AddDomainDialog onAddDomain={addDomain} />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-48 bg-muted/40 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Domain Cards */}
          {domains.map((domain, index) => (
            <Card key={domain.id} id={`allowed-domain-${index}`} className="border border-border">
              <CardHeader className="px-8 py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg font-semibold">{domain.domain}</CardTitle>
                  </div>
                </div>
              </CardHeader>

              {/* Card Footer with individual buttons */}
              <ActionFooter>
                <div className="flex items-center gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSubmitting || domain.domain === 'localhost'}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Domain
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Domain</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove the domain "{domain.domain}"? This action cannot be undone and API requests from this domain will no longer be allowed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteDomain(domain.id)}
                          className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                        >
                          Remove Domain
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </ActionFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
} 