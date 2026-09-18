import type { ContentStyle } from "./content-item-types"

export function htmlToMarkdown(html: string): string {
  if (!html) return ""

  try {
    const container = document.createElement("div")
    container.innerHTML = html

    const nodeToMarkdown = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || ""
      if (node.nodeType !== Node.ELEMENT_NODE) return ""

      const element = node as Element
      const children = Array.from(element.childNodes).map(nodeToMarkdown).join("")

      switch (element.tagName.toLowerCase()) {
        case "h1": return `# ${children}\n\n`
        case "h2": return `## ${children}\n\n`
        case "h3": return `### ${children}\n\n`
        case "h4": return `#### ${children}\n\n`
        case "h5": return `##### ${children}\n\n`
        case "h6": return `###### ${children}\n\n`
        case "p": return `${children}\n\n`
        case "strong":
        case "b": return `**${children}**`
        case "em":
        case "i": return `*${children}*`
        case "ul":
        case "ol": return `${children}\n`
        case "li": return `- ${children}\n`
        case "blockquote": return `> ${children}\n\n`
        case "code": return `\`${children}\``
        case "pre": return `\`\`\`\n${children}\n\`\`\`\n\n`
        case "br": return "\n"
        case "a": {
          const href = element.getAttribute("href")
          return href ? `[${children}](${href})` : children
        }
        case "img": {
          const src = element.getAttribute("src")
          const alt = element.getAttribute("alt") || ""
          return src ? `![${alt}](${src})` : ""
        }
        default: return children
      }
    }

    return nodeToMarkdown(container).replace(/\n{3,}/g, "\n\n").trim()
  } catch (error) {
    console.error("Error converting HTML to markdown:", error)
    return html.replace(/<[^>]*>/g, "").trim()
  }
}

function getFullApiUrl(rawUrl: string): string {
  const baseUrl = rawUrl.trim()
  if (!baseUrl) return ""

  const invalidIp = baseUrl.match(/^https?:\/\/(\d+\.\d+\.\d+\.\d+)\.(\d+)/)
  if (invalidIp) {
    const port = baseUrl.match(/:(\d+)(\/.*)?$/)?.[1]
    const protocol = baseUrl.startsWith("https://") ? "https" : "http"
    return `${protocol}://${invalidIp[1]}${port ? `:${port}` : ""}`
  }

  try {
    if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
      const url = new URL(baseUrl)
      if (typeof window !== "undefined" && url.hostname === "localhost") {
        const originUrl = new URL(window.location.origin)
        if (originUrl.hostname !== "localhost" && /^\d+\.\d+\.\d+\.\d+$/.test(originUrl.hostname)) {
          return `${url.protocol}//${originUrl.hostname}${url.port ? `:${url.port}` : ""}`
        }
      }
      return baseUrl
    }

    const isHost =
      /^[a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,}(:[0-9]+)?$/.test(baseUrl) ||
      /^localhost(:[0-9]+)?$/.test(baseUrl) ||
      /^\d+\.\d+\.\d+\.\d+(:[0-9]+)?$/.test(baseUrl)
    return isHost ? `http://${baseUrl}` : ""
  } catch (error) {
    console.error(`Error parsing URL ${baseUrl}:`, error)
    return ""
  }
}

const apiServerUrl =
  process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || ""

export const FULL_API_SERVER_URL = getFullApiUrl(apiServerUrl)

function rangeLabel(
  value: number,
  labels: [string, string, string, string, string, string],
): string {
  if (value === 100) return labels[5]
  if (value < 20) return labels[0]
  if (value < 40) return labels[1]
  if (value < 60) return labels[2]
  if (value < 80) return labels[3]
  return labels[4]
}

export const contentStyleLabels = {
  tone: (value: number) => rangeLabel(value, [
    "Very Formal", "Formal", "Neutral", "Casual", "Very Casual", "Extremely Casual",
  ]),
  complexity: (value: number) => rangeLabel(value, [
    "Very Simple", "Simple", "Moderate", "Complex", "Very Complex", "Extremely Complex",
  ]),
  creativity: (value: number) => rangeLabel(value, [
    "Very Conservative", "Conservative", "Balanced", "Creative", "Very Creative", "Extremely Creative",
  ]),
  persuasiveness: (value: number) => rangeLabel(value, [
    "Purely Informative", "Mostly Informative", "Balanced", "Persuasive", "Highly Persuasive", "Extremely Persuasive",
  ]),
  targetAudience: (value: number) => rangeLabel(value, [
    "Very General", "General", "Mixed", "Specific", "Very Specific", "Extremely Specific",
  ]),
  engagement: (value: number) => rangeLabel(value, [
    "Highly Professional", "Professional", "Balanced", "Engaging", "Highly Engaging", "Extremely Engaging",
  ]),
  size: (value: number) => rangeLabel(value, [
    "Very Short", "Short", "Medium", "Long", "Very Long", "Extremely Long",
  ]),
}

export function mapContentStyleToApi(style: ContentStyle) {
  const threeWay = (
    value: number,
    low: string,
    middle: string,
    high: string,
    lowMax = 33,
    highMin = 66,
  ) => value < lowMax ? low : value > highMin ? high : middle

  return {
    tone: threeWay(style.tone, "formal", "neutral", "friendly", 40, 60),
    complexity: threeWay(style.complexity, "simple", "moderate", "advanced"),
    creativity: threeWay(style.creativity, "factual", "balanced", "creative"),
    persuasiveness: threeWay(style.persuasiveness, "informative", "balanced", "persuasive"),
    targetAudience: style.targetAudience < 50 ? "mixed" : "specific",
    engagement: threeWay(style.engagement, "professional", "balanced", "engaging"),
    size: threeWay(style.size, "short", "medium", "long"),
  }
}
