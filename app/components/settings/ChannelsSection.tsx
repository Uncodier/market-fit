"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Switch } from "../ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Code, Copy, Check, Key, KeyRound, ShieldCheck, ExternalLink, ChevronDown, ChevronUp } from "../ui/icons"
import { Textarea } from "../ui/textarea"
import { ColorInput } from "../ui/color-input"
import { secureTokensService, type TokenType } from "../../services/secure-tokens-service"
import { toast } from "sonner"
import { useSite } from "../../context/SiteContext"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../ui/select"

export interface ChannelsSectionProps {
  active: boolean
  siteName?: string
  siteId?: string
  codeCopied?: boolean
  copyTrackingCode?: () => Promise<void>
}

// Definición de proveedores de correo conocidos
const EMAIL_PROVIDERS = [
  {
    name: "Gmail",
    incomingServer: "imap.gmail.com",
    incomingPort: "993",
    outgoingServer: "smtp.gmail.com",
    outgoingPort: "587"
  },
  {
    name: "Outlook/Hotmail",
    incomingServer: "outlook.office365.com",
    incomingPort: "993",
    outgoingServer: "smtp.office365.com",
    outgoingPort: "587"
  },
  {
    name: "Yahoo",
    incomingServer: "imap.mail.yahoo.com",
    incomingPort: "993",
    outgoingServer: "smtp.mail.yahoo.com",
    outgoingPort: "587"
  },
  {
    name: "Zoho",
    incomingServer: "imap.zoho.com",
    incomingPort: "993",
    outgoingServer: "smtp.zoho.com",
    outgoingPort: "587"
  },
  {
    name: "AOL",
    incomingServer: "imap.aol.com",
    incomingPort: "993",
    outgoingServer: "smtp.aol.com",
    outgoingPort: "587"
  },
  {
    name: "iCloud",
    incomingServer: "imap.mail.me.com",
    incomingPort: "993",
    outgoingServer: "smtp.mail.me.com",
    outgoingPort: "587"
  },
  {
    name: "ProtonMail",
    incomingServer: "imap.protonmail.ch",
    incomingPort: "993",
    outgoingServer: "smtp.protonmail.ch",
    outgoingPort: "587"
  },
  {
    name: "Custom",
    incomingServer: "",
    incomingPort: "",
    outgoingServer: "",
    outgoingPort: ""
  }
];

export function ChannelsSection({ active, siteName, siteId, codeCopied, copyTrackingCode }: ChannelsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const { currentSite, updateSettings } = useSite()
  const [internalCodeCopied, setInternalCodeCopied] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loadingTokens, setLoadingTokens] = useState(false)
  const [hasEmailToken, setHasEmailToken] = useState(false)
  const [hasWhatsAppToken, setHasWhatsAppToken] = useState(false)
  const [showTrackingCode, setShowTrackingCode] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState("Gmail")

  // Load token status on initial render
  useEffect(() => {
    const loadTokenStatus = async () => {
      if (!siteId) return;
      
      // Skip loading if we're already loading
      if (loadingTokens) return;
      
      setLoadingTokens(true);
      
      // Track failed attempts for debugging
      let failures = 0;
      
      try {
        // Only check for email token if we have an email address in the form
        const email = form.getValues('channels.email.email');
        if (email) {
          try {
            const hasEmail = await secureTokensService.hasToken(
              siteId, 
              'email',
              email || 'default'
            );
            setHasEmailToken(hasEmail);
          } catch (error) {
            console.error(`Error checking email credentials:`, error);
            failures++;
          }
        }
        
        // Check for WhatsApp token
        try {
          const hasWhatsApp = await secureTokensService.hasToken(
            siteId,
            'whatsapp',
            'default'
          );
          setHasWhatsAppToken(hasWhatsApp);
        } catch (error) {
          console.error(`Error checking WhatsApp token:`, error);
          failures++;
        }
      } catch (error) {
        console.error(`General error in loadTokenStatus:`, error);
      } finally {
        setLoadingTokens(false);
        
        // If all attempts failed but we're not catching the error, log it
        if (failures > 1) {
          console.error(`All token status checks failed`);
        }
      }
    };
    
    loadTokenStatus();
    
    // No need to add form as a dependency as we only want to check on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

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
      
      // Enable the email channel automatically
      form.setValue("channels.email.enabled", true);
      
      // Guardar todos los valores actualizados de configuración en un objeto
      const emailConfig = {
        enabled: true,
        email: email,
        // La contraseña será reemplazada con un placeholder después de guardarla
        password: "STORED_SECURELY", // Placeholder temporal
        incomingServer: form.getValues("channels.email.incomingServer"),
        incomingPort: form.getValues("channels.email.incomingPort"),
        outgoingServer: form.getValues("channels.email.outgoingServer"),
        outgoingPort: form.getValues("channels.email.outgoingPort"),
        provider: selectedProvider // Guardar también el proveedor seleccionado
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
        setHasEmailToken(true);
        toast.success("Email configuration saved successfully");
        
        // Clear the password field in the form and replace with placeholder
        form.setValue("channels.email.password", "");
      } else {
        toast.error("Failed to save email credentials. Please ensure you're logged in.");
      }
    } catch (error) {
      console.error("Error saving email credentials:", error);
      toast.error("An error occurred while saving credentials");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveWhatsAppToken = async () => {
    if (!siteId) {
      toast.error("Site ID is required to save token");
      return;
    }
    
    const token = form.getValues("whatsapp_token");
    
    if (!token) {
      toast.error("WhatsApp token is required");
      return;
    }
    
    try {
      setIsConnecting(true);
      
      // Guardar la configuración de WhatsApp en settings
      if (currentSite && updateSettings) {
        try {
          console.log("Guardando configuración de WhatsApp en settings...");
          
          // Actualizar settings con la referencia al token de WhatsApp
          await updateSettings(siteId, {
            whatsapp_token: "STORED_SECURELY"
          });
          
          console.log("Configuración de WhatsApp guardada correctamente en settings");
        } catch (settingsError) {
          console.error("Error guardando configuración de WhatsApp en settings:", settingsError);
          toast.error("Error saving WhatsApp configuration");
          throw settingsError;
        }
      }
      
      // Store the token securely
      const success = await secureTokensService.storeWhatsAppToken(
        siteId,
        token
      );
      
      if (success) {
        setHasWhatsAppToken(true);
        toast.success("WhatsApp configuration saved successfully");
        
        // Clear the token field in the form
        form.setValue("whatsapp_token", "");
      } else {
        toast.error("Failed to save WhatsApp token. Please ensure you're logged in.");
      }
    } catch (error) {
      console.error("Error saving WhatsApp token:", error);
      toast.error("An error occurred while saving token");
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
        setHasEmailToken(false);
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

  const handleRemoveWhatsAppToken = async () => {
    if (!siteId) return;
    
    try {
      setIsConnecting(true);
      
      const success = await secureTokensService.deleteToken(
        siteId,
        'whatsapp',
        'default'
      );
      
      if (success) {
        setHasWhatsAppToken(false);
        toast.success("WhatsApp token removed");
      } else {
        toast.error("Failed to remove WhatsApp token. Please ensure you're logged in.");
      }
    } catch (error) {
      console.error("Error removing WhatsApp token:", error);
      toast.error("An error occurred while removing WhatsApp token");
    } finally {
      setIsConnecting(false);
    }
  };

  if (!active) return null

  return (
    <>
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Website Channel</CardTitle>
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
          
          {form.watch("tracking.enable_chat") && (
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
          
          {form.watch("tracking.enable_chat") && (
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
          
          {form.watch("tracking.enable_chat") && (
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
          
          {form.watch("tracking.enable_chat") && (
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
          
          {form.watch("tracking.enable_chat") && (
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
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Email Channel</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configure email settings to send and receive messages
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
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
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {form.watch("channels.email.enabled") && (
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
              
              <FormItem>
                <FormLabel>Email Provider</FormLabel>
                <Select
                  value={selectedProvider}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground">
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
                  render={({ field }) => (
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
                      <FormMessage />
                    </FormItem>
                  )}
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

              {!hasEmailToken && (
                <div className="flex justify-between">
                  <Button 
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      form.setValue("channels.email", {
                        enabled: true,
                        email: form.getValues("channels.email.email"),
                        password: form.getValues("channels.email.password"),
                        incomingServer: "",
                        incomingPort: "",
                        outgoingServer: "",
                        outgoingPort: ""
                      });
                    }}
                  >
                    Reset Advanced Settings
                  </Button>
                  
                  <Button
                    type="button"
                    variant="default"
                    className="mt-2"
                    onClick={handleSaveEmailCredentials}
                    disabled={isConnecting || !form.getValues("channels.email.email") || !form.getValues("channels.email.password")}
                  >
                    <KeyRound className="w-4 h-4 mr-2" />
                    {isConnecting ? "Saving..." : "Save Credentials Securely"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">WhatsApp Business Channel</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Connect with WhatsApp Business API to enable messaging
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8 space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              WhatsApp integration allows you to communicate with your users directly through the WhatsApp platform.
              Connect your WhatsApp Business account by entering your token below.
            </p>
            
            {!hasWhatsAppToken ? (
              <FormField
                control={form.control}
                name="whatsapp_token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Business API Token</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          placeholder="Enter your WhatsApp API token"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      You can obtain your token from the WhatsApp Business Platform
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="flex items-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">WhatsApp token stored securely</p>
                  <p className="text-xs text-muted-foreground">Your WhatsApp API token is encrypted and stored in a secure vault</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={handleRemoveWhatsAppToken}
                  disabled={isConnecting}
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => window.open("https://business.whatsapp.com/products/business-platform", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Learn More
              </Button>
              
              {!hasWhatsAppToken && (
                <Button 
                  variant="default" 
                  type="button"
                  onClick={handleSaveWhatsAppToken}
                  disabled={isConnecting || !form.getValues("whatsapp_token")}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {isConnecting ? "Saving..." : "Save Token Securely"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
} 