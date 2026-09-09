export function openOnboardingTaskHelp(title: string, description: string) {
  if (typeof window === "undefined") return
  
  // Option 1: First try to use the chat copilot sidebar widget if it's available
  const api = (
    window as Window & {
      MarketFit?: {
        openChatWithTask?: (options: {
          welcomeMessage: string
          task: string
          clearExistingMessages: boolean
          newConversation: boolean
          activity?: string
        }) => void
      }
    }
  ).MarketFit
  
  if (api?.openChatWithTask) {
    api.openChatWithTask({
      welcomeMessage: `Hi! I see you need help with "${title}". I'm here to guide you through this step.`,
      task: `Help me with: ${title} - ${description}`,
      clearExistingMessages: true,
      newConversation: true,
      activity: "robot"
    })
    return
  }
  
  // Option 2: Fallback to navigating directly to the /robots view with query parameters
  const query = encodeURIComponent(`Help me with: ${title} - ${description}`)
  window.location.href = `/robots?activity=robot&new=true&query=${query}`
}
