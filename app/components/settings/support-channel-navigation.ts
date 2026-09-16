const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  telegram: "Telegram",
  email: "Email",
  sms: "SMS",
  voice: "Voice / Audio Agent",
}

export function buildSupportChannelNavigation(
  connections: Array<{ name?: string; type?: string }>
) {
  return connections.map((connection, index) => ({
    id: `support-channel-${index}`,
    title:
      connection.name ||
      (connection.type ? CHANNEL_LABELS[connection.type] : undefined) ||
      "New Channel",
  }))
}
