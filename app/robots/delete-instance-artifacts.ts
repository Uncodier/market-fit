export async function deleteInstanceArtifacts(ids: string[]) {
  const response = await fetch("/api/robots/instance/artifacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Failed to delete artifact")
  }

  return payload
}
