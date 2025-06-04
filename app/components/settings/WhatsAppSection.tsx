"use client"

import { useState, useEffect } from "react"
import { UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { ActionFooter } from "../ui/card-footer"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { Label } from "../ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { Input } from "../ui/input"
import { MessageSquare, CheckCircle2, Globe, Copy, AlertCircle } from "../ui/icons"
import { type SiteFormValues } from "./form-schema"
import { useSite } from "../../context/SiteContext"
import { secureTokensService } from "../../services/secure-tokens-service"

// Twilio supported countries and regions
const TWILIO_COUNTRIES = [
  { code: "US", name: "United States", hasCities: true },
  { code: "CA", name: "Canada", hasCities: true },
  { code: "GB", name: "United Kingdom", hasCities: true },
  { code: "DE", name: "Germany", hasCities: true },
  { code: "FR", name: "France", hasCities: true },
  { code: "IT", name: "Italy", hasCities: true },
  { code: "ES", name: "Spain", hasCities: true },
  { code: "NL", name: "Netherlands", hasCities: true },
  { code: "AU", name: "Australia", hasCities: true },
  { code: "SG", name: "Singapore", hasCities: false },
  { code: "JP", name: "Japan", hasCities: true },
  { code: "BR", name: "Brazil", hasCities: true },
  { code: "MX", name: "Mexico", hasCities: true },
  { code: "IN", name: "India", hasCities: true },
]

// Major cities available by country for new number selection
const US_CITIES = [
  { code: "NYC", name: "New York City" },
  { code: "LAX", name: "Los Angeles" },
  { code: "CHI", name: "Chicago" },
  { code: "HOU", name: "Houston" },
  { code: "MIA", name: "Miami" },
]

const CANADA_CITIES = [
  { code: "TOR", name: "Toronto", region: "ON" },
  { code: "VAN", name: "Vancouver", region: "BC" },
  { code: "MTL", name: "Montreal", region: "QC" },
  { code: "CAL", name: "Calgary", region: "AB" },
  { code: "OTT", name: "Ottawa", region: "ON" },
]

const UK_CITIES = [
  { code: "LON", name: "London" },
  { code: "MAN", name: "Manchester" },
  { code: "BIR", name: "Birmingham" },
  { code: "EDI", name: "Edinburgh" },
  { code: "GLA", name: "Glasgow" },
]

const GERMANY_CITIES = [
  { code: "BER", name: "Berlin" },
  { code: "MUN", name: "Munich" },
  { code: "HAM", name: "Hamburg" },
  { code: "FRA", name: "Frankfurt" },
  { code: "COL", name: "Cologne" },
]

const FRANCE_CITIES = [
  { code: "PAR", name: "Paris" },
  { code: "MAR", name: "Marseille" },
  { code: "LYO", name: "Lyon" },
  { code: "TOU", name: "Toulouse" },
  { code: "NIC", name: "Nice" },
]

const ITALY_CITIES = [
  { code: "ROM", name: "Rome" },
  { code: "MIL", name: "Milan" },
  { code: "NAP", name: "Naples" },
  { code: "TUR", name: "Turin" },
  { code: "FLO", name: "Florence" },
]

const SPAIN_CITIES = [
  { code: "MAD", name: "Madrid" },
  { code: "BCN", name: "Barcelona" },
  { code: "VAL", name: "Valencia" },
  { code: "SEV", name: "Seville" },
  { code: "BIL", name: "Bilbao" },
]

const NETHERLANDS_CITIES = [
  { code: "AMS", name: "Amsterdam" },
  { code: "ROT", name: "Rotterdam" },
  { code: "HAG", name: "The Hague" },
  { code: "UTR", name: "Utrecht" },
  { code: "EIN", name: "Eindhoven" },
]

const AUSTRALIA_CITIES = [
  { code: "SYD", name: "Sydney", region: "NSW" },
  { code: "MEL", name: "Melbourne", region: "VIC" },
  { code: "BRI", name: "Brisbane", region: "QLD" },
  { code: "PER", name: "Perth", region: "WA" },
  { code: "ADL", name: "Adelaide", region: "SA" },
]

const JAPAN_CITIES = [
  { code: "TOK", name: "Tokyo" },
  { code: "OSA", name: "Osaka" },
  { code: "KYO", name: "Kyoto" },
  { code: "NAG", name: "Nagoya" },
  { code: "YOK", name: "Yokohama" },
]

const BRAZIL_CITIES = [
  { code: "SAO", name: "São Paulo", region: "SP" },
  { code: "RIO", name: "Rio de Janeiro", region: "RJ" },
  { code: "BRA", name: "Brasília", region: "DF" },
  { code: "SAL", name: "Salvador", region: "BA" },
  { code: "FOR", name: "Fortaleza", region: "CE" },
]

const MEXICO_CITIES = [
  { code: "MEX", name: "Mexico City" },
  { code: "GDL", name: "Guadalajara" },
  { code: "MTY", name: "Monterrey" },
  { code: "PUE", name: "Puebla" },
  { code: "TIJ", name: "Tijuana" },
]

const INDIA_CITIES = [
  { code: "MUM", name: "Mumbai", region: "MH" },
  { code: "DEL", name: "New Delhi", region: "DL" },
  { code: "BAN", name: "Bangalore", region: "KA" },
  { code: "HYD", name: "Hyderabad", region: "TG" },
  { code: "CHE", name: "Chennai", region: "TN" },
]

const US_REGIONS = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
]

const CANADA_REGIONS = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "YT", name: "Yukon" },
]

const AUSTRALIA_REGIONS = [
  { code: "NSW", name: "New South Wales" },
  { code: "VIC", name: "Victoria" },
  { code: "QLD", name: "Queensland" },
  { code: "WA", name: "Western Australia" },
  { code: "SA", name: "South Australia" },
  { code: "TAS", name: "Tasmania" },
  { code: "ACT", name: "Australian Capital Territory" },
  { code: "NT", name: "Northern Territory" },
]

const BRAZIL_REGIONS = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
]

const INDIA_REGIONS = [
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CG", name: "Chhattisgarh" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JK", name: "Jammu and Kashmir" },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OR", name: "Odisha" },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TG", name: "Telangana" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UT", name: "Uttarakhand" },
  { code: "WB", name: "West Bengal" },
]

const getRegionsForCountry = (countryCode: string) => {
  switch (countryCode) {
    case "US":
      return US_REGIONS
    case "CA":
      return CANADA_REGIONS
    case "AU":
      return AUSTRALIA_REGIONS
    case "BR":
      return BRAZIL_REGIONS
    case "IN":
      return INDIA_REGIONS
    default:
      return []
  }
}

const getCitiesForCountry = (countryCode: string) => {
  switch (countryCode) {
    case "US":
      return US_CITIES
    case "CA":
      return CANADA_CITIES
    case "GB":
      return UK_CITIES
    case "DE":
      return GERMANY_CITIES
    case "FR":
      return FRANCE_CITIES
    case "IT":
      return ITALY_CITIES
    case "ES":
      return SPAIN_CITIES
    case "NL":
      return NETHERLANDS_CITIES
    case "AU":
      return AUSTRALIA_CITIES
    case "JP":
      return JAPAN_CITIES
    case "BR":
      return BRAZIL_CITIES
    case "MX":
      return MEXICO_CITIES
    case "IN":
      return INDIA_CITIES
    default:
      return []
  }
}

// Phone number validation
const validatePhoneNumber = (phoneNumber: string): { isValid: boolean; error?: string } => {
  if (!phoneNumber || phoneNumber.trim() === "") {
    return { isValid: false, error: "Phone number is required" }
  }

  const cleanNumber = phoneNumber.trim()

  // Must start with +
  if (!cleanNumber.startsWith("+")) {
    return { isValid: false, error: "Phone number must include country code (e.g., +1234567890)" }
  }

  // Remove + and check if remaining characters are digits
  const numberWithoutPlus = cleanNumber.substring(1)
  if (!/^\d+$/.test(numberWithoutPlus)) {
    return { isValid: false, error: "Phone number must contain only digits after country code" }
  }

  // Check length - international numbers should be 7-15 digits after country code
  if (numberWithoutPlus.length < 7 || numberWithoutPlus.length > 15) {
    return { isValid: false, error: "Phone number must be 7-15 digits after country code" }
  }

  // Basic country code validation (1-4 digits)
  const countryCodeMatch = numberWithoutPlus.match(/^(\d{1,4})/)
  if (!countryCodeMatch) {
    return { isValid: false, error: "Invalid country code" }
  }

  return { isValid: true }
}

interface WhatsAppSectionProps {
  active: boolean
  form: UseFormReturn<SiteFormValues>
  siteId?: string
}

// Local state interface
interface WhatsAppLocalState {
  enabled: boolean
  setupType?: "new_number" | "use_own_account"
  country?: string
  region?: string
  apiToken?: string
  accountSid?: string
  existingNumber?: string
  status: "not_configured" | "pending" | "active"
  setupRequested: boolean
  hasSecureToken: boolean // Track if secure token exists
}

export function WhatsAppSection({ active, form, siteId }: WhatsAppSectionProps) {
  const [isRequesting, setIsRequesting] = useState(false)
  const [phoneValidation, setPhoneValidation] = useState<{ isValid: boolean; error?: string }>({ isValid: true })
  const { currentSite, updateSettings } = useSite()
  
  // Local state to avoid form auto-save issues
  const [localState, setLocalState] = useState<WhatsAppLocalState>({
    enabled: false,
    status: "not_configured",
    setupRequested: false,
    hasSecureToken: false
  })

  // Initialize local state from current site data
  useEffect(() => {
    const initializeWhatsAppState = async () => {
      if (currentSite?.settings?.channels?.whatsapp) {
        const whatsappData = currentSite.settings.channels.whatsapp
        
        // Check if secure token exists using phone number as identifier
        let hasSecureToken = false
        if (siteId && whatsappData.setupType === "use_own_account" && whatsappData.existingNumber) {
          hasSecureToken = await secureTokensService.hasToken(siteId, 'twilio_whatsapp', whatsappData.existingNumber)
        }
        
        setLocalState({
          enabled: whatsappData.enabled || false,
          setupType: whatsappData.setupType,
          country: whatsappData.country,
          region: whatsappData.region,
          apiToken: "", // Never store token in local state
          accountSid: whatsappData.account_sid || "",
          existingNumber: whatsappData.existingNumber,
          status: whatsappData.status || "not_configured",
          setupRequested: whatsappData.setupRequested || false,
          hasSecureToken
        })
        
        // Validate existing number if present
        if (whatsappData.existingNumber) {
          setPhoneValidation(validatePhoneNumber(whatsappData.existingNumber))
        }
      }
    }

    initializeWhatsAppState()
  }, [currentSite, siteId])

  if (!active) return null

  // Validation logic for allowing user to save
  const canSaveConfiguration = () => {
    if (localState.setupType === "new_number") {
      if (!localState.country) return false
      const countryConfig = TWILIO_COUNTRIES.find(c => c.code === localState.country)
      if (countryConfig?.hasCities && !localState.region) return false
      return true
    }
    
    if (localState.setupType === "use_own_account") {
      // For saving new configuration, require API token, Account SID, and phone number
      // For already configured, just require valid phone number and Account SID
      if (localState.hasSecureToken) {
        return localState.accountSid?.trim() &&
               localState.existingNumber?.trim() && 
               phoneValidation.isValid
      } else {
        return localState.apiToken?.trim() && 
               localState.accountSid?.trim() &&
               localState.existingNumber?.trim() && 
               phoneValidation.isValid
      }
    }
    
    return false
  }

  const isConfigurationSaved = localState.status === "active"
  const isSetupPending = localState.status === "pending" || localState.setupRequested

  const handleToggleEnabled = (enabled: boolean) => {
    if (enabled) {
      setLocalState(prev => ({ ...prev, enabled: true }))
      toast.success("WhatsApp Business enabled. Configure your setup below.")
    } else {
      // Reset everything when disabling
      setLocalState({
        enabled: false,
        status: "not_configured",
        setupRequested: false,
        hasSecureToken: false
      })
      setPhoneValidation({ isValid: true })
      toast.success("WhatsApp Business disabled")
    }
  }

  const handleSetupTypeChange = (setupType: "new_number" | "use_own_account") => {
    setLocalState(prev => ({
      ...prev,
      setupType,
      // Clear fields from the other setup type
      ...(setupType === "new_number" ? {
        apiToken: "",
        accountSid: "",
        existingNumber: undefined,
        hasSecureToken: false
      } : {
        country: undefined,
        region: undefined
      })
    }))
    
    // Reset phone validation when changing setup type
    if (setupType === "new_number") {
      setPhoneValidation({ isValid: true })
    }
  }

  const handleCountryChange = (country: string) => {
    setLocalState(prev => ({
      ...prev,
      country,
      region: undefined // Reset region when country changes
    }))
  }

  const handleRegionChange = (region: string) => {
    setLocalState(prev => ({ ...prev, region }))
  }

  const handleApiTokenChange = (apiToken: string) => {
    setLocalState(prev => ({ ...prev, apiToken }))
  }

  const handleAccountSidChange = (accountSid: string) => {
    setLocalState(prev => ({ ...prev, accountSid }))
  }

  const handleExistingNumberChange = async (existingNumber: string) => {
    setLocalState(prev => ({ ...prev, existingNumber }))
    
    // Validate phone number in real-time
    const validation = validatePhoneNumber(existingNumber)
    setPhoneValidation(validation)
    
    // Check if secure token exists for this phone number
    if (siteId && existingNumber.trim() && validation.isValid && localState.setupType === "use_own_account") {
      const hasSecureToken = await secureTokensService.hasToken(siteId, 'twilio_whatsapp', existingNumber)
      setLocalState(prev => ({ ...prev, hasSecureToken }))
    } else {
      setLocalState(prev => ({ ...prev, hasSecureToken: false }))
    }
  }

  const handleSaveConfiguration = async () => {
    if (!currentSite || !canSaveConfiguration() || !siteId) return

    setIsRequesting(true)
    try {
      const newStatus = localState.setupType === "use_own_account" ? "active" : "pending"
      const newSetupRequested = localState.setupType === "new_number" ? true : false

      // For use_own_account, store API token securely
      let tokenStored = true
      if (localState.setupType === "use_own_account" && localState.apiToken?.trim() && localState.existingNumber?.trim()) {
        const result = await secureTokensService.storeToken(siteId, 'twilio_whatsapp', localState.apiToken, localState.existingNumber)
        tokenStored = !!result
        if (!tokenStored) {
          toast.error("Failed to securely store API token. Please try again.")
          return
        }
      }

      // Update settings without storing the API token
      await updateSettings(currentSite.id, {
        channels: {
          email: currentSite.settings?.channels?.email || {
            enabled: false,
            email: "",
            password: "",
            incomingServer: "",
            incomingPort: "",
            outgoingServer: "",
            outgoingPort: "",
            status: "not_configured"
          },
          whatsapp: {
            enabled: true,
            setupType: localState.setupType,
            country: localState.country,
            region: localState.region,
            account_sid: localState.accountSid,
            existingNumber: localState.existingNumber,
            // DO NOT store apiToken here - it's stored securely via secureTokensService
            setupRequested: newSetupRequested,
            status: newStatus
          }
        }
      })

      // Update local state to reflect saved state
      setLocalState(prev => {
        const updatedState: WhatsAppLocalState = {
          ...prev,
          status: newStatus as "not_configured" | "pending" | "active",
          setupRequested: newSetupRequested,
          hasSecureToken: localState.setupType === "use_own_account" && tokenStored,
          apiToken: "" // Clear API token from local state after saving
        }
        return updatedState
      })

      // Sync with form for consistency (without API token)
      form.setValue("channels.whatsapp", {
        enabled: true,
        setupType: localState.setupType,
        country: localState.country,
        region: localState.region,
        account_sid: localState.accountSid,
        existingNumber: localState.existingNumber,
        // DO NOT sync apiToken to form
        setupRequested: newSetupRequested,
        status: newStatus
      })

      const successMessage = localState.setupType === "use_own_account"
        ? "Twilio API configuration saved successfully!"
        : "WhatsApp setup request submitted! Our team will contact you soon."

      toast.success(successMessage)
    } catch (error) {
      console.error("Error saving WhatsApp configuration:", error)
      toast.error("Failed to save configuration")
    } finally {
      setIsRequesting(false)
    }
  }

  const handleResetConfiguration = async () => {
    try {
      // Delete secure token if it exists
      if (siteId && localState.hasSecureToken && localState.existingNumber) {
        await secureTokensService.deleteToken(siteId, 'twilio_whatsapp', localState.existingNumber)
      }

      // Reset local state
      setLocalState({
        enabled: false,
        status: "not_configured",
        setupRequested: false,
        hasSecureToken: false
      })

      // Reset phone validation
      setPhoneValidation({ isValid: true })

      // Clear form
      form.setValue("channels.whatsapp", {
        enabled: false,
        setupRequested: false,
        status: "not_configured"
      })

      // Save reset state to database
      if (currentSite) {
        await updateSettings(currentSite.id, {
          channels: {
            email: currentSite.settings?.channels?.email || {
              enabled: false,
              email: "",
              password: "",
              incomingServer: "",
              incomingPort: "",
              outgoingServer: "",
              outgoingPort: "",
              status: "not_configured"
            },
            whatsapp: {
              enabled: false,
              setupRequested: false,
              status: "not_configured"
            }
          }
        })
      }

      toast.success("WhatsApp configuration reset")
    } catch (error) {
      console.error("Error resetting WhatsApp configuration:", error)
      toast.error("Failed to reset configuration")
    }
  }

  const handleCopyWebhook = () => {
    const webhookUrl = `${process.env.NEXT_PUBLIC_API_SERVER_URL || 'https://your-domain.com'}/api/agents/whatsapp`
    navigator.clipboard.writeText(webhookUrl)
    toast.success("Webhook URL copied to clipboard!")
  }

  const selectedCountryConfig = TWILIO_COUNTRIES.find(c => c.code === localState.country)
  const availableCities = selectedCountryConfig ? getCitiesForCountry(localState.country!) : []

  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          WhatsApp Business Channel
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Connect with WhatsApp Business API to enable messaging with your customers
        </p>
      </CardHeader>
      <CardContent className="px-8 pb-4 space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="whatsapp-enabled" className="text-base font-medium">
              Enable WhatsApp Business
            </Label>
            <p className="text-sm text-muted-foreground">
              Allow customers to contact you via WhatsApp
            </p>
          </div>
          <Switch
            id="whatsapp-enabled"
            checked={localState.enabled}
            onCheckedChange={handleToggleEnabled}
          />
        </div>

        {/* Configuration Form - Only show if enabled and not already configured */}
        {localState.enabled && !isConfigurationSaved && !isSetupPending && (
          <>
            {/* Setup Type Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Choose Setup Option</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    localState.setupType === "new_number"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleSetupTypeChange("new_number")}
                >
                  <div>
                    <h4 className="font-medium">Get New Number</h4>
                    <p className="text-sm text-muted-foreground">Recommended</p>
                  </div>
                </div>

                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    localState.setupType === "use_own_account"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleSetupTypeChange("use_own_account")}
                >
                  <div>
                    <h4 className="font-medium">Use Your Own Twilio Account</h4>
                    <p className="text-sm text-muted-foreground">Connect existing account</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration Fields Based on Setup Type */}
            {localState.setupType === "new_number" && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">Country</Label>
                  <Select
                    onValueChange={handleCountryChange}
                    value={localState.country}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {TWILIO_COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            {country.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCountryConfig?.hasCities && availableCities.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-foreground">Preferred City</Label>
                    <Select onValueChange={handleRegionChange} value={localState.region}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select preferred city for your number" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCities.map((city) => (
                          <SelectItem key={city.code} value={city.code}>
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              {city.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose the city where you'd like your new WhatsApp & SMS number
                    </p>
                  </div>
                )}
              </div>
            )}

            {localState.setupType === "use_own_account" && (
              <div className="space-y-4">
                {!localState.hasSecureToken && (
                  <div>
                    <Label className="text-sm font-medium text-foreground">Twilio API Key</Label>
                    <Input
                      placeholder="Enter your Twilio API Key or Auth Token"
                      value={localState.apiToken || ""}
                      onChange={(e) => handleApiTokenChange(e.target.value)}
                      type="password"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Your existing Twilio API key for WhatsApp & SMS messaging (stored securely)
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-foreground">Twilio Account SID</Label>
                  <Input
                    placeholder="Enter your Twilio Account SID (e.g., ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)"
                    value={localState.accountSid || ""}
                    onChange={(e) => handleAccountSidChange(e.target.value)}
                    type="text"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Your Twilio Account SID identifier (starts with AC)
                  </p>
                </div>

                {localState.hasSecureToken && (
                  <div className="flex items-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">API Token Secured</p>
                      <p className="text-xs text-muted-foreground">
                        Your Twilio API token is securely stored and encrypted
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-foreground">Phone Number</Label>
                  <Input
                    placeholder="Enter your Twilio phone number (e.g., +1234567890)"
                    value={localState.existingNumber || ""}
                    onChange={(e) => handleExistingNumberChange(e.target.value)}
                    type="tel"
                    className={!phoneValidation.isValid ? "border-red-500 focus:border-red-500" : ""}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    The phone number from your Twilio account in international format with country code
                  </p>
                  {!phoneValidation.isValid && phoneValidation.error && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      {phoneValidation.error}
                    </div>
                  )}
                </div>

                {/* Webhook URL */}
                <div className="space-y-2">
                  <Label className="text-base font-medium">Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${process.env.NEXT_PUBLIC_API_SERVER_URL || 'https://your-domain.com'}/api/agents/whatsapp`}
                      readOnly
                      className="bg-gray-50 dark:bg-gray-900"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyWebhook}
                      className="px-3"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configure this webhook URL in your Twilio account for WhatsApp Business API
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Setup Pending Status */}
        {isSetupPending && (
          <div className="flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-900">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">Setup request submitted</p>
              <p className="text-xs text-muted-foreground">
                Our team will contact you soon to complete the WhatsApp Business setup
              </p>
            </div>
          </div>
        )}

        {/* Configuration Active Status */}
        {isConfigurationSaved && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">WhatsApp Business connected</p>
                <p className="text-xs text-muted-foreground">
                  Your WhatsApp Business API is configured and ready to use
                </p>
              </div>
            </div>

            {/* Show configured details */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-foreground">Setup Type</Label>
                <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border">
                  {localState.setupType === "new_number" ? "New Number (Managed by us)" : "Your Own Twilio Account"}
                </div>
              </div>

              {localState.existingNumber && (
                <div>
                  <Label className="text-sm font-medium text-foreground">Configured Phone Number</Label>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{localState.existingNumber}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    This number is configured for WhatsApp Business messaging
                  </p>
                </div>
              )}

              {localState.country && localState.setupType === "new_number" && (
                <div>
                  <Label className="text-sm font-medium text-foreground">Requested Location</Label>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {TWILIO_COUNTRIES.find(c => c.code === localState.country)?.name}
                      {localState.region && (
                        <span className="text-muted-foreground"> - {
                          getCitiesForCountry(localState.country).find(c => c.code === localState.region)?.name ||
                          getRegionsForCountry(localState.country).find(r => r.code === localState.region)?.name ||
                          localState.region
                        }</span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {localState.accountSid && localState.setupType === "use_own_account" && (
                <div>
                  <Label className="text-sm font-medium text-foreground">Twilio Account SID</Label>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{localState.accountSid}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your configured Twilio Account SID
                  </p>
                </div>
              )}

              {localState.hasSecureToken && (
                <div>
                  <Label className="text-sm font-medium text-foreground">API Security</Label>
                  <div className="mt-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm">API Token is securely stored and encrypted</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Action Footer */}
      {localState.enabled && (
        <ActionFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {!isConfigurationSaved && !isSetupPending && localState.setupType ? (
                localState.setupType === "new_number"
                  ? "We'll help you get a new WhatsApp & SMS number in your preferred city"
                  : "Connect your existing Twilio account for WhatsApp & SMS messaging"
              ) : isConfigurationSaved ? (
                "WhatsApp Business is configured and ready"
              ) : isSetupPending ? (
                "Setup request submitted - waiting for completion"
              ) : (
                "Configure your WhatsApp Business setup above"
              )}
            </div>

            <div className="flex gap-2">
              {!isConfigurationSaved && !isSetupPending && canSaveConfiguration() && (
                <Button
                  onClick={handleSaveConfiguration}
                  disabled={isRequesting}
                >
                  {isRequesting ? "Saving..." : localState.setupType === "new_number" ? "Request Setup" : "Save Configuration"}
                </Button>
              )}

              {(isConfigurationSaved || isSetupPending) && (
                <Button
                  variant="outline"
                  onClick={handleResetConfiguration}
                  disabled={isRequesting}
                >
                  Reset Configuration
                </Button>
              )}
            </div>
          </div>
        </ActionFooter>
      )}
    </Card>
  )
} 