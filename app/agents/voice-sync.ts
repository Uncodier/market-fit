export async function requestVoiceAgentResync(siteId: string): Promise<void> {
  if (siteId.startsWith("demo-")) return
  try {
    // Await only authenticated server acceptance, never the external provider sync.
    const response = await fetch("/api/settings/voice-sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status !== 202) {
      console.error(
        "Voice agent background synchronization was not accepted:",
        response.status
      )
    }
  } catch {
    console.error("Voice agent background synchronization could not be requested")
  }
}
