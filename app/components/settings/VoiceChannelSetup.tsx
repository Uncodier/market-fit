import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { InputWithIcon } from "@/app/components/ui/input-with-icon"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { SectionCardFooter, SectionCardContent } from "@/app/components/ui/section-card"

export function VoiceChannelSetup({ 
  siteId, 
  channel, 
  onConnected 
}: { 
  siteId: string, 
  channel: any, 
  onConnected: (payload: any) => void 
}) {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const response = await apiClient.post("/api/integrations/zavu/voice", {
        siteId,
        channelId: channel.id,
        name: channel.name,
        phoneNumber,
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
            Activate the autonomous Voice agent. Market-Fit tools will be automatically registered for voice tasks. Optional: provide the phone number.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Phone Number (Optional)</Label>
          <InputWithIcon 
            type="text" 
            placeholder="+1234567890" 
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>
      </SectionCardContent>

      <SectionCardFooter>
        <Button 
          type="button" 
          onClick={handleConnect} 
          disabled={isConnecting}
        >
          {isConnecting ? "Activating Voice Agent..." : "Activate Voice Agent"}
        </Button>
      </SectionCardFooter>
    </>
  )
}
