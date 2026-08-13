import { injectQrIntoDocument } from "../core/inject-qr"

function waitForIframeLoad(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve()
    iframe.addEventListener("load", done, { once: true })
    setTimeout(done, 300)
  })
}

export async function printHtml(html: string): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error("System print is only available in the browser")
  }
  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    throw new Error("Could not open print frame")
  }
  doc.open()
  doc.write(html)
  doc.close()

  try {
    await waitForIframeLoad(iframe)
    await injectQrIntoDocument(doc, 112)
    const win = iframe.contentWindow
    if (!win) throw new Error("Could not open print window")
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        win.removeEventListener("afterprint", onAfter)
        iframe.remove()
      }
      const onAfter = () => {
        cleanup()
        resolve()
      }
      win.addEventListener("afterprint", onAfter)
      try {
        win.focus()
        win.print()
      } catch (err) {
        cleanup()
        reject(err)
      }
      setTimeout(() => {
        cleanup()
        resolve()
      }, 1500)
    })
  } catch (err) {
    iframe.remove()
    throw err
  }
}
