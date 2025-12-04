"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Switch } from "../ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { ActionFooter } from "../ui/card-footer"
import { Button } from "../ui/button"
import { Code, Copy, Check, Key, KeyRound, ShieldCheck, ExternalLink, ChevronDown, ChevronUp, Mail, Globe } from "../ui/icons"
import { Textarea } from "../ui/textarea"
import { ColorInput } from "../ui/color-input"
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
import { WhatsAppSection } from "./WhatsAppSection"

export interface ChannelsSectionProps {
  active: boolean
  siteName?: string
  siteId?: string
  codeCopied?: boolean
  copyTrackingCode?: () => Promise<void>
  onSave?: (data: SiteFormValues) => void
}

// Definición de proveedores de correo conocidos
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
];

export function ChannelsSection({ active, siteName, siteId, codeCopied, copyTrackingCode, onSave }: ChannelsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const { currentSite, updateSettings, updateSite } = useSite()
  const [internalCodeCopied, setInternalCodeCopied] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showTrackingCode, setShowTrackingCode] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState("Gmail")
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving channels:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Get the email channel status from form (using getValues instead of watch)
  const emailStatus = form.getValues("channels.email.status") || "not_configured";
  const hasEmailToken = emailStatus === "synced";
  
  // Get enable_chat status (using getValues instead of watch)
  const enableChat = form.getValues("tracking.enable_chat") || false;
  const emailEnabled = form.getValues("channels.email.enabled") || false;
  
  // Función para detectar proveedor basado en el email
  const detectProviderFromEmail = (email: string) => {
    if (!email) return null;
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return null;
    
    if (domain === 'gmail.com') return 'Gmail';
    if (domain === 'hotmail.com' || domain === 'outlook.com' || domain.includes('live.com')) return 'Outlook/Hotmail';
    if (domain === 'yahoo.com' || domain.includes('yahoo.')) return 'Yahoo';
    if (domain === 'zoho.com') return 'Zoho';
    if (domain === 'aol.com') return 'AOL';
    if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') return 'iCloud';
    if (domain === 'protonmail.com' || domain === 'protonmail.ch' || domain === 'pm.me') return 'ProtonMail';
    
    return null;
  };

  // Handler para cuando cambia el email
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'channels.email.email') {
        const email = value.channels?.email?.email || '';
        const provider = detectProviderFromEmail(email);
        if (provider) {
          setSelectedProvider(provider);
          
          // Obtener configuración del proveedor
          const providerConfig = EMAIL_PROVIDERS.find(p => p.name === provider);
          if (providerConfig) {
            form.setValue('channels.email.incomingServer', providerConfig.incomingServer);
            form.setValue('channels.email.incomingPort', providerConfig.incomingPort);
            form.setValue('channels.email.outgoingServer', providerConfig.outgoingServer);
            form.setValue('channels.email.outgoingPort', providerConfig.outgoingPort);
          }
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  // Handler para cambiar proveedor manualmente
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    
    // Obtener configuración del proveedor
    const providerConfig = EMAIL_PROVIDERS.find(p => p.name === provider);
    if (providerConfig) {
      form.setValue('channels.email.incomingServer', providerConfig.incomingServer);
      form.setValue('channels.email.incomingPort', providerConfig.incomingPort);
      form.setValue('channels.email.outgoingServer', providerConfig.outgoingServer);
      form.setValue('channels.email.outgoingPort', providerConfig.outgoingPort);
    }
    
    // Si es Custom, no rellenar nada
    if (provider === 'Custom') {
      form.setValue('channels.email.incomingServer', '');
      form.setValue('channels.email.incomingPort', '');
      form.setValue('channels.email.outgoingServer', '');
      form.setValue('channels.email.outgoingPort', '');
    }
  };

  // Inicializar los valores de servidor de Gmail cuando se carga el componente
  useEffect(() => {
    // Solo inicializar si no hay valores ya establecidos
    const existingServer = form.getValues('channels.email.incomingServer');
    
    if (!existingServer) {
      const gmailConfig = EMAIL_PROVIDERS.find(p => p.name === "Gmail");
      if (gmailConfig) {
        form.setValue('channels.email.incomingServer', gmailConfig.incomingServer);
        form.setValue('channels.email.incomingPort', gmailConfig.incomingPort);
        form.setValue('channels.email.outgoingServer', gmailConfig.outgoingServer);
        form.setValue('channels.email.outgoingPort', gmailConfig.outgoingPort);
      }
    }
  }, [form]);

  const handleCopyTrackingCode = async () => {
    if (copyTrackingCode) {
      return copyTrackingCode()
    }
    
    const trackingCode = `<script>
  (function() {
    window.MarketFit = window.MarketFit || {};
    
    MarketFit.siteId = "${siteId || siteName || 'YOUR_SITE_ID'}";
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://files.uncodie.com/tracking.min.js';
    
    script.onload = function() {
      if (window.MarketFit && typeof window.MarketFit.init === 'function') {
        window.MarketFit.init({
          siteId: "${siteId || siteName || 'YOUR_SITE_ID'}",
          trackVisitors: ${form.getValues("tracking.track_visitors")},
          trackActions: ${form.getValues("tracking.track_actions")},
          recordScreen: ${form.getValues("tracking.record_screen")},
          debug: false,
          chat: {
            enabled: ${form.getValues("tracking.enable_chat")},
            accentColor: "${form.getValues("tracking.chat_accent_color") || "#e0ff17"}",
            allowAnonymousMessages: ${form.getValues("tracking.allow_anonymous_messages") || false},
            position: "${form.getValues("tracking.chat_position") || "bottom-right"}",
            title: "${form.getValues("tracking.chat_title") || "Chat with us"}",
            welcomeMessage: "${form.getValues("tracking.welcome_message") || "Welcome to our website! How can we assist you today?"}"
          }
        });
      }
    };
    
    var firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  })();
</script>`

    try {
      // Try to use the modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(trackingCode);
        setInternalCodeCopied(true);
        toast.success("Tracking code copied to clipboard");
        setTimeout(() => setInternalCodeCopied(false), 2000);
        return;
      }
      
      // Fallback to older document.execCommand method
      const textArea = document.createElement('textarea');
      textArea.value = trackingCode;
      
      // Make the textarea out of viewport
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      
      // Select and copy
      textArea.focus();
      textArea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (success) {
        setInternalCodeCopied(true);
        toast.success("Tracking code copied to clipboard");
        setTimeout(() => setInternalCodeCopied(false), 2000);
      } else {
        throw new Error("Copy command failed");
      }
    } catch (err) {
      console.error("Error copying tracking code:", err);
      toast.error("Failed to copy tracking code. Please try selecting and copying manually.");
    }
  }

  const handleConnectWhatsApp = async () => {
    try {
      setIsConnecting(true)
      // Here you would integrate with WhatsApp Business API
      setTimeout(() => {
        setIsConnecting(false)
      }, 1500)
    } catch (err) {
      console.error("Error connecting to WhatsApp Business API:", err)
      setIsConnecting(false)
    }
  }

  const handleSaveEmailCredentials = async () => {
    if (!siteId) {
      toast.error("Site ID is required to save credentials");
      return;
    }
    
    const email = form.getValues("channels.email.email");
    const password = form.getValues("channels.email.password");
    const incomingServer = form.getValues("channels.email.incomingServer");
    const incomingPort = form.getValues("channels.email.incomingPort");
    const outgoingServer = form.getValues("channels.email.outgoingServer");
    const outgoingPort = form.getValues("channels.email.outgoingPort");
    
    // Validar los campos requeridos
    if (!email) {
      toast.error("Email address is required");
      return;
    }
    
    if (!password) {
      toast.error("Password is required");
      return;
    }
    
    // Solo validar los campos de servidor si el proveedor es Custom
    if (selectedProvider === 'Custom') {
      if (!incomingServer) {
        toast.error("Incoming mail server is required");
        return;
      }
      
      if (!incomingPort) {
        toast.error("Incoming port is required");
        return;
      }
      
      if (!outgoingServer) {
        toast.error("Outgoing mail server is required");
        return;
      }
      
      if (!outgoingPort) {
        toast.error("Outgoing port is required");
        return;
      }
    } else {
      // Si es un proveedor conocido, asegurarse de que los campos estén completos
      const providerConfig = EMAIL_PROVIDERS.find(p => p.name === selectedProvider);
      if (providerConfig) {
        form.setValue('channels.email.incomingServer', providerConfig.incomingServer);
        form.setValue('channels.email.incomingPort', providerConfig.incomingPort);
        form.setValue('channels.email.outgoingServer', providerConfig.outgoingServer);
        form.setValue('channels.email.outgoingPort', providerConfig.outgoingPort);
      }
    }
    
    try {
      setIsConnecting(true);
      
      // Set status to pending_sync while saving
      form.setValue("channels.email.status", "pending_sync");
      
      // Enable the email channel automatically
      form.setValue("channels.email.enabled", true);
      
      // Guardar todos los valores actualizados de configuración en un objeto
      const emailConfig = {
        enabled: true,
        email: email,
        // La contraseña será reemplazada con un placeholder después de guardarla
        password: "STORED_SECURELY", // Placeholder temporal
        aliases: form.getValues("channels.email.aliases") || "",
        incomingServer: form.getValues("channels.email.incomingServer"),
        incomingPort: form.getValues("channels.email.incomingPort"),
        outgoingServer: form.getValues("channels.email.outgoingServer"),
        outgoingPort: form.getValues("channels.email.outgoingPort"),
        provider: selectedProvider, // Guardar también el proveedor seleccionado
        status: "synced" as "not_configured" | "password_required" | "pending_sync" | "synced" // This will be saved to the database
      };
      
      // Guardar la configuración de correo electrónico directamente en settings
      if (currentSite && updateSettings) {
        try {
          console.log("Guardando configuración del canal en settings...");
          
          // Obtener los channels actuales de settings, si existen
          const currentSettings = currentSite.settings || {};
          const currentChannels = currentSettings.channels || {};
          
          // Crear nuevo objeto channels con la configuración de email actualizada
          const updatedChannels = {
            ...currentChannels,
            email: emailConfig
          };
          
          // Actualizar settings con los canales actualizados
          await updateSettings(siteId, {
            channels: updatedChannels
          });
          
          console.log("Configuración del canal guardada correctamente en settings");
        } catch (settingsError) {
          console.error("Error guardando configuración del canal en settings:", settingsError);
          // Revert status on error
          form.setValue("channels.email.status", "password_required");
          toast.error("Error saving channel configuration");
          throw settingsError;
        }
      }
      
      // Store the password securely
      const success = await secureTokensService.storeEmailCredentials(
        siteId,
        email,
        password
      );
      
      if (success) {
        // Update the status in the form to synced
        form.setValue("channels.email.status", "synced");
        toast.success("Email configuration saved successfully");
        
        // Replace password field with security indicator
        form.setValue("channels.email.password", "STORED_SECURELY");
        
        // Automatically test connection after successful save
        setTimeout(() => {
          handleTestEmailConnection();
        }, 1000); // Wait 1 second to ensure UI updates
      } else {
        // Revert status on error
        form.setValue("channels.email.status", "password_required");
        toast.error("Failed to save email credentials. Please ensure you're logged in.");
      }
    } catch (error) {
      console.error("Error saving email credentials:", error);
      // Revert status on error
      form.setValue("channels.email.status", "password_required");
      toast.error("An error occurred while saving credentials");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemoveEmailCredentials = async (email: string) => {
    if (!siteId) return;
    
    try {
      setIsConnecting(true);
      
      const success = await secureTokensService.deleteToken(
        siteId,
        'email',
        email || 'default'
      );
      
      if (success) {
        // Update the status in the form
        form.setValue("channels.email.status", "password_required");
        toast.success("Email credentials removed");
      } else {
        toast.error("Failed to remove email credentials. Please ensure you're logged in.");
      }
    } catch (error) {
      console.error("Error removing email credentials:", error);
      toast.error("An error occurred while removing email credentials");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestEmailConnection = async () => {
    if (isTestingConnection) return;
    
    setIsTestingConnection(true);
    
    try {
      const email = form.getValues("channels.email.email");
      const password = form.getValues("channels.email.password");
      const emailStatus = form.getValues("channels.email.status");

      if (!email) {
        toast.error("Please enter email address before testing connection");
        return;
      }

      // If we have saved credentials (status is synced), use them for testing
      if (emailStatus === "synced") {
        const emailConfig = {
          site_id: siteId,
          use_saved_credentials: true,
          // Include server settings if available
          ...(form.getValues("channels.email.incomingServer") && {
            incoming_server: form.getValues("channels.email.incomingServer"),
            incoming_port: form.getValues("channels.email.incomingPort"),
            outgoing_server: form.getValues("channels.email.outgoingServer"),
            outgoing_port: form.getValues("channels.email.outgoingPort"),
          })
        };

        const response = await apiClient.post('/api/agents/email/check', emailConfig);
        
        if (response.success) {
          toast.success("Email connection test successful!");
        } else {
          const errorCode = response.error?.code;
          let errorMessage = "Email connection test failed";
          
          switch (errorCode) {
            case 'INVALID_REQUEST':
              errorMessage = "Invalid email configuration. Please check your settings.";
              break;
            case 'EMAIL_CONFIG_NOT_FOUND':
              errorMessage = "Email configuration not found. Please save your credentials first.";
              break;
            case 'EMAIL_FETCH_ERROR':
              errorMessage = "Failed to connect to email server. Please verify your credentials and server settings.";
              break;
            case 'SYSTEM_ERROR':
              errorMessage = "System error occurred. Please try again later.";
              break;
            default:
              errorMessage = typeof response.error === 'string' 
                ? response.error 
                : response.error?.message 
                ? String(response.error.message)
                : "Email connection test failed";
          }
          
          toast.error(errorMessage);
        }
        return;
      }

      // If no saved credentials, use form password
      if (!password || password === "STORED_SECURELY") {
        toast.error("Please enter password or save credentials securely before testing connection");
        return;
      }

      const emailConfig = {
        email: email,
        password: password,
        incomingServer: form.getValues("channels.email.incomingServer"),
        incomingPort: form.getValues("channels.email.incomingPort"),
        outgoingServer: form.getValues("channels.email.outgoingServer"),
        outgoingPort: form.getValues("channels.email.outgoingPort"),
      };

      const response = await apiClient.post('/api/agents/email/check', emailConfig);
      
      if (response.success) {
        toast.success("Email connection test successful!");
      } else {
        const errorCode = response.error?.code;
        let errorMessage = "Email connection test failed";
        
        switch (errorCode) {
          case 'INVALID_REQUEST':
            errorMessage = "Invalid email configuration. Please check your settings.";
            break;
          case 'EMAIL_CONFIG_NOT_FOUND':
            errorMessage = "Email configuration not found. Please save your credentials first.";
            break;
          case 'EMAIL_FETCH_ERROR':
            errorMessage = "Failed to connect to email server. Please verify your credentials and server settings.";
            break;
          case 'SYSTEM_ERROR':
            errorMessage = "System error occurred. Please try again later.";
            break;
          default:
            errorMessage = typeof response.error === 'string' 
              ? response.error 
              : response.error?.message 
              ? String(response.error.message)
              : "Email connection test failed";
        }
        
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Error testing email connection:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
        ? error 
        : "Failed to test email connection";
      toast.error(errorMessage);
    } finally {
      setIsTestingConnection(false);
    }
  };


  if (!active) return null

  return (
    <>
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Website Channel
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how your site tracks visitor behavior
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <FormField
            control={form.control}
            name="tracking.track_visitors"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Track Visitors</FormLabel>
                  <FormDescription>
                    Collect anonymous data about visitors to your site
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tracking.track_actions"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Track User Actions</FormLabel>
                  <FormDescription>
                    Record clicks, form submissions, and other interactions
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tracking.record_screen"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Session Recording</FormLabel>
                  <FormDescription>
                    Record user sessions to replay their experience
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tracking.enable_chat"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Enable Chat</FormLabel>
                  <FormDescription>
                    Show a chat widget on your site for visitor communication
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          
          {enableChat && (
            <FormField
              control={form.control}
              name="tracking.chat_accent_color"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Chat Accent Color</FormLabel>
                    <FormDescription>
                      Customize the color of the chat widget to match your brand
                    </FormDescription>
                  </div>
                  <FormControl>
                    <ColorInput
                      value={field.value}
                      onChange={field.onChange}
                      showHexValue={true}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          
          {enableChat && (
            <FormField
              control={form.control}
              name="tracking.chat_position"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Chat Position</FormLabel>
                    <FormDescription>
                      Choose where the chat widget appears on your site
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Select
                      value={field.value || "bottom-right"}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="top-left">Top Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          
          {enableChat && (
            <FormField
              control={form.control}
              name="tracking.chat_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chat Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Chat with us"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Title displayed on the chat widget
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {enableChat && (
            <FormField
              control={form.control}
              name="tracking.welcome_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Welcome Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Welcome to our website! How can we assist you today?"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Initial message visitors see when the chat widget opens. Default: "Welcome to our website! How can we assist you today?"
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {enableChat && (
            <FormField
              control={form.control}
              name="tracking.allow_anonymous_messages"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Allow Anonymous Messages</FormLabel>
                    <FormDescription>
                      Allow visitors to send messages without providing contact information
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-medium">Chat and Tracking Code</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTrackingCode(!showTrackingCode)}
                className="h-8 px-2 text-sm"
              >
                {showTrackingCode ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Hide Code
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Show Code
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Add this code to your site to enable tracking and chat functionality
            </p>
            
            {showTrackingCode && (
              <div className="space-y-4">
                <div className="relative">
                  <div className="rounded-md bg-gray-900 p-4 overflow-x-auto">
                    <pre className="text-sm text-white">
                      <code>{`<script>
  (function() {
    window.MarketFit = window.MarketFit || {};
    
    MarketFit.siteId = "${siteId || siteName || 'YOUR_SITE_ID'}";
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://files.uncodie.com/tracking.min.js';
    
    script.onload = function() {
      if (window.MarketFit && typeof window.MarketFit.init === 'function') {
        window.MarketFit.init({
          siteId: "${siteId || siteName || 'YOUR_SITE_ID'}",
          trackVisitors: ${form.getValues("tracking.track_visitors")},
          trackActions: ${form.getValues("tracking.track_actions")},
          recordScreen: ${form.getValues("tracking.record_screen")},
          debug: false,
          chat: {
            enabled: ${form.getValues("tracking.enable_chat")},
            accentColor: "${form.getValues("tracking.chat_accent_color") || "#e0ff17"}",
            allowAnonymousMessages: ${form.getValues("tracking.allow_anonymous_messages") || false},
            position: "${form.getValues("tracking.chat_position") || "bottom-right"}",
            title: "${form.getValues("tracking.chat_title") || "Chat with us"}",
            welcomeMessage: "${form.getValues("tracking.welcome_message") || "Welcome to our website! How can we assist you today?"}"
          }
        });
      }
    };
    
    var firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  })();
</script>`}</code>
                    </pre>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 h-8 w-8 p-0"
                    onClick={handleCopyTrackingCode}
                  >
                    {(codeCopied || internalCodeCopied) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Place this code in the <code>&lt;head&gt;</code> section of every page you want to track.
                </p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button
            type="button"
            variant="default"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Channel
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configure email settings to send and receive messages
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8">
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
                      field.onChange(checked);
                      // If enabling and no password is synced, set status to password_required
                      if (checked) {
                        const currentStatus = form.getValues("channels.email.status");
                        if (currentStatus === "not_configured") {
                          form.setValue("channels.email.status", "password_required");
                        }
                      } else {
                        // If disabling, reset to not_configured
                        form.setValue("channels.email.status", "not_configured");
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
                      <Input
                        placeholder="youremail@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="channels.email.aliases"
                render={({ field }) => {
                  // Generate placeholder based on the current email
                  const currentEmail = form.getValues("channels.email.email");
                  let placeholder = "noreply@example.com, support@example.com, hello@example.com";
                  
                  if (currentEmail) {
                    const domain = currentEmail.split('@')[1];
                    if (domain) {
                      placeholder = `noreply@${domain}, support@${domain}, hello@${domain}`;
                    }
                  }
                  
                  return (
                    <FormItem>
                      <FormLabel>Respond Only Upcoming Messages from Aliases</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={placeholder}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The system will only respond to incoming emails addressed to these aliases. Leave empty to respond to all emails received.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              
              <FormItem>
                <FormLabel>Email Provider</FormLabel>
                <Select
                  value={selectedProvider}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger className="flex h-11 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm ring-offset-background placeholder:text-muted-foreground">
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
                    // Obtener el hint del proveedor actual
                    const currentProvider = EMAIL_PROVIDERS.find(p => p.name === selectedProvider);
                    
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
                    );
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

              <div className="pt-4 border-t border-border">
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
                      const currentProvider = EMAIL_PROVIDERS.find(p => p.name === selectedProvider);
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
                      ) : null;
                    })()}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <FormField
                        control={form.control}
                        name="channels.email.incomingServer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Incoming Mail Server</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="imap.example.com"
                                {...field}
                                disabled={selectedProvider !== 'Custom'}
                              />
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
                              <Input
                                placeholder="993"
                                {...field}
                                disabled={selectedProvider !== 'Custom'}
                              />
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
                              <Input
                                placeholder="smtp.example.com"
                                {...field}
                                disabled={selectedProvider !== 'Custom'}
                              />
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
                              <Input
                                placeholder="587"
                                {...field}
                                disabled={selectedProvider !== 'Custom'}
                              />
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
        </CardContent>
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
                });
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
                variant="default"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            )}
          </ActionFooter>
        )}
      </Card>

      <WhatsAppSection 
        active={active} 
        form={form} 
        siteId={siteId}
        onSave={onSave}
      />
    </>
  )
} 