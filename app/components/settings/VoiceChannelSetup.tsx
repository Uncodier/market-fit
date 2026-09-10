import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { SectionCardFooter, SectionCardContent } from "@/app/components/ui/section-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/app/components/ui/alert"
import { AlertTriangle } from "@/app/components/ui/icons"

function formatPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return phoneNumber;
  
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    return `+1 (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
  }
  
  if (cleaned.startsWith('+52') && cleaned.length === 13) {
    return `+52 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 9)} ${cleaned.slice(9)}`;
  }

  if (cleaned.startsWith('+')) {
    return cleaned.replace(/(\+\d{1,3})(\d{2,4})(\d{3,4})(\d{3,4})/, '$1 $2 $3 $4').trim();
  }

  return phoneNumber;
}

function formatCapabilities(capabilities: any): string[] {
  if (!capabilities) return [];
  if (Array.isArray(capabilities)) return capabilities;
  if (typeof capabilities === "object") {
    return Object.entries(capabilities).filter(([_, v]) => v).map(([k]) => k);
  }
  return [String(capabilities)];
}

export function VoiceChannelSetup({ 
  siteId, 
  channel, 
  onConnected 
}: { 
  siteId: string, 
  channel: any, 
  onConnected: (payload: any) => void 
}) {
  const [tab, setTab] = useState<"existing" | "new">("existing")
  
  // New Number State
  const [countryCode, setCountryCode] = useState("US")
  const [areaCode, setAreaCode] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  
  // Existing Number State
  const [ownedNumbers, setOwnedNumbers] = useState<any[]>([])
  const [isLoadingOwned, setIsLoadingOwned] = useState(true)

  const [selectedNumber, setSelectedNumber] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const fetchOwnedNumbers = async () => {
      try {
        const response = await apiClient.get('/api/integrations/zavu/phone-numbers')
        if (response.success && response.data) {
          const numbers = Array.isArray(response.data) ? response.data : []
          setOwnedNumbers(numbers)
          if (numbers.length === 0) {
            setTab("new")
          }
        }
      } catch (error) {
        console.error("Failed to fetch owned numbers", error)
      } finally {
        setIsLoadingOwned(false)
      }
    }
    
    fetchOwnedNumbers()
  }, [])

  const handleSearch = async () => {
    setIsSearching(true)
    setSearchResults([])
    setSelectedNumber("")
    
    try {
      const query = new URLSearchParams({ countryCode })
      if (areaCode) query.append("areaCode", areaCode)
      query.append("capabilities", "voice")
        
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
            Activate the autonomous Voice agent. Select an existing number or search for a new one.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setSelectedNumber(""); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Use Existing Number</TabsTrigger>
            <TabsTrigger value="new">Buy New Number</TabsTrigger>
          </TabsList>
          
          <TabsContent value="existing" className="mt-4 space-y-4">
            {isLoadingOwned ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-48 mb-2" />
                <div className="space-y-3">
                  <Skeleton className="h-[74px] w-full rounded-md" />
                  <Skeleton className="h-[74px] w-full rounded-md" />
                </div>
              </div>
            ) : ownedNumbers.length === 0 ? (
              <div className="text-center py-6 bg-muted/30 rounded-md">
                <p className="text-sm text-muted-foreground">You don't have any phone numbers yet.</p>
                <Button variant="link" onClick={() => setTab("new")} className="mt-2 h-auto p-0">
                  Search for a new number
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Label className="text-xs font-medium">Select one of your numbers</Label>
                <RadioGroup value={selectedNumber} onValueChange={setSelectedNumber}>
                  {ownedNumbers.map((result, idx) => (
                    <div key={idx} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedNumber(result.phoneNumber)}>
                      <RadioGroupItem value={result.phoneNumber} id={`owned-${idx}`} />
                      <div className="flex flex-1 items-center justify-between">
                        <div className="grid">
                          <Label htmlFor={`owned-${idx}`} className="text-sm font-medium cursor-pointer">
                            {result.name || formatPhoneNumber(result.phoneNumber)}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {result.capabilities ? "" : formatPhoneNumber(result.phoneNumber)}
                          </p>
                        </div>
                        {result.capabilities && (
                          <div className="flex gap-1">
                            {formatCapabilities(result.capabilities).map((cap) => (
                              <Badge key={cap} variant="secondary" className="capitalize">
                                {cap}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </TabsContent>

          <TabsContent value="new" className="mt-4 space-y-4">
            {countryCode === "US" && (
              <Alert className="bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Business Identity / KYC Verification</AlertTitle>
                <AlertDescription className="mt-2 text-amber-800 dark:text-amber-300">
                  Purchasing US numbers for Voice might require basic Business Identity / KYC verification (address and business info) depending on local carrier regulations to keep the number active.
                </AlertDescription>
              </Alert>
            )}

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
                <Label className="text-xs">Area Code (Optional)</Label>
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

            {isSearching ? (
              <div className="space-y-3 mt-4 pt-4 border-t">
                <Skeleton className="h-4 w-48 mb-2" />
                <div className="space-y-3">
                  <Skeleton className="h-[74px] w-full rounded-md" />
                  <Skeleton className="h-[74px] w-full rounded-md" />
                  <Skeleton className="h-[74px] w-full rounded-md" />
                </div>
              </div>
            ) : searchResults.length > 0 && (
              <div className="space-y-3 mt-4 pt-4 border-t">
                <Label className="text-xs font-medium">Select a Phone Number to Buy</Label>
                <RadioGroup value={selectedNumber} onValueChange={setSelectedNumber}>
                  {searchResults.map((result, idx) => (
                    <div key={idx} className="flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedNumber(result.phoneNumber)}>
                      <RadioGroupItem value={result.phoneNumber} id={`phone-${idx}`} />
                      <div className="flex flex-1 items-center justify-between">
                        <div className="grid">
                          <Label htmlFor={`phone-${idx}`} className="text-sm font-medium cursor-pointer">
                            {formatPhoneNumber(result.phoneNumber)}
                          </Label>
                          {(result.locality || result.region) && (
                            <p className="text-xs text-muted-foreground">
                              {[result.locality, result.region].filter(Boolean).join(", ")}
                            </p>
                          )}
                        </div>
                        {result.capabilities && (
                          <div className="flex gap-1">
                            {formatCapabilities(result.capabilities).map((cap) => (
                              <Badge key={cap} variant="secondary" className="capitalize">
                                {cap}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </TabsContent>
        </Tabs>
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
