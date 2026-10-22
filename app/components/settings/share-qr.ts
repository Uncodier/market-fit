export function downloadSettingsQr(containerId: string, filename: string) {
  const svg = document.getElementById(containerId)?.querySelector("svg")
  if (!svg) return
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" })
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement("canvas")
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext("2d")
    if (context) {
      context.fillStyle = "white"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      const link = document.createElement("a")
      link.download = filename
      link.href = canvas.toDataURL("image/png")
      link.click()
    }
    URL.revokeObjectURL(url)
  }
  image.onerror = () => URL.revokeObjectURL(url)
  image.src = url
}

export function selfServiceLocationUrl(locationId: string, origin = "https://www.makinari.com") {
  const base = new URL(origin)
  if (base.hostname === "app.makinari.com") base.hostname = "www.makinari.com"
  return new URL(`/shop/${encodeURIComponent(locationId)}/`, base).toString()
}