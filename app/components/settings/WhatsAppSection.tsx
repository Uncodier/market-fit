"use client"

import { useState } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form"
import { Input } from "../ui/input"
import { MessageSquare, CheckCircle2, Globe, Copy } from "../ui/icons"
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
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false)
  const { currentSite, updateSettings } = useSite()

  if (!active) return null

  const whatsappConfig = form.watch("channels.whatsapp")
  const isEnabled = whatsappConfig?.enabled || false
  const setupType = whatsappConfig?.setupType
  const selectedCountry = whatsappConfig?.country
  const selectedRegion = whatsappConfig?.region
  const existingNumber = whatsappConfig?.existingNumber
  const setupRequested = whatsappConfig?.setupRequested || false
  const hasApiToken = whatsappConfig?.apiToken && whatsappConfig.apiToken.trim() !== ''

  const selectedCountryConfig = TWILIO_COUNTRIES.find(c => c.code === selectedCountry)
  const availableCities = selectedCountryConfig ? getCitiesForCountry(selectedCountry!) : []

  // Check if setup can be requested
  const canRequestSetup = setupType === "new_number" 
    ? selectedCountry && (!selectedCountryConfig?.hasCities || selectedRegion)
    : setupType === "use_own_account"
    ? whatsappConfig?.apiToken && whatsappConfig?.apiToken.trim() !== '' && existingNumber && existingNumber.trim() !== ''
    : false

  const handleToggleEnabled = async (enabled: boolean) => {
    setIsTogglingEnabled(true)
    try {
      form.setValue("channels.whatsapp.enabled", enabled)
      
      if (enabled) {
        toast.success("WhatsApp Business enabled. Configure your setup below.")
      } else {
        // Clear form values when disabling
        form.setValue("channels.whatsapp.setupType", undefined)
        form.setValue("channels.whatsapp.country", undefined)
        form.setValue("channels.whatsapp.region", undefined)
        form.setValue("channels.whatsapp.existingNumber", undefined)
        form.setValue("channels.whatsapp.apiToken", undefined)
        form.setValue("channels.whatsapp.setupRequested", false)
        toast.success("WhatsApp Business disabled")
      }
    } catch (error) {
      console.error("Error toggling WhatsApp enabled state:", error)
      toast.error("Failed to update WhatsApp settings")
      // Revert the form value on error
      form.setValue("channels.whatsapp.enabled", !enabled)
    } finally {
      setIsTogglingEnabled(false)
    }
  }

  const handleResetConfiguration = async () => {
    try {
      // Clear form values
      form.setValue("channels.whatsapp.enabled", false)
      form.setValue("channels.whatsapp.setupType", undefined)
      form.setValue("channels.whatsapp.country", undefined)
      form.setValue("channels.whatsapp.region", undefined)
      form.setValue("channels.whatsapp.existingNumber", undefined)
      form.setValue("channels.whatsapp.apiToken", undefined)
      form.setValue("channels.whatsapp.setupRequested", false)
      
      // Save the reset state to database
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
              setupType: undefined,
              country: undefined,
              region: undefined,
              existingNumber: undefined,
              setupRequested: false,
              apiToken: undefined,
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

  const handleRequestSetup = async () => {
    if (!siteId || !canRequestSetup) return

    setIsRequesting(true)
    try {
      const response = await fetch("/api/whatsapp-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          siteId,
          setupType,
          country: selectedCountry,
          region: selectedRegion,
          existingNumber,
          apiToken: whatsappConfig?.apiToken
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to submit setup request")
      }

      const result = await response.json()
      
      // Mark as requested and save enabled state
      form.setValue("channels.whatsapp.setupRequested", true)
      
      // Save the configuration including enabled state
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
              enabled: true,
              setupType: setupType,
              country: selectedCountry,
              region: selectedRegion,
              existingNumber: existingNumber,
              setupRequested: true,
              apiToken: whatsappConfig?.apiToken,
              status: "pending"
            } 
          } 
        })
      }
      
      const successMessage = setupType === "use_own_account" 
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

  const handleCopyWebhook = () => {
    const webhookUrl = `${process.env.NEXT_PUBLIC_API_SERVER_URL || 'https://your-domain.com'}/api/agents/whatsapp`
    navigator.clipboard.writeText(webhookUrl)
    toast.success("Webhook URL copied to clipboard!")
  }

  return (
    <>
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
              disabled={isTogglingEnabled}
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
                      form.setValue("channels.whatsapp.setupType", "new_number")
                      form.setValue("channels.whatsapp.existingNumber", undefined)
                      form.setValue("channels.whatsapp.apiToken", undefined)
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
                      setupType === "use_own_account"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => {
                      form.setValue("channels.whatsapp.setupType", "use_own_account")
                      form.setValue("channels.whatsapp.country", undefined)
                      form.setValue("channels.whatsapp.region", undefined)
                    }}
                  >
                    <div>
                      <h4 className="font-medium">Use Your Own Twilio Account</h4>
                      <p className="text-sm text-muted-foreground">
                        Connect existing account
                      </p>
                    </div>
                  </div>
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

              {setupType === "use_own_account" && (
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
                      name="channels.whatsapp.country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value)
                              // Reset region when country changes
                              form.setValue("channels.whatsapp.region", undefined)
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-12">
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

                  {/* Region/City Selection (only for new_number) */}
                  {selectedCountryConfig && setupType === "new_number" && selectedCountryConfig.hasCities && availableCities.length > 0 && (
                    <FormField
                      control={form.control}
                      name="channels.whatsapp.region"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred City</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12">
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

                  {/* Twilio API Configuration (for use_own_account setup) */}
                  {setupType === "use_own_account" && (
                    <>
                      <FormField
                        control={form.control}
                        name="channels.whatsapp.apiToken"
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
                        name="channels.whatsapp.existingNumber"
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
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* Setup Requested Status */}
          {setupRequested && !hasApiToken && setupType !== "use_own_account" && (
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

          {/* API Key Connected Status */}
          {setupType === "use_own_account" && whatsappConfig?.apiToken && whatsappConfig.apiToken.trim() !== '' && (
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
          {hasApiToken && setupType !== "use_own_account" && (
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
        {isEnabled && (
          <ActionFooter>
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                {!setupRequested && !hasApiToken && setupType ? (
                  setupType === "new_number" 
                    ? "We'll help you get a new WhatsApp & SMS number in your preferred city" 
                    : "Connect your existing Twilio account for WhatsApp & SMS messaging"
                ) : setupRequested || hasApiToken ? (
                  "WhatsApp Business is configured and ready"
                ) : (
                  "Configure your WhatsApp Business setup above"
                )}
              </div>
              
              <div className="flex gap-2">
                {!setupRequested && !hasApiToken && setupType === "new_number" && (
                  <Button
                    onClick={handleRequestSetup}
                    disabled={!canRequestSetup || isRequesting}
                  >
                    {isRequesting ? "Requesting..." : "Request Setup"}
                  </Button>
                )}
                
                {!setupRequested && !hasApiToken && setupType === "use_own_account" && (
                  <Button
                    onClick={async () => {
                      // Save the WhatsApp configuration
                      if (currentSite && canRequestSetup) {
                        try {
                          setIsRequesting(true)
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
                                setupType: whatsappConfig?.setupType,
                                country: whatsappConfig?.country,
                                region: whatsappConfig?.region,
                                existingNumber: whatsappConfig?.existingNumber,
                                setupRequested: false,
                                apiToken: whatsappConfig?.apiToken,
                                status: "active"
                              } 
                            } 
                          })
                          toast.success("Twilio API configuration saved successfully!")
                        } catch (error) {
                          console.error("Error saving WhatsApp configuration:", error)
                          toast.error("Failed to save configuration")
                        } finally {
                          setIsRequesting(false)
                        }
                      }
                    }}
                    disabled={!canRequestSetup || isRequesting}
                  >
                    {isRequesting ? "Saving..." : "Save Configuration"}
                  </Button>
                )}
                
                {(hasApiToken || existingNumber || setupRequested) && (
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
    </>
  )
} 