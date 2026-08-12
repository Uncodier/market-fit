/** CSS `aspect-ratio` value, e.g. `"1/1"` or `"16/9"`. */
export type ImprentaAspectCss = string

const NAMED: Record<string, ImprentaAspectCss> = {
  "16:9": "16/9",
  "9:16": "9/16",
  "4:3": "4/3",
  "3:4": "3/4",
  "1:1": "1/1",
}

export function imprentaAspectCssFromParam(
  aspectRatioParam: unknown,
  fallback: ImprentaAspectCss = "1/1"
): ImprentaAspectCss {
  if (aspectRatioParam == null || aspectRatioParam === "") return fallback
  const raw = String(aspectRatioParam).trim()
  if (NAMED[raw]) return NAMED[raw]
  const compact = raw.replace(/\s/g, "")
  if (/^\d+\/\d+$/.test(compact)) return compact
  if (/^\d+:\d+$/.test(compact)) return compact.replace(":", "/")
  return fallback
}

type AspectNode = {
  type?: string | null
  settings?: {
    parameters?: { aspectRatio?: unknown }
    media_type?: string
  } | null
}

export function imprentaNodeMediaAspectCss(
  node: AspectNode,
  parent?: AspectNode | null
): ImprentaAspectCss {
  const mediaType =
    node.settings?.media_type || String(node.type || "").replace(/^generate-/, "")
  const fallback: ImprentaAspectCss = mediaType === "video" ? "16/9" : "1/1"
  const param =
    node.settings?.parameters?.aspectRatio ??
    parent?.settings?.parameters?.aspectRatio
  return imprentaAspectCssFromParam(param, fallback)
}

/** Width / height from a CSS aspect-ratio string. */
export function imprentaAspectWidthOverHeight(aspectCss: string): number {
  const [w, h] = aspectCss.split("/").map(Number)
  if (!w || !h) return 1
  return w / h
}

export function imprentaMediaBoxHeight(
  contentWidth: number,
  aspectCss: string
): number {
  const ratio = imprentaAspectWidthOverHeight(aspectCss)
  if (ratio <= 0) return Math.round(contentWidth)
  return Math.round(contentWidth / ratio)
}
