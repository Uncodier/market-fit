import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { SectionCardFooter, SectionCardContent } from "@/app/components/ui/section-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"

export function VoiceChannelSetup({ 
  siteId, 
  channel, 
  onConnected 
}: { 
  siteId: string, 
  channel: any, 
  onConnected: (payload: any) => void 
}) {
  const [countryCode, setCountryCode] = useState("US")
  const [areaCode, setAreaCode] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedNumber, setSelectedNumber] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)

  const handleSearch = async () => {
    setIsSearching(true)
    setSearchResults([])
    setSelectedNumber("")
    
    try {
      const query = new URLSearchParams({ countryCode })
      if (areaCode) query.append("areaCode", areaCode)
        
      const response = await apiClient.get(`/api/integrations/zavu/phone-numbers/available?${query.toString()}`)
      
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to search phone numbers")
      }
      
      if (!response.data || response.data.length === 0) {
        toast.info("No phone numbers found for the selected criteria")
        return
      }
      
      setSearchResults(response.data)
    } catch (error: any) {
      toast.error(error.message || "An error occurred while searching")
    } finally {
      setIsSearching(false)
    }
  }

  const handleConnect = async () => {
    if (!selectedNumber) {
      toast.error("Please select a phone number")
      return
    }

    setIsConnecting(true)
    try {
      const response = await apiClient.post("/api/integrations/zavu/voice", {
        siteId,
        channelId: channel.id,
        name: channel.name,
        phoneNumber: selectedNumber,
        active: true,
      })

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to connect Voice channel")
      }

      onConnected(response.data)
      toast.success("Voice channel connected successfully and tools registered.")
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <>
      <SectionCardContent className="space-y-4 pt-0">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Connect Voice/Audio Agent</h4>
          <p className="text-xs text-muted-foreground">
            Activate the autonomous Voice agent. Select a country and optionally an area code to find a suitable phone number.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Country</Label>
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States (US)</SelectItem>
                <SelectItem value="GB">United Kingdom (GB)</SelectItem>
                <SelectItem value="CA">Canada (CA)</SelectItem>
                <SelectItem value="AU">Australia (AU)</SelectItem>
                <SelectItem value="MX">Mexico (MX)</SelectItem>
                <SelectItem value="BR">Brazil (BR)</SelectItem>
                <SelectItem value="CL">Chile (CL)</SelectItem>
                <SelectItem value="CO">Colombia (CO)</SelectItem>
                <SelectItem value="PE">Peru (PE)</SelectItem>
                <SelectItem value="AR">Argentina (AR)</SelectItem>
                <SelectItem value="ES">Spain (ES)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Area Code / Region (Optional)</Label>
            <Input 
              type="text" 
              placeholder="e.g. 415" 
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value)}
            />
          </div>
        </div>
        
        <Button 
          type="button" 
          variant="secondary"
          onClick={handleSearch} 
          disabled={isSearching}
          className="w-full"
        >
          {isSearching ? "Searching..." : "Search Numbers"}
        </Button>

        {searchResults.length > 0 && (
          <div className="space-y-3 mt-4">
            <Label className="text-xs font-medium">Select a Phone Number</Label>
            <RadioGroup value={selectedNumber} onValueChange={setSelectedNumber}>
              {searchResults.map((result, idx) => (
                <div key={idx} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedNumber(result.phoneNumber)}>
                  <RadioGroupItem value={result.phoneNumber} id={`phone-${idx}`} />
                  <div className="grid flex-1">
                    <Label htmlFor={`phone-${idx}`} className="text-sm font-medium cursor-pointer">
                      {result.friendlyName || result.phoneNumber}
                    </Label>
                    {(result.locality || result.region) && (
                      <p className="text-xs text-muted-foreground">
                        {[result.locality, result.region].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}
      </SectionCardContent>

      <SectionCardFooter>
        <Button 
          type="button" 
          onClick={handleConnect} 
          disabled={isConnecting || !selectedNumber}
        >
          {isConnecting ? "Activating Voice Agent..." : "Activate Voice Agent"}
        </Button>
      </SectionCardFooter>
    </>
  )
}
