"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Switch } from "../ui/switch"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "../ui/card-footer"
import { Button } from "../ui/button"
import { KeyRound, ShieldCheck, ExternalLink, ChevronDown, ChevronUp, Mail, Globe } from "../ui/icons"
import { secureTokensService } from "../../services/secure-tokens-service"
import { apiClient } from "../../services/api-client-service"
import { toast } from "sonner"
import { useSite } from "../../context/SiteContext"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../ui/select"

export interface SmtpEmailSectionProps {
  active: boolean
  siteId?: string
  onSave?: (data: SiteFormValues) => void
}

const EMAIL_PROVIDERS = [
  {
    name: "Gmail",
    incomingServer: "imap.gmail.com",
    incomingPort: "993",
    outgoingServer: "smtp.gmail.com",
    outgoingPort: "587",
    passwordHint: "Use an App Password instead of your regular password. Go to Google Account Settings > Security > 2-Step Verification > App passwords to generate one.",
    advancedHint: "Gmail requires 'Less secure app access' or App Passwords for IMAP/SMTP access.",
    helpUrl: "https://myaccount.google.com/apppasswords",
    helpText: "Generate App Password"
  },
  {
    name: "Outlook/Hotmail",
    incomingServer: "outlook.office365.com",
    incomingPort: "993",
    outgoingServer: "smtp.office365.com",
    outgoingPort: "587",
    passwordHint: "Use your Microsoft account password. If you have 2FA enabled, you may need to create an app password.",
    advancedHint: "Ensure IMAP is enabled in your Outlook settings.",
    helpUrl: "https://account.microsoft.com/security/",
    helpText: "Security Settings"
  },
  {
    name: "Yahoo",
    incomingServer: "imap.mail.yahoo.com",
    incomingPort: "993",
    outgoingServer: "smtp.mail.yahoo.com",
    outgoingPort: "587",
    passwordHint: "Generate an app password in Yahoo Account Security settings. Do not use your regular Yahoo password.",
    advancedHint: "Yahoo requires app-specific passwords for third-party email clients.",
    helpUrl: "https://login.yahoo.com/account/security",
    helpText: "Generate App Password"
  },
  {
    name: "Zoho",
    incomingServer: "imap.zoho.com",
    incomingPort: "993",
    outgoingServer: "smtp.zoho.com",
    outgoingPort: "587",
    passwordHint: "Use your Zoho password. For enhanced security, consider using application-specific passwords.",
    advancedHint: "Enable IMAP access in Zoho Mail settings first.",
    helpUrl: "https://accounts.zoho.com/home#security/",
    helpText: "Security Settings"
  },
  {
    name: "AOL",
    incomingServer: "imap.aol.com",
    incomingPort: "993",
    outgoingServer: "smtp.aol.com",
    outgoingPort: "587",
    passwordHint: "Generate an app password from AOL Account Security page. Regular passwords won't work.",
    advancedHint: "AOL requires app passwords for third-party access.",
    helpUrl: "https://login.aol.com/account/security",
    helpText: "Generate App Password"
  },
  {
    name: "iCloud",
    incomingServer: "imap.mail.me.com",
    incomingPort: "993",
    outgoingServer: "smtp.mail.me.com",
    outgoingPort: "587",
    passwordHint: "Create an app-specific password at appleid.apple.com. Your iCloud password won't work directly.",
    advancedHint: "Apple requires app-specific passwords when 2FA is enabled.",
    helpUrl: "https://appleid.apple.com/account/manage",
    helpText: "Generate App Password"
  },
  {
    name: "ProtonMail",
    incomingServer: "imap.protonmail.ch",
    incomingPort: "993",
    outgoingServer: "smtp.protonmail.ch",
    outgoingPort: "587",
    passwordHint: "ProtonMail requires the Bridge application for IMAP/SMTP access. Install ProtonMail Bridge first.",
    advancedHint: "Download ProtonMail Bridge from protonmail.com/bridge to enable IMAP/SMTP.",
    helpUrl: "https://protonmail.com/bridge",
    helpText: "Download Bridge"
  },
  {
    name: "Custom",
    incomingServer: "",
    incomingPort: "",
    outgoingServer: "",
    outgoingPort: "",
    passwordHint: "Use the password provided by your email service provider.",
    advancedHint: "Contact your email administrator for the correct server settings.",
    helpUrl: "",
    helpText: ""
  }
]

export function SmtpEmailSection({ active, siteId, onSave }: SmtpEmailSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const { currentSite, updateSettings } = useSite()
  const [isConnecting, setIsConnecting] = useState(false)
  const [savingCard, setSavingCard] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState("Gmail")
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  const handleSave = async (cardId: string) => {
    if (!onSave) return
    setSavingCard(cardId)
    try {
      await onSave(form.getValues())
    } finally {
      setSavingCard(null)
    }
  }

  const emailStatus = form.getValues("channels.email.status") || "not_configured"
  const hasEmailToken = emailStatus === "synced"
  const emailEnabled = form.getValues("channels.email.enabled") || false

  const detectProviderFromEmail = (email: string) => {
    if (!email) return null
    
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return null
    
    if (domain === 'gmail.com') return 'Gmail'
    if (domain === 'hotmail.com' || domain === 'outlook.com' || domain.includes('live.com')) return 'Outlook/Hotmail'
    if (domain === 'yahoo.com' || domain.includes('yahoo.')) return 'Yahoo'
    if (domain === 'zoho.com') return 'Zoho'
    if (domain === 'aol.com') return 'AOL'
    if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') return 'iCloud'
    if (domain === 'protonmail.com' || domain === 'protonmail.ch' || domain === 'pm.me') return 'ProtonMail'
    
    return null
  }

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'channels.email.email') {
        const email = value.channels?.email?.email || ''
        const provider = detectProviderFromEmail(email)
        if (provider) {
          setSelectedProvider(provider)
          const providerConfig = EMAIL_PROVIDERS.find(p => p.name === provider)
          if (providerConfig) {
            form.setValue('channels.email.incomingServer', providerConfig.incomingServer)
            form.setValue('channels.email.incomingPort', providerConfig.incomingPort)
            form.setValue('channels.email.outgoingServer', providerConfig.outgoingServer)
            form.setValue('channels.email.outgoingPort', providerConfig.outgoingPort)
          }
        }
      }
    })
    
    return () => subscription.unsubscribe()
  }, [form])

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider)
    const providerConfig = EMAIL_PROVIDERS.find(p => p.name === provider)
    if (providerConfig) {
      form.setValue('channels.email.incomingServer', providerConfig.incomingServer)
      form.setValue('channels.email.incomingPort', providerConfig.incomingPort)
      form.setValue('channels.email.outgoingServer', providerConfig.outgoingServer)
      form.setValue('channels.email.outgoingPort', providerConfig.outgoingPort)
    }
    
    if (provider === 'Custom') {
      form.setValue('channels.email.incomingServer', '')
      form.setValue('channels.email.incomingPort', '')
      form.setValue('channels.email.outgoingServer', '')
      form.setValue('channels.email.outgoingPort', '')
    }
  }

  useEffect(() => {
    const existingServer = form.getValues('channels.email.incomingServer')
    
    if (!existingServer) {
      const gmailConfig = EMAIL_PROVIDERS.find(p => p.name === "Gmail")
      if (gmailConfig) {
        form.setValue('channels.email.incomingServer', gmailConfig.incomingServer)
        form.setValue('channels.email.incomingPort', gmailConfig.incomingPort)
        form.setValue('channels.email.outgoingServer', gmailConfig.outgoingServer)
        form.setValue('channels.email.outgoingPort', gmailConfig.outgoingPort)
      }
    }
  }, [form])

  const handleSaveEmailCredentials = async () => {
    if (!siteId) {
      toast.error("Site ID is required to save credentials")
      return
    }
    
    const email = form.getValues("channels.email.email")
    const password = form.getValues("channels.email.password")
    const incomingServer = form.getValues("channels.email.incomingServer")
    const incomingPort = form.getValues("channels.email.incomingPort")
    const outgoingServer = form.getValues("channels.email.outgoingServer")
    const outgoingPort = form.getValues("channels.email.outgoingPort")
    
    if (!email) {
      toast.error("Email address is required")
      return
    }
    
    if (!password) {
      toast.error("Password is required")
      return
    }
    
    if (selectedProvider === 'Custom') {
      if (!incomingServer) {
        toast.error("Incoming mail server is required")
        return
      }
      
      if (!incomingPort) {
        toast.error("Incoming port is required")
        return
      }
      
      if (!outgoingServer) {
        toast.error("Outgoing mail server is required")
        return
      }
      
      if (!outgoingPort) {
        toast.error("Outgoing port is required")
        return
      }
    } else {
      const providerConfig = EMAIL_PROVIDERS.find(p => p.name === selectedProvider)
      if (providerConfig) {
        form.setValue('channels.email.incomingServer', providerConfig.incomingServer)
        form.setValue('channels.email.incomingPort', providerConfig.incomingPort)
        form.setValue('channels.email.outgoingServer', providerConfig.outgoingServer)
        form.setValue('channels.email.outgoingPort', providerConfig.outgoingPort)
      }
    }
    
    try {
      setIsConnecting(true)
      form.setValue("channels.email.status", "pending_sync")
      form.setValue("channels.email.enabled", true)
      
      const emailConfig = {
        enabled: true,
        email: email,
        password: "STORED_SECURELY",
        aliases: form.getValues("channels.email.aliases") || "",
        incomingServer: form.getValues("channels.email.incomingServer"),
        incomingPort: form.getValues("channels.email.incomingPort"),
        outgoingServer: form.getValues("channels.email.outgoingServer"),
        outgoingPort: form.getValues("channels.email.outgoingPort"),
        provider: selectedProvider,
        status: "synced" as const
      }
      
      if (currentSite && updateSettings) {
        try {
          const currentSettings = currentSite.settings || {}
          const currentChannels = currentSettings.channels || {}
          
          await updateSettings(siteId, {
            channels: {
              ...currentChannels,
              email: emailConfig
            }
          })
        } catch (settingsError) {
          console.error("Error guardando configuración:", settingsError)
          form.setValue("channels.email.status", "password_required")
          toast.error("Error saving channel configuration")
          throw settingsError
        }
      }
      
      const success = await secureTokensService.storeEmailCredentials(
        siteId,
        email,
        password
      )
      
      if (success) {
        form.setValue("channels.email.status", "synced")
        toast.success("Email configuration saved successfully")
        form.setValue("channels.email.password", "STORED_SECURELY")
        
        setTimeout(() => {
          handleTestEmailConnection()
        }, 1000)
      } else {
        form.setValue("channels.email.status", "password_required")
        toast.error("Failed to save email credentials. Please ensure you're logged in.")
      }
    } catch (error) {
      console.error("Error saving email credentials:", error)
      form.setValue("channels.email.status", "password_required")
      toast.error("An error occurred while saving credentials")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleRemoveEmailCredentials = async (email: string) => {
    if (!siteId) return
    
    try {
      setIsConnecting(true)
      
      const success = await secureTokensService.deleteToken(
        siteId,
        'email',
        email || 'default'
      )
      
      if (success) {
        form.setValue("channels.email.status", "password_required")
        toast.success("Email credentials removed")
      } else {
        toast.error("Failed to remove email credentials. Please ensure you're logged in.")
      }
    } catch (error) {
      console.error("Error removing email credentials:", error)
      toast.error("An error occurred while removing email credentials")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleTestEmailConnection = async () => {
    if (isTestingConnection) return
    
    setIsTestingConnection(true)
    
    try {
      const email = form.getValues("channels.email.email")
      const password = form.getValues("channels.email.password")
      const emailStatus = form.getValues("channels.email.status")

      if (!email) {
        toast.error("Please enter email address before testing connection")
        return
      }

      if (emailStatus === "synced") {
        const emailConfig = {
          site_id: siteId,
          use_saved_credentials: true,
          ...(form.getValues("channels.email.incomingServer") && {
            incoming_server: form.getValues("channels.email.incomingServer"),
            incoming_port: form.getValues("channels.email.incomingPort"),
            outgoing_server: form.getValues("channels.email.outgoingServer"),
            outgoing_port: form.getValues("channels.email.outgoingPort"),
          })
        }

        const response = await apiClient.post('/api/agents/email/check', emailConfig)
        
        if (response.success) {
          toast.success("Email connection test successful!")
        } else {
          const errorCode = response.error?.code
          let errorMessage = "Email connection test failed"
          
          switch (errorCode) {
            case 'INVALID_REQUEST':
              errorMessage = "Invalid email configuration. Please check your settings."
              break
            case 'EMAIL_CONFIG_NOT_FOUND':
              errorMessage = "Email configuration not found. Please save your credentials first."
              break
            case 'EMAIL_FETCH_ERROR':
              errorMessage = "Failed to connect to email server. Please verify your credentials and server settings."
              break
            case 'SYSTEM_ERROR':
              errorMessage = "System error occurred. Please try again later."
              break
            default:
              errorMessage = typeof response.error === 'string' 
                ? response.error 
                : response.error?.message 
                ? String(response.error.message)
                : "Email connection test failed"
          }
          
          toast.error(errorMessage)
        }
        return
      }

      if (!password || password === "STORED_SECURELY") {
        toast.error("Please enter password or save credentials securely before testing connection")
        return
      }

      const emailConfig = {
        email: email,
        password: password,
        incomingServer: form.getValues("channels.email.incomingServer"),
        incomingPort: form.getValues("channels.email.incomingPort"),
        outgoingServer: form.getValues("channels.email.outgoingServer"),
        outgoingPort: form.getValues("channels.email.outgoingPort"),
      }

      const response = await apiClient.post('/api/agents/email/check', emailConfig)
      
      if (response.success) {
        toast.success("Email connection test successful!")
      } else {
        const errorCode = response.error?.code
        let errorMessage = "Email connection test failed"
        
        switch (errorCode) {
          case 'INVALID_REQUEST':
            errorMessage = "Invalid email configuration. Please check your settings."
            break
          case 'EMAIL_CONFIG_NOT_FOUND':
            errorMessage = "Email configuration not found. Please save your credentials first."
            break
          case 'EMAIL_FETCH_ERROR':
            errorMessage = "Failed to connect to email server. Please verify your credentials and server settings."
            break
          case 'SYSTEM_ERROR':
            errorMessage = "System error occurred. Please try again later."
            break
          default:
            errorMessage = typeof response.error === 'string' 
              ? response.error 
              : response.error?.message 
              ? String(response.error.message)
              : "Email connection test failed"
        }
        
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error("Error testing email connection:", error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
        ? error 
        : "Failed to test email connection"
      toast.error(errorMessage)
    } finally {
      setIsTestingConnection(false)
    }
  }

  if (!active) return null

  return (
    <SectionCard id="email-channel">
      <SectionCardHeader>
        <SectionCardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          BYOK SMTP Email
        </SectionCardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Configure email settings to send and receive messages
        </p>
      </SectionCardHeader>
      <SectionCardContent className="space-y-4">
        <FormField
          control={form.control}
          name="channels.email.enabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between">
              <div className="space-y-0.5">
                <FormLabel>Enable Email Channel</FormLabel>
                <FormDescription>
                  Activate email functionality for sending and receiving messages
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked)
                    if (checked) {
                      const currentStatus = form.getValues("channels.email.status")
                      if (currentStatus === "not_configured") {
                        form.setValue("channels.email.status", "password_required")
                      }
                    } else {
                      form.setValue("channels.email.status", "not_configured")
                    }
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {emailEnabled && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="channels.email.email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="youremail@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="channels.email.aliases"
              render={({ field }) => {
                const currentEmail = form.getValues("channels.email.email")
                let placeholder = "noreply@example.com, support@example.com, hello@example.com"
                
                if (currentEmail) {
                  const domain = currentEmail.split('@')[1]
                  if (domain) {
                    placeholder = `noreply@${domain}, support@${domain}, hello@${domain}`
                  }
                }
                
                return (
                  <FormItem>
                    <FormLabel>Respond Only Upcoming Messages from Aliases</FormLabel>
                    <FormControl>
                      <Input placeholder={placeholder} {...field} />
                    </FormControl>
                    <FormDescription>
                      The system will only respond to incoming emails addressed to these aliases. Leave empty to respond to all emails received.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            
            <FormItem>
              <FormLabel>Email Provider</FormLabel>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger className="flex h-11 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm placeholder:text-muted-foreground">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_PROVIDERS.map(provider => (
                    <SelectItem key={provider.name} value={provider.name}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Select your email provider to auto-fill server settings
              </FormDescription>
            </FormItem>

            {!hasEmailToken ? (
              <FormField
                control={form.control}
                name="channels.email.password"
                render={({ field }) => {
                  const currentProvider = EMAIL_PROVIDERS.find(p => p.name === selectedProvider)
                  return (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••••••"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? "Hide" : "Show"}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Your password is encrypted and stored securely
                      </FormDescription>
                      {currentProvider && (!field.value || field.value === 'STORED_SECURELY') && (
                        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-900">
                          <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                            <strong>Important:</strong> {currentProvider.passwordHint}
                          </p>
                          {currentProvider.helpUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => window.open(currentProvider.helpUrl, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              {currentProvider.helpText}
                            </Button>
                          )}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />
            ) : (
              <div className="flex items-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Email password stored securely</p>
                  <p className="text-xs text-muted-foreground">Your credentials are encrypted and stored in a secure vault</p>
                </div>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleRemoveEmailCredentials(form.getValues('channels.email.email') || 'default')}
                  disabled={isConnecting}
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="pt-4 border-t dark:border-white/5 border-black/5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-medium">Advanced Settings (Optional)</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="h-8 px-2 text-sm"
                >
                  {showAdvancedSettings ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show
                    </>
                  )}
                </Button>
              </div>
              
              {showAdvancedSettings && (
                <>
                  {(() => {
                    const currentProvider = EMAIL_PROVIDERS.find(p => p.name === selectedProvider)
                    return currentProvider && currentProvider.advancedHint ? (
                      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-900">
                        <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                          <strong>Note:</strong> {currentProvider.advancedHint}
                        </p>
                        {currentProvider.helpUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => window.open(currentProvider.helpUrl, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {currentProvider.helpText}
                          </Button>
                        )}
                      </div>
                    ) : null
                  })()}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <FormField
                      control={form.control}
                      name="channels.email.incomingServer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Incoming Mail Server</FormLabel>
                          <FormControl>
                            <Input placeholder="imap.example.com" {...field} disabled={selectedProvider !== 'Custom'} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="channels.email.incomingPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Incoming Port</FormLabel>
                          <FormControl>
                            <Input placeholder="993" {...field} disabled={selectedProvider !== 'Custom'} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="channels.email.outgoingServer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Outgoing Mail Server</FormLabel>
                          <FormControl>
                            <Input placeholder="smtp.example.com" {...field} disabled={selectedProvider !== 'Custom'} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="channels.email.outgoingPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Outgoing Port</FormLabel>
                          <FormControl>
                            <Input placeholder="587" {...field} disabled={selectedProvider !== 'Custom'} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </SectionCardContent>
      {emailEnabled && (
        <ActionFooter>
          <Button 
            type="button"
            variant="outline"
            onClick={() => {
              form.setValue("channels.email", {
                enabled: true,
                email: form.getValues("channels.email.email"),
                password: form.getValues("channels.email.password"),
                incomingServer: "",
                incomingPort: "",
                outgoingServer: "",
                outgoingPort: "",
                status: form.getValues("channels.email.status") || "not_configured"
              })
            }}
          >
            Reset Advanced Settings
          </Button>
          
          {hasEmailToken && (
            <Button
              type="button"
              variant="outline"
              onClick={handleTestEmailConnection}
              disabled={isTestingConnection}
            >
              <Globe className="w-4 h-4 mr-2" />
              {isTestingConnection ? "Testing..." : "Test Connection"}
            </Button>
          )}
          
          {!hasEmailToken && (
            <Button
              type="button"
              variant="default"
              onClick={handleSaveEmailCredentials}
              disabled={isConnecting || !form.getValues("channels.email.email") || !form.getValues("channels.email.password")}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {isConnecting ? "Saving..." : "Save Credentials Securely"}
            </Button>
          )}
          {onSave && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave('email-channel')}
              disabled={savingCard === 'email-channel' || !form.formState.isDirty}
            >
              {savingCard === 'email-channel' ? "Saving..." : "Save"}
            </Button>
          )}
        </ActionFooter>
      )}
    </SectionCard>
  )
}
