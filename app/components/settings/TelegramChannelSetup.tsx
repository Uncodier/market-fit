import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"

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
        botToken
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
    <div className="space-y-4 p-4 bg-muted/20 rounded-lg border dark:border-white/5 border-black/5">
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Connect Telegram Bot</h4>
        <p className="text-xs text-muted-foreground">
          Create a bot via <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline text-blue-500">@BotFather</a> on Telegram, then paste the token below.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Bot Token</Label>
        <Input 
          type="password" 
          placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" 
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
        />
      </div>

      <Button 
        type="button" 
        onClick={handleConnect} 
        disabled={isConnecting || !botToken}
      >
        {isConnecting ? "Connecting..." : "Connect Telegram"}
      </Button>
    </div>
  )
}
