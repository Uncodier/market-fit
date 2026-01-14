"use client"

import { useState, useEffect } from "react"
import { useFormContext } from "react-hook-form"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { ActionFooter } from "../ui/card-footer"
import { Button } from "../ui/button"
import { Label } from "../ui/label"
import { MessageSquare, CheckCircle2, Globe } from "../ui/icons"
import { type SiteFormValues } from "./form-schema"
import { useSite } from "../../context/SiteContext"
import { apiClient } from "../../services/api-client-service"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"

// Reuse country and city constants from WhatsAppSection
const TWILIO_COUNTRIES = [
  { code: "US", name: "United States", hasCities: true },
  { code: "CA", name: "Canada", hasCities: true },
  { code: "MX", name: "Mexico", hasCities: true },
  { code: "GB", name: "United Kingdom", hasCities: true },
  { code: "DE", name: "Germany", hasCities: true },
  { code: "FR", name: "France", hasCities: true },
  { code: "IT", name: "Italy", hasCities: true },
  { code: "ES", name: "Spain", hasCities: true },
  { code: "NL", name: "Netherlands", hasCities: true },
  { code: "SE", name: "Sweden", hasCities: true },
  { code: "NO", name: "Norway", hasCities: true },
  { code: "DK", name: "Denmark", hasCities: true },
  { code: "FI", name: "Finland", hasCities: true },
  { code: "PL", name: "Poland", hasCities: true },
  { code: "CZ", name: "Czech Republic", hasCities: true },
  { code: "AT", name: "Austria", hasCities: true },
  { code: "CH", name: "Switzerland", hasCities: true },
  { code: "BE", name: "Belgium", hasCities: true },
  { code: "PT", name: "Portugal", hasCities: true },
  { code: "IE", name: "Ireland", hasCities: true },
  { code: "AU", name: "Australia", hasCities: true },
  { code: "SG", name: "Singapore", hasCities: false },
  { code: "JP", name: "Japan", hasCities: true },
  { code: "HK", name: "Hong Kong", hasCities: true },
  { code: "NZ", name: "New Zealand", hasCities: true },
  { code: "MY", name: "Malaysia", hasCities: true },
  { code: "TH", name: "Thailand", hasCities: true },
  { code: "PH", name: "Philippines", hasCities: true },
  { code: "ID", name: "Indonesia", hasCities: true },
  { code: "TW", name: "Taiwan", hasCities: true },
  { code: "KR", name: "South Korea", hasCities: true },
  { code: "IN", name: "India", hasCities: true },
  { code: "AE", name: "United Arab Emirates", hasCities: true },
  { code: "SA", name: "Saudi Arabia", hasCities: true },
  { code: "IL", name: "Israel", hasCities: true },
  { code: "BR", name: "Brazil", hasCities: true },
  { code: "AR", name: "Argentina", hasCities: true },
  { code: "CL", name: "Chile", hasCities: true },
  { code: "CO", name: "Colombia", hasCities: true },
  { code: "PE", name: "Peru", hasCities: true },
  { code: "UY", name: "Uruguay", hasCities: false },
  { code: "PA", name: "Panama", hasCities: false },
  { code: "CR", name: "Costa Rica", hasCities: false },
  { code: "ZA", name: "South Africa", hasCities: true },
  { code: "NG", name: "Nigeria", hasCities: true },
  { code: "KE", name: "Kenya", hasCities: false },
  { code: "EG", name: "Egypt", hasCities: true },
]

// City lists (same as WhatsAppSection)
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

const SWEDEN_CITIES = [
  { code: "STO", name: "Stockholm" },
  { code: "GOT", name: "Gothenburg" },
  { code: "MAL", name: "Malmö" },
  { code: "UPP", name: "Uppsala" },
  { code: "VAS", name: "Västerås" },
]

const POLAND_CITIES = [
  { code: "WAR", name: "Warsaw" },
  { code: "KRA", name: "Krakow" },
  { code: "WRO", name: "Wrocław" },
  { code: "POZ", name: "Poznań" },
  { code: "GDA", name: "Gdańsk" },
]

const ARGENTINA_CITIES = [
  { code: "BUE", name: "Buenos Aires" },
  { code: "COR", name: "Córdoba" },
  { code: "ROS", name: "Rosario" },
  { code: "MEN", name: "Mendoza" },
  { code: "TUC", name: "Tucumán" },
]

const COLOMBIA_CITIES = [
  { code: "BOG", name: "Bogotá" },
  { code: "MED", name: "Medellín" },
  { code: "CAL", name: "Cali" },
  { code: "BAR", name: "Barranquilla" },
  { code: "CAR", name: "Cartagena" },
]

const CHILE_CITIES = [
  { code: "SCL", name: "Santiago" },
  { code: "VAL", name: "Valparaíso" },
  { code: "CON", name: "Concepción" },
  { code: "ANT", name: "Antofagasta" },
  { code: "TEM", name: "Temuco" },
]

const PERU_CITIES = [
  { code: "LIM", name: "Lima" },
  { code: "ARE", name: "Arequipa" },
  { code: "TRU", name: "Trujillo" },
  { code: "CHI", name: "Chiclayo" },
  { code: "IQU", name: "Iquitos" },
]

const HONG_KONG_CITIES = [
  { code: "HKI", name: "Hong Kong Island" },
  { code: "KOW", name: "Kowloon" },
  { code: "NT", name: "New Territories" },
  { code: "TST", name: "Tsim Sha Tsui" },
  { code: "CEN", name: "Central" },
]

const SOUTH_KOREA_CITIES = [
  { code: "SEO", name: "Seoul" },
  { code: "BUS", name: "Busan" },
  { code: "INC", name: "Incheon" },
  { code: "DAE", name: "Daegu" },
  { code: "DAJ", name: "Daejeon" },
]

const UAE_CITIES = [
  { code: "DUB", name: "Dubai" },
  { code: "ABU", name: "Abu Dhabi" },
  { code: "SHA", name: "Sharjah" },
  { code: "AJM", name: "Ajman" },
  { code: "RAK", name: "Ras Al Khaimah" },
]

const SAUDI_ARABIA_CITIES = [
  { code: "RIY", name: "Riyadh" },
  { code: "JED", name: "Jeddah" },
  { code: "MEC", name: "Mecca" },
  { code: "MED", name: "Medina" },
  { code: "DAM", name: "Dammam" },
]

const ISRAEL_CITIES = [
  { code: "TEL", name: "Tel Aviv" },
  { code: "JER", name: "Jerusalem" },
  { code: "HAI", name: "Haifa" },
  { code: "BEE", name: "Beersheba" },
  { code: "NET", name: "Netanya" },
]

const NEW_ZEALAND_CITIES = [
  { code: "AUC", name: "Auckland" },
  { code: "WEL", name: "Wellington" },
  { code: "CHR", name: "Christchurch" },
  { code: "HAM", name: "Hamilton" },
  { code: "TAU", name: "Tauranga" },
]

const SOUTH_AFRICA_CITIES = [
  { code: "JOH", name: "Johannesburg" },
  { code: "CAP", name: "Cape Town" },
  { code: "DUR", name: "Durban" },
  { code: "PRT", name: "Pretoria" },
  { code: "PEL", name: "Port Elizabeth" },
]

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
    case "SE":
      return SWEDEN_CITIES
    case "PL":
      return POLAND_CITIES
    case "AR":
      return ARGENTINA_CITIES
    case "CO":
      return COLOMBIA_CITIES
    case "CL":
      return CHILE_CITIES
    case "PE":
      return PERU_CITIES
    case "HK":
      return HONG_KONG_CITIES
    case "KR":
      return SOUTH_KOREA_CITIES
    case "AE":
      return UAE_CITIES
    case "SA":
      return SAUDI_ARABIA_CITIES
    case "IL":
      return ISRAEL_CITIES
    case "NZ":
      return NEW_ZEALAND_CITIES
    case "ZA":
      return SOUTH_AFRICA_CITIES
    default:
      return []
  }
}

interface AgentWhatsAppSectionProps {
  active: boolean
  siteId?: string
  onSave?: (data: SiteFormValues) => void
}

export function AgentWhatsAppSection({ active, siteId, onSave }: AgentWhatsAppSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [isRequesting, setIsRequesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { currentSite, updateSettings } = useSite()

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving agent WhatsApp settings:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Get current values from form - watch only what user can change
  const country = form.watch("channels.agent_whatsapp.country") || ""
  const region = form.watch("channels.agent_whatsapp.region") || ""
  const setupRequested = form.watch("channels.agent_whatsapp.setupRequested") || false
  const status = form.watch("channels.agent_whatsapp.status") || "not_configured"

  const isPending = status === "pending" || setupRequested
  const isActive = status === "active"
  const isNotConfigured = status === "not_configured"

  const selectedCountryConfig = TWILIO_COUNTRIES.find(c => c.code === country)
  const availableCities = selectedCountryConfig ? getCitiesForCountry(country || "") : []

  const canRequest = () => {
    if (!country) return false
    const countryConfig = TWILIO_COUNTRIES.find(c => c.code === country)
    if (countryConfig?.hasCities && !region) return false
    return true
  }

  const handleRequestAgentWhatsApp = async () => {
    if (!currentSite || !siteId || !canRequest()) return

    setIsRequesting(true)
    try {
      // Call the WhatsApp setup API (similar to existing flow)
      const requestData = {
        siteId: siteId,
        siteName: currentSite.name,
        setupType: "new_number",
        country: country,
        region: region
      }

      const response = await apiClient.post('/api/whatsapp-setup', requestData)

      if (response.success) {
        // Update form values
        form.setValue("channels.agent_whatsapp.setupRequested", true)
        form.setValue("channels.agent_whatsapp.status", "pending")

        // Update settings in database
        await updateSettings(currentSite.id, {
          channels: {
            ...currentSite.settings?.channels,
            agent_whatsapp: {
              country: country,
              region: region,
              setupRequested: true,
              status: "pending"
            }
          }
        })

        toast.success("Agent WhatsApp request submitted successfully")
      } else {
        const errorMessage = typeof response.error === 'string' 
          ? response.error 
          : response.error?.message 
          ? String(response.error.message)
          : "Failed to request agent WhatsApp"
        toast.error(errorMessage)
      }
    } catch (error: any) {
      console.error("Error requesting agent WhatsApp:", error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
        ? error 
        : error?.error?.message 
        ? String(error.error.message)
        : error?.message 
        ? String(error.message)
        : "Failed to request agent WhatsApp"
      toast.error(errorMessage)
    } finally {
      setIsRequesting(false)
    }
  }

  // Initialize form values from site settings - only once when site changes
  useEffect(() => {
    if (!currentSite?.settings?.channels?.agent_whatsapp) return
    
    const agentWhatsAppData = currentSite.settings.channels.agent_whatsapp
    const currentValues = form.getValues("channels.agent_whatsapp")
    
    // Only update if values are different to avoid infinite loops
    if (currentValues.country !== (agentWhatsAppData.country || "")) {
      form.setValue("channels.agent_whatsapp.country", agentWhatsAppData.country || "", { shouldDirty: false, shouldValidate: false })
    }
    if (currentValues.region !== (agentWhatsAppData.region || "")) {
      form.setValue("channels.agent_whatsapp.region", agentWhatsAppData.region || "", { shouldDirty: false, shouldValidate: false })
    }
    if (currentValues.setupRequested !== (agentWhatsAppData.setupRequested || false)) {
      form.setValue("channels.agent_whatsapp.setupRequested", agentWhatsAppData.setupRequested || false, { shouldDirty: false, shouldValidate: false })
    }
    if (currentValues.status !== (agentWhatsAppData.status || "not_configured")) {
      form.setValue("channels.agent_whatsapp.status", agentWhatsAppData.status || "not_configured", { shouldDirty: false, shouldValidate: false })
    }
  }, [currentSite?.id])

  if (!active) return null

  return (
    <Card id="agent-whatsapp-channel" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Agent WhatsApp Channel
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Request an agent WhatsApp number for automated customer communication
        </p>
      </CardHeader>
      <CardContent className="px-8 pb-4 space-y-6">
        {isNotConfigured && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Country</Label>
              <Select
                value={country || ""}
                onValueChange={(value) => {
                  form.setValue("channels.agent_whatsapp.country", value)
                  form.setValue("channels.agent_whatsapp.region", "") // Reset region when country changes
                }}
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
              <p className="text-sm text-muted-foreground mt-1">
                Region availability is subject to stock.
              </p>
            </div>

            {selectedCountryConfig?.hasCities && availableCities.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-foreground">Preferred City</Label>
                <Select
                  value={region || ""}
                  onValueChange={(value) => form.setValue("channels.agent_whatsapp.region", value)}
                >
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
                  Choose the city where you'd like your new WhatsApp number. Region availability is subject to stock.
                </p>
              </div>
            )}
          </div>
        )}

        {isPending && (
          <div className="flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-900">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">Agent WhatsApp request submitted</p>
              <p className="text-xs text-muted-foreground">
                Your request is being processed. We'll contact you soon to complete the setup.
              </p>
            </div>
          </div>
        )}

        {isActive && (
          <div className="flex items-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">Agent WhatsApp active</p>
              <p className="text-xs text-muted-foreground">
                Your agent WhatsApp is configured and ready to use
              </p>
            </div>
          </div>
        )}
      </CardContent>

      {isNotConfigured && (
        <ActionFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Configure your agent WhatsApp number above
            </div>
            <Button
              variant="outline"
              onClick={handleRequestAgentWhatsApp}
              disabled={isRequesting || !canRequest()}
            >
              {isRequesting ? "Requesting..." : "Request Agent WhatsApp"}
            </Button>
          </div>
        </ActionFooter>
      )}
    </Card>
  )
}

