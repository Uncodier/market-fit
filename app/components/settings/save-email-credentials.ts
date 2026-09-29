import { secureTokensService } from "../../services/secure-tokens-service"
import type { SiteFormValues } from "./form-schema"
import type { Site } from "../../context/SiteContext"

export async function saveEmailCredentials(data: SiteFormValues, currentSite: Site, settings: any) {
    // Handle secure token storage if new values are provided
    if (currentSite.id) {
      console.log("SAVE SECURE: Processing secure tokens");
      
      // Check for email credentials - Don't process 'STORED_SECURELY' as it's just a placeholder
      if (data.channels?.email?.password && 
          data.channels.email.password.trim() !== '' && 
          data.channels.email.password !== 'STORED_SECURELY') {
        try {
          console.log("SAVE SECURE: Storing email credentials");
          const emailIdentifier = data.channels.email.email || 'default';
          await secureTokensService.storeToken(
            currentSite.id,
            'email',
            data.channels.email.password,
            emailIdentifier
          );
          // Clear the password from the form data to avoid storing in plaintext
          data.channels.email.password = "";
          // Ensure channels structure exists and preserve existing whatsapp configuration
          if (!settings.channels) {
            settings.channels = {
              email: {},
              whatsapp: {}
            } as any;
          }
          if (!settings.channels.whatsapp) {
            settings.channels.whatsapp = {
              enabled: false,
              setupType: undefined,
              country: undefined,
              region: undefined,
              account_sid: undefined,
              existingNumber: undefined,
              setupRequested: false,
              status: "not_configured" as const
            };
          }
          // Update only email configuration fields from the form data, preserving existing whatsapp
          settings.channels.email = {
            enabled: data.channels.email.enabled || false,
            email: data.channels.email.email || "",
            password: "PASSWORD_PRESENT", // Indicate password is stored securely // ggignore
            aliases: data.channels.email.aliases || "",
            incomingServer: data.channels.email.incomingServer || "",
            incomingPort: data.channels.email.incomingPort || "",
            outgoingServer: data.channels.email.outgoingServer || "",
            outgoingPort: data.channels.email.outgoingPort || "",
            status: (data.channels.email.status || "not_configured") as "not_configured" | "password_required" | "pending_sync" | "synced"
          };
        } catch (tokenError) {
          console.error("Error storing email credentials:", tokenError);
        }
      } else if (data.channels?.email?.password === 'STORED_SECURELY' && data.channels.email.enabled) {
        // If using the stored password, make sure we keep ALL email configuration fields and preserve whatsapp
        if (!settings.channels) {
          settings.channels = {
            email: {},
            whatsapp: {}
          } as any;
        }
        if (!settings.channels.whatsapp) {
          settings.channels.whatsapp = {
            enabled: false,
            setupType: undefined,
            country: undefined,
            region: undefined,
            account_sid: undefined,
            existingNumber: undefined,
            setupRequested: false,
            status: "not_configured" as const
          };
        }
        // Update only email configuration, preserving existing whatsapp
        settings.channels.email = {
          enabled: data.channels.email.enabled || false,
          email: data.channels.email.email || "",
          password: "PASSWORD_PRESENT", // Keep the indicator // ggignore
          aliases: data.channels.email.aliases || "",
          incomingServer: data.channels.email.incomingServer || "",
          incomingPort: data.channels.email.incomingPort || "",
          outgoingServer: data.channels.email.outgoingServer || "",
          outgoingPort: data.channels.email.outgoingPort || "",
          status: (data.channels.email.status || "not_configured") as "not_configured" | "password_required" | "pending_sync" | "synced"
        };
        // Clear the placeholder from data
        data.channels.email.password = "";
      }
    }
    
}
