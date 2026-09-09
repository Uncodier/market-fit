import { ImageResponse } from "next/og"
import {
  type ShareImageSource,
  toAbsoluteShareImageUrl,
} from "@/app/lib/commerce-metadata"

export const OG_SIZE = { width: 1200, height: 630 }
export const ICON_SIZE = { width: 64, height: 64 }
export const APPLE_ICON_SIZE = { width: 180, height: 180 }

async function resolveImageSrc(source: ShareImageSource): Promise<string | null> {
  if (source.kind === "data") return source.dataUrl

  try {
    const absoluteUrl = toAbsoluteShareImageUrl(source.url)
    const res = await fetch(absoluteUrl, {
      headers: { Accept: "image/*" },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const contentType = res.headers.get("content-type") || "image/jpeg"
    if (!contentType.startsWith("image/")) return null
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64")
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

export async function renderCommerceOgImage(opts: {
  source: ShareImageSource
  fit?: "cover" | "contain"
  title?: string
  subtitle?: string
  eyebrow?: string
}): Promise<ImageResponse> {
  const src = await resolveImageSrc(opts.source)
  const fit = opts.fit || "cover"
  const hasTextOverlay = !!(opts.title || opts.subtitle || opts.eyebrow)

  if (hasTextOverlay && src) {
    const heading = opts.title || ""
    const subtitle = opts.subtitle || ""
    const eyebrow = opts.eyebrow || ""
    
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            position: "relative",
            backgroundColor: "#111",
            fontFamily: "sans-serif",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: fit,
              objectPosition: "center",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.82) 100%)",
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "100%",
              height: "100%",
              padding: "56px 72px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.04em" }}>
                MAKINARI
              </div>
              {eyebrow ? (
                <div style={{ fontSize: 20, color: "rgba(255,255,255,0.8)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {eyebrow}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 980 }}>
              {heading ? (
                <div
                  style={{
                    fontSize: heading.length > 48 ? 48 : 60,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    letterSpacing: "-0.03em",
                    color: "#fff",
                  }}
                >
                  {heading}
                </div>
              ) : null}
              {subtitle ? (
                <div style={{ fontSize: 26, lineHeight: 1.35, color: "rgba(255,255,255,0.78)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ),
      { ...OG_SIZE },
    )
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#111111",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: fit,
              objectPosition: "center",
            }}
          />
        ) : null}
      </div>
    ),
    { ...OG_SIZE },
  )
}

export async function renderCommerceIcon(
  source: ShareImageSource,
  size: { width: number; height: number },
  opts?: { fit?: "cover" | "contain" },
): Promise<ImageResponse> {
  const src = await resolveImageSrc(source)
  const fit = opts?.fit || "cover"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: fit === "contain" ? "#ffffff" : "#111111",
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: fit,
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              fontSize: Math.round(size.width * 0.45),
              color: "#ffffff",
              fontWeight: 700,
            }}
          >
            M
          </div>
        )}
      </div>
    ),
    { ...size },
  )
}
