import { injectQrIntoDocument } from "../core/inject-qr"

function waitForIframeLoad(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      iframe.removeEventListener("load", done)
      resolve()
    }
    const timer = setTimeout(done, 300)
    iframe.addEventListener("load", done, { once: true })
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
  try {
    const loaded = waitForIframeLoad(iframe)
    doc.open()
    doc.write(html)
    doc.close()
    await loaded
    await injectQrIntoDocument(doc, 112)
    const win = iframe.contentWindow
    if (!win) throw new Error("Could not open print window")
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer)
        win.removeEventListener("afterprint", onAfter)
        iframe.remove()
      }
      const onAfter = () => {
        cleanup()
        resolve()
      }
      win.addEventListener("afterprint", onAfter)
      // Safari can return from print() while its dialog still uses this document.
      // Resolve dispatch, but only afterprint may remove the frame. If the browser
      // omits that event the frame stays until navigation, rather than blanking a job.
      const timer = setTimeout(resolve, 1500)
      try {
        win.focus()
        win.print()
      } catch (err) {
        cleanup()
        reject(err)
      }
    })
  } catch (err) {
    iframe.remove()
    throw err
  }
}
