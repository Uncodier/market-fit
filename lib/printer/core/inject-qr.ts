export async function injectQrIntoDocument(doc: Document, size = 112): Promise<void> {
  const nodes = Array.from(doc.querySelectorAll<HTMLElement>("[data-qr]"))
  if (!nodes.length) return
  const React = await import("react")
  const { createRoot } = await import("react-dom/client")
  const QRCode = (await import("react-qr-code")).default
  for (const node of nodes) {
    const value = node.getAttribute("data-qr") || ""
    if (!value) continue
    node.innerHTML = ""
    const root = createRoot(node)
    root.render(React.createElement(QRCode, { value, size }))
  }
  await new Promise((resolve) => setTimeout(resolve, 80))
}
