"use client"

import { useState } from "react"
import { UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
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
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form"
import { Input } from "../ui/input"
import { MessageSquare, CheckCircle2, Globe, Loader } from "../ui/icons"
import { type SiteFormValues } from "./form-schema"
import { useSite } from "../../context/SiteContext"

// Twilio supported countries and regions
const TWILIO_COUNTRIES = [
  { code: "US", name: "United States", hasRegions: true, hasCities: true },
  { code: "CA", name: "Canada", hasRegions: true, hasCities: true },
  { code: "GB", name: "United Kingdom", hasRegions: false, hasCities: true },
  { code: "DE", name: "Germany", hasRegions: false, hasCities: true },
  { code: "FR", name: "France", hasRegions: false, hasCities: true },
  { code: "IT", name: "Italy", hasRegions: false, hasCities: true },
  { code: "ES", name: "Spain", hasRegions: false, hasCities: true },
  { code: "NL", name: "Netherlands", hasRegions: false, hasCities: true },
  { code: "AU", name: "Australia", hasRegions: true, hasCities: true },
  { code: "SG", name: "Singapore", hasRegions: false, hasCities: false },
  { code: "JP", name: "Japan", hasRegions: false, hasCities: true },
  { code: "BR", name: "Brazil", hasRegions: true, hasCities: true },
  { code: "MX", name: "Mexico", hasRegions: false, hasCities: true },
  { code: "IN", name: "India", hasRegions: true, hasCities: true },
]

// Major cities available by country for new number selection
const US_CITIES = [
  { code: "NYC", name: "New York City", region: "NY" },
  { code: "LAX", name: "Los Angeles", region: "CA" },
  { code: "CHI", name: "Chicago", region: "IL" },
  { code: "HOU", name: "Houston", region: "TX" },
  { code: "MIA", name: "Miami", region: "FL" },
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

interface WhatsAppSectionProps {
  active: boolean
  form: UseFormReturn<SiteFormValues>
  siteId?: string
  siteName?: string
}

export function WhatsAppSection({ active, form, siteId, siteName }: WhatsAppSectionProps) {
  const [isRequesting, setIsRequesting] = useState(false)
  const [isLoadingWidget, setIsLoadingWidget] = useState(false)
  const [twilioAuthToken, setTwilioAuthToken] = useState<string | null>(null)
  const [showTwilioWidget, setShowTwilioWidget] = useState(false)
  const { currentSite, updateSettings } = useSite()

  if (!active) return null

  const whatsappConfig = form.watch("whatsapp")
  const isEnabled = whatsappConfig?.enabled || false
  const setupType = whatsappConfig?.setupType
  const selectedCountry = whatsappConfig?.country
  const selectedRegion = whatsappConfig?.region
  const existingNumber = whatsappConfig?.existingNumber
  const setupRequested = whatsappConfig?.setupRequested || false
  const hasApiToken = whatsappConfig?.apiToken === "STORED_SECURELY"

  const selectedCountryConfig = TWILIO_COUNTRIES.find(c => c.code === selectedCountry)
  const availableRegions = selectedCountryConfig?.hasRegions ? getRegionsForCountry(selectedCountry || "") : []
  const availableCities = selectedCountryConfig?.hasCities ? getCitiesForCountry(selectedCountry || "") : []

  const canRequestSetup = isEnabled && setupType && 
    (setupType === "port_existing" ? true : true) && // Port existing will use Twilio widget
    (setupType === "api_key" ? (whatsappConfig?.apiToken && whatsappConfig.apiToken.trim() !== '' && existingNumber && existingNumber.trim() !== '') : true) &&
    (setupType === "new_number" 
      ? (selectedCountry && (selectedCountryConfig?.hasCities ? selectedRegion : true))
      : (setupType === "port_existing" ? true : true)
    )

  const handleToggleEnabled = (enabled: boolean) => {
    form.setValue("whatsapp.enabled", enabled)
    if (!enabled) {
      // Reset all other fields when disabled
      form.setValue("whatsapp.setupType", undefined)
      form.setValue("whatsapp.country", undefined)
      form.setValue("whatsapp.region", undefined)
      form.setValue("whatsapp.existingNumber", undefined)
      form.setValue("whatsapp.setupRequested", false)
      setShowTwilioWidget(false)
      setTwilioAuthToken(null)
    }
  }

  const handleInitializeTwilioWidget = async () => {
    if (!siteId || !siteName) {
      toast.error("Missing required information for authorization")
      return
    }

    setIsLoadingWidget(true)
    try {
      const response = await fetch("/api/twilio-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          siteId,
          siteName
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to initialize Twilio authorization")
      }

      setTwilioAuthToken(result.data.token)
      setShowTwilioWidget(true)
      
      toast.success("Authorization widget loaded successfully")
    } catch (error) {
      console.error("Error initializing Twilio widget:", error)
      toast.error(error instanceof Error ? error.message : "Failed to initialize authorization")
    } finally {
      setIsLoadingWidget(false)
    }
  }

  const handleRequestSetup = async () => {
    if (!siteId || !siteName || !canRequestSetup) {
      toast.error("Missing required information for setup request")
      return
    }

    setIsRequesting(true)
    try {
      const setupData = {
        siteId,
        siteName,
        setupType: setupType!,
        country: setupType === "new_number" ? selectedCountry : undefined,
        region: setupType === "new_number" ? selectedRegion : undefined,
        existingNumber: (setupType === "port_existing" || setupType === "api_key") ? existingNumber : undefined,
        apiToken: setupType === "api_key" ? whatsappConfig?.apiToken : undefined
      }

      const response = await fetch("/api/whatsapp-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(setupData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit setup request")
      }

      // Mark setup as requested
      form.setValue("whatsapp.setupRequested", true)
      
      // Save WhatsApp configuration object similar to email
      if (currentSite && updateSettings && siteId) {
        try {
          const currentSettings = currentSite.settings || {};
          const whatsappConfig = {
            enabled: true,
            setupType: setupType!,
            country: setupType === "new_number" ? selectedCountry : undefined,
            region: setupType === "new_number" ? selectedRegion : undefined,
            existingNumber: setupType === "port_existing" ? existingNumber : undefined,
            setupRequested: true,
            status: "pending" as const
          };

          await updateSettings(siteId, {
            ...currentSettings,
            whatsapp: whatsappConfig
          });
          
          console.log("WhatsApp configuration saved with pending status");
        } catch (settingsError) {
          console.error("Error saving WhatsApp configuration:", settingsError);
          // Don't throw error, just log it as the main request was successful
        }
      }
      
      const successMessage = setupType === "api_key" 
        ? "Twilio API key submitted for validation! We'll verify and integrate it soon."
        : "WhatsApp setup request submitted successfully! Our team will contact you soon."
      
      toast.success(successMessage, {
        description: `Estimated setup time: ${result.data.estimated_setup_time}`
      })
    } catch (error) {
      console.error("Error submitting WhatsApp setup request:", error)
      toast.error(error instanceof Error ? error.message : "Failed to submit setup request")
    } finally {
      setIsRequesting(false)
    }
  }

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
            checked={isEnabled}
            onCheckedChange={handleToggleEnabled}
          />
        </div>

        {isEnabled && !setupRequested && !hasApiToken && (
          <>
            {/* Setup Type Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Choose Setup Option</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    setupType === "new_number"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    form.setValue("whatsapp.setupType", "new_number")
                    form.setValue("whatsapp.existingNumber", undefined)
                    form.setValue("whatsapp.apiToken", undefined)
                    setShowTwilioWidget(false)
                    setTwilioAuthToken(null)
                  }}
                >
                  <div>
                    <h4 className="font-medium">Get New Number</h4>
                    <p className="text-sm text-muted-foreground">
                      Recommended
                    </p>
                  </div>
                </div>

                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    setupType === "port_existing"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => {
                    form.setValue("whatsapp.setupType", "port_existing")
                    form.setValue("whatsapp.apiToken", undefined)
                    form.setValue("whatsapp.country", undefined)
                    form.setValue("whatsapp.region", undefined)
                  }}
                >
                  <div>
                    <h4 className="font-medium">Port Existing Number</h4>
                    <p className="text-sm text-muted-foreground">
                      Keep your current number
                    </p>
                  </div>
                </div>

                {/* Temporarily hidden for deployment */}
                {false && (
                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      setupType === "api_key"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => {
                      form.setValue("whatsapp.setupType", "api_key")
                      form.setValue("whatsapp.existingNumber", undefined)
                      form.setValue("whatsapp.country", undefined)
                      form.setValue("whatsapp.region", undefined)
                      setShowTwilioWidget(false)
                      setTwilioAuthToken(null)
                    }}
                  >
                    <div>
                      <h4 className="font-medium">Use Twilio API Key</h4>
                      <p className="text-sm text-muted-foreground">
                        Connect existing account
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Setup Type Explanations */}
            {setupType === "new_number" && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Get New Number - Features Enabled:</h4>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li>• WhatsApp Business API messaging</li>
                  <li>• SMS messaging capabilities</li>
                  <li>• Professional business number</li>
                  <li>• City-based number selection</li>
                  <li>• Quick 1-2 day setup process</li>
                  <li>• Full Twilio integration support</li>
                </ul>
              </div>
            )}

            {setupType === "port_existing" && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Port Existing Number - Features Enabled:</h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 mb-3">
                  <li>• Keep your existing business number</li>
                  <li>• WhatsApp Business API messaging</li>
                  <li>• SMS messaging capabilities</li>
                  <li>• Maintain customer recognition</li>
                  <li>• Professional number porting process</li>
                  <li>• Secure authorization via Twilio & Meta</li>
                </ul>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                    ⚠️ Important: Your number must be enabled for WhatsApp Business API in your current provider before porting.
                  </p>
                </div>
              </div>
            )}

            {setupType === "api_key" && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-900">
                <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Twilio API Integration - Features Enabled:</h4>
                <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                  <li>• Use your existing Twilio account</li>
                  <li>• WhatsApp Business API messaging</li>
                  <li>• SMS messaging capabilities</li>
                  <li>• Keep existing phone numbers</li>
                  <li>• Immediate integration (same day)</li>
                  <li>• Full control over your Twilio resources</li>
                </ul>
              </div>
            )}

            {setupType && (
              <>
                {/* Country Selection (only for new_number) */}
                {setupType === "new_number" && (
                  <FormField
                    control={form.control}
                    name="whatsapp.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value)
                            // Reset region when country changes
                            form.setValue("whatsapp.region", undefined)
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Region/City Selection (different based on setup type) */}
                {selectedCountryConfig && setupType === "new_number" && selectedCountryConfig.hasCities && availableCities.length > 0 && (
                  <FormField
                    control={form.control}
                    name="whatsapp.region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred City</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select preferred city for your number" />
                            </SelectTrigger>
                          </FormControl>
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
                        <p className="text-sm text-muted-foreground">
                          Choose the city where you'd like your new WhatsApp & SMS number to be based
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* WhatsApp Embedded Signup for Port Existing */}
                {setupType === "port_existing" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-900">
                      <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">WhatsApp Business Authorization</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                        To port your existing number, you'll need to authorize through Meta's WhatsApp Business Platform.
                        This secure process will connect your WhatsApp Business account to our platform.
                      </p>
                      
                      {!showTwilioWidget && (
                        <Button
                          onClick={handleInitializeTwilioWidget}
                          disabled={isLoadingWidget}
                          className="w-full"
                        >
                          {isLoadingWidget ? (
                            <>
                              <Loader className="mr-2 h-4 w-4 animate-spin" />
                              Loading Authorization...
                            </>
                          ) : (
                            "Start WhatsApp Business Authorization"
                          )}
                        </Button>
                      )}
                    </div>

                    {/* WhatsApp Embedded Signup Instructions */}
                    {showTwilioWidget && twilioAuthToken && (
                      <div className="space-y-4">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900">
                          <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Facebook Integration Required</h4>
                          <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                            WhatsApp Business authorization is handled through Meta's business platform. 
                            Please follow these steps to complete the setup:
                          </p>
                          <ol className="text-sm text-green-700 dark:text-green-300 space-y-2 list-decimal list-inside">
                            <li>Visit <strong>Facebook Business Manager</strong></li>
                            <li>Navigate to <strong>WhatsApp &gt; Getting Started</strong></li>
                            <li>Select <strong>Port Existing Number</strong></li>
                            <li>Follow the verification process</li>
                            <li>Configure webhooks to point to: <code className="bg-green-100 dark:bg-green-800 px-1 rounded text-xs">{process.env.NEXT_PUBLIC_API_SERVER_URL}/api/agents/whatsapp</code></li>
                          </ol>
                        </div>
                        
                        <div className="border rounded-lg p-6 bg-white dark:bg-gray-900 text-center">
                          <div className="mb-4">
                            <h3 className="text-lg font-medium mb-2">Complete Authorization at Meta</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              Click the button below to open Facebook Business Manager and complete your WhatsApp Business setup.
                            </p>
                          </div>
                          
                          <Button
                            asChild
                            className="mb-4"
                          >
                            <a 
                              href="https://business.facebook.com/whatsapp/getting-started"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2"
                            >
                              Open Facebook Business Manager
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </Button>
                          
                          <div className="text-xs text-muted-foreground">
                            <p>After completing the setup at Meta, your WhatsApp Business will be automatically connected.</p>
                          </div>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          <p><strong>Important:</strong> This process is handled securely by Meta. No credentials are shared with our platform.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Twilio API Key Input (for api_key setup) */}
                {setupType === "api_key" && (
                  <>
                    <FormField
                      control={form.control}
                      name="whatsapp.apiToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twilio API Key</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your Twilio API Key or Auth Token"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            Your existing Twilio API key for WhatsApp & SMS messaging
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="whatsapp.existingNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your Twilio phone number"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground">
                            The phone number from your Twilio account to use as sender (e.g., +1234567890)
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Setup Requested Status */}
        {setupRequested && !hasApiToken && setupType !== "api_key" && (
          <div className="flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-900">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">Setup request submitted</p>
              <p className="text-xs text-muted-foreground">
                {setupType === "port_existing" 
                  ? "Authorization completed. Our team will finalize the WhatsApp Business setup."
                  : "Our team will contact you soon to complete the WhatsApp Business setup"
                }
              </p>
            </div>
          </div>
        )}

        {/* API Key Connected Status */}
        {setupType === "api_key" && whatsappConfig?.apiToken && whatsappConfig.apiToken.trim() !== '' && (
          <div className="flex items-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">Twilio API connected</p>
              <p className="text-xs text-muted-foreground">
                Your Twilio API key is configured for WhatsApp & SMS messaging
              </p>
            </div>
          </div>
        )}

        {/* API Token Configured Status */}
        {hasApiToken && setupType !== "api_key" && (
          <div className="flex items-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">WhatsApp Business connected</p>
              <p className="text-xs text-muted-foreground">
                Your WhatsApp Business API is configured and ready to use
              </p>
            </div>
          </div>
        )}
      </CardContent>

      {/* Action Footer */}
      {isEnabled && !setupRequested && !hasApiToken && setupType && !showTwilioWidget && (
        <CardFooter className="px-8 py-4 bg-gray-50 dark:bg-gray-900/50 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {setupType === "new_number" 
                ? "We'll help you get a new WhatsApp & SMS number in your preferred city" 
                : setupType === "port_existing"
                ? "Authorize through Twilio & Meta to port your existing number"
                : "Connect your existing Twilio account for WhatsApp & SMS messaging"
              }
            </div>
            {setupType !== "port_existing" && (
              <Button
                onClick={setupType === "api_key" ? () => {
                  // For API key setup, just mark as configured
                  form.setValue("whatsapp.setupRequested", false)
                  toast.success("Twilio API key configured successfully!")
                } : handleRequestSetup}
                disabled={!canRequestSetup || isRequesting}
                className="ml-4"
              >
                {isRequesting ? "Requesting..." : setupType === "api_key" ? "Connect API" : "Request Setup"}
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  )
} 