export function openOnboardingTaskHelp(title: string, description: string) {
  if (typeof window === "undefined") return
  const api = (
    window as Window & {
      MarketFit?: {
        openChatWithTask?: (options: {
          welcomeMessage: string
          task: string
          clearExistingMessages: boolean
          newConversation: boolean
        }) => void
      }
    }
  ).MarketFit
  api?.openChatWithTask?.({
    welcomeMessage: `Hi! I see you need help with "${title}". I'm here to guide you through this step.`,
    task: `Help me with: ${title} - ${description}`,
    clearExistingMessages: false,
    newConversation: false,
  })
}
