export type ChatResponseFormat = 'text' | 'audio'

export function supportsAudioResponse(channel: string): boolean {
  return ['whatsapp', 'telegram', 'messenger'].includes(channel)
}

export function isChatResponseFormat(value: unknown): value is ChatResponseFormat {
  return value === 'text' || value === 'audio'
}

export function isAudioRetryBlocked(metadata: Record<string, unknown> | null | undefined): boolean {
  const receipt = metadata?.audio_delivery
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false
  return (receipt as Record<string, unknown>).state !== 'ready'
}