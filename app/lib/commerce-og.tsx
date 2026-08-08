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
  title: string
  subtitle?: string | null
  source: ShareImageSource
  fit?: "cover" | "contain"
}): Promise<ImageResponse> {
  const src = await resolveImageSrc(opts.source)
  const fit = opts.fit || "cover"
  const subtitle = opts.subtitle?.replace(/\s+/g, " ").trim().slice(0, 140)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 56,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0) 70%)",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            {opts.title}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                marginTop: 16,
                fontSize: 28,
                color: "rgba(255,255,255,0.88)",
                lineHeight: 1.35,
                maxWidth: 1000,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  )
}

export async function renderCommerceIcon(
  source: ShareImageSource,
  size: { width: number; height: number },
): Promise<ImageResponse> {
  const src = await resolveImageSrc(source)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111111",
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
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
