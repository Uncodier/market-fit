export function htmlToMarkdown(html: string): string {
  if (!html) return ""
  try {
    const container = document.createElement("div")
    container.innerHTML = html
    const visit = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || ""
      if (node.nodeType !== Node.ELEMENT_NODE) return ""
      const element = node as Element
      const children = Array.from(element.childNodes).map(visit).join("")
      switch (element.tagName.toLowerCase()) {
        case "h1": return serializeMarkdownBlock(element, children, "# ")
        case "h2": return serializeMarkdownBlock(element, children, "## ")
        case "h3": return serializeMarkdownBlock(element, children, "### ")
        case "p": return serializeMarkdownBlock(element, children)
        case "strong":
        case "b": return `**${children}**`
        case "em":
        case "i": return `*${children}*`
        case "ul":
        case "ol": return `${children}\n`
        case "li": {
          const parent = element.parentElement
          if (parent?.tagName.toLowerCase() === "ol") {
            return `${Array.from(parent.children).indexOf(element) + 1}. ${children}\n`
          }
          return `- ${children}\n`
        }
        case "blockquote": return `> ${children}\n\n`
        case "code": return `\`${children}\``
        case "pre": return `\`\`\`\n${children}\n\`\`\`\n\n`
        case "a": {
          const href = element.getAttribute("href")
          return href ? `[${children}](${href})` : children
        }
        case "img": {
          const src = element.getAttribute("src")
          const alt = element.getAttribute("alt") || ""
          return src ? `![${alt}](${src})` : ""
        }
        case "br": return "\n"
        default: return children
      }
    }
    return visit(container).replace(/\n{3,}/g, "\n\n").trim()
  } catch {
    return html
  }
}

function serializeMarkdownBlock(element: Element, children: string, prefix = "") {
  const alignment = (element as HTMLElement).style.textAlign
  if (alignment && alignment !== "left") {
    const tag = element.tagName.toLowerCase()
    return `<${tag} style="text-align: ${alignment}">${children}</${tag}>\n\n`
  }
  return `${prefix}${children}\n\n`
}
