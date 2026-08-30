import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { InputWithIcon } from "@/app/components/ui/input-with-icon"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { Eye, EyeOff } from "@/app/components/ui/icons"
import { SectionCardFooter, SectionCardContent } from "@/app/components/ui/section-card"

export function TelegramChannelSetup({ 
  siteId, 
  channel, 
  onConnected 
}: { 
  siteId: string, 
  channel: any, 
  onConnected: (payload: any) => void 
}) {
  const [botToken, setBotToken] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [showBotToken, setShowBotToken] = useState(false)

  const handleConnect = async () => {
    if (!botToken) {
      toast.error("Bot token is required")
      return
    }

    setIsConnecting(true)
    try {
      const response = await apiClient.post("/api/integrations/zavu/channels/telegram", {
        siteId,
        channelId: channel.id,
        name: channel.name,
        botToken,
        active: true,
      })

      if (!response.success) {
        throw new Error(response.error?.message || "Failed to connect Telegram")
      }

      onConnected(response.data)
      toast.success("Telegram connected successfully")
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
          <h4 className="text-sm font-medium">Connect Telegram Bot</h4>
          <p className="text-xs text-muted-foreground">
            Create a bot via <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline text-blue-500">@BotFather</a> on Telegram, then paste the token below.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Bot Token</Label>
          <InputWithIcon 
            type={showBotToken ? "text" : "password"} 
            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" 
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            rightIconButton={
              <button 
                type="button"
                className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                tabIndex={-1}
              >
                {showBotToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            onRightIconClick={() => setShowBotToken(!showBotToken)}
          />
        </div>
      </SectionCardContent>

      <SectionCardFooter>
        <Button 
          type="button" 
          onClick={handleConnect} 
          disabled={isConnecting || !botToken}
        >
          {isConnecting ? "Connecting..." : "Connect Telegram"}
        </Button>
      </SectionCardFooter>
    </>
  )
}
