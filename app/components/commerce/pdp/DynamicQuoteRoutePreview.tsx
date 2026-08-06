"use client"

import { useEffect, useMemo, useState } from "react"
import type { DynamicQuoteField } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"

type Coords = { lat: number; lon: number }
type LatLng = [number, number]
type BBox = { minLat: number; maxLat: number; minLon: number; maxLon: number }

const TILE_SIZE = 256
const MAP_W = 640
const MAP_H = 320

function resolveGeocodeUrl(query: string) {
  const search = new URLSearchParams()
  search.set("address", query)
  search.set("city", query)
  search.set("name", query)
  const path = `/api/geocode?${search.toString()}`
  const isWww =
    typeof window !== "undefined" && window.location.hostname === "www.makinari.com"
  return isWww ? `https://app.makinari.com${path}` : path
}

async function geocodeQuery(query: string): Promise<Coords | null> {
  try {
    const res = await fetch(resolveGeocodeUrl(query), { cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    const c = data?.coords
    if (c == null || Number.isNaN(Number(c.lat)) || Number.isNaN(Number(c.lon))) return null
    return { lat: Number(c.lat), lon: Number(c.lon) }
  } catch {
    return null
  }
}

async function fetchRoutePath(from: Coords, to: Coords): Promise<LatLng[] | null> {
  try {
    const params = new URLSearchParams({
      fromLat: String(from.lat),
      fromLon: String(from.lon),
      toLat: String(to.lat),
      toLon: String(to.lon),
    })
    const res = await fetch(`/api/route/preview?${params}`, { cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data?.path) ? data.path : null
  } catch {
    return null
  }
}

function lon2tile(lon: number, zoom: number) {
  return ((lon + 180) / 360) * Math.pow(2, zoom)
}

function lat2tile(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  )
}

function buildBbox(points: Coords[]): BBox {
  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const padLat = Math.max((maxLat - minLat) * 0.4, 0.08)
  const padLon = Math.max((maxLon - minLon) * 0.4, 0.08)
  return {
    minLat: Math.max(-85, minLat - padLat),
    maxLat: Math.min(85, maxLat + padLat),
    minLon: minLon - padLon,
    maxLon: maxLon + padLon,
  }
}

function pickZoom(bbox: BBox): number {
  for (let z = 12; z >= 4; z--) {
    const x0 = lon2tile(bbox.minLon, z)
    const x1 = lon2tile(bbox.maxLon, z)
    const y0 = lat2tile(bbox.maxLat, z)
    const y1 = lat2tile(bbox.minLat, z)
    if ((x1 - x0) * TILE_SIZE <= MAP_W * 1.5 && (y1 - y0) * TILE_SIZE <= MAP_H * 1.5) {
      return z
    }
  }
  return 4
}

/** Uniform Web-Mercator fit so the map is not anamorphically stretched. */
function mapTransform(bbox: BBox, zoom: number) {
  const worldX0 = lon2tile(bbox.minLon, zoom)
  const worldY0 = lat2tile(bbox.maxLat, zoom)
  const worldX1 = lon2tile(bbox.maxLon, zoom)
  const worldY1 = lat2tile(bbox.minLat, zoom)
  const worldW = Math.max(worldX1 - worldX0, 1e-9)
  const worldH = Math.max(worldY1 - worldY0, 1e-9)
  // Cover the viewBox (uniform scale) so the map fills the card without letterboxing
  const scale = Math.max(MAP_W / worldW, MAP_H / worldH)
  const offsetX = (MAP_W - worldW * scale) / 2
  const offsetY = (MAP_H - worldH * scale) / 2
  return { worldX0, worldY0, scale, offsetX, offsetY }
}

function project(
  lat: number,
  lon: number,
  bbox: BBox,
  zoom: number,
  transform = mapTransform(bbox, zoom)
) {
  const x = lon2tile(lon, zoom)
  const y = lat2tile(lat, zoom)
  return {
    x: transform.offsetX + (x - transform.worldX0) * transform.scale,
    y: transform.offsetY + (y - transform.worldY0) * transform.scale,
  }
}

function buildTiles(bbox: BBox, zoom: number) {
  const transform = mapTransform(bbox, zoom)
  // Tiles for the full viewBox (cover may show area outside the route bbox)
  const viewWorldX0 = transform.worldX0 - transform.offsetX / transform.scale
  const viewWorldY0 = transform.worldY0 - transform.offsetY / transform.scale
  const viewWorldX1 = viewWorldX0 + MAP_W / transform.scale
  const viewWorldY1 = viewWorldY0 + MAP_H / transform.scale
  const x0 = Math.floor(viewWorldX0)
  const x1 = Math.floor(viewWorldX1)
  const y0 = Math.floor(viewWorldY0)
  const y1 = Math.floor(viewWorldY1)
  const tilePx = transform.scale

  const tiles: Array<{ key: string; left: number; top: number; url: string }> = []
  const maxTile = Math.pow(2, zoom) - 1
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (x < 0 || y < 0 || x > maxTile || y > maxTile) continue
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        left: transform.offsetX + (x - transform.worldX0) * transform.scale,
        top: transform.offsetY + (y - transform.worldY0) * transform.scale,
        url: `https://a.basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`,
      })
    }
  }
  return { tiles, tileW: tilePx, tileH: tilePx, transform }
}

export function DynamicQuoteRoutePreview({
  fields,
  values,
  className,
  embedded = false,
}: {
  fields: DynamicQuoteField[]
  values: Record<string, unknown>
  className?: string
  embedded?: boolean
}) {
  const { t } = useLocalization()
  const [coords, setCoords] = useState<Coords[]>([])
  const [path, setPath] = useState<LatLng[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const queries = useMemo(() => {
    return fields
      .filter((f) => f.type === "location" || f.type === "address")
      .map((f) => String(values[f.key] ?? "").trim())
      .filter(Boolean)
      .slice(0, 2)
  }, [fields, values])

  const queriesKey = queries.join("||")

  useEffect(() => {
    const activeQueries = queriesKey ? queriesKey.split("||").filter(Boolean) : []
    if (activeQueries.length < 2) {
      setCoords([])
      setPath(null)
      setLoading(false)
      setError(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(false)
      try {
        const results = await Promise.all(activeQueries.map((q) => geocodeQuery(q)))
        if (cancelled) return
        const points = results.filter((c): c is Coords => Boolean(c))
        setCoords(points)

        if (points.length >= 2) {
          const route = await fetchRoutePath(points[0], points[1])
          if (!cancelled) {
            setPath(
              route || [
                [points[0].lat, points[0].lon],
                [points[1].lat, points[1].lon],
              ]
            )
          }
        } else {
          setPath(null)
          setError(true)
        }
      } catch {
        if (!cancelled) {
          setCoords([])
          setPath(null)
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 450)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [queriesKey])

  const mapModel = useMemo(() => {
    if (coords.length < 2) return null
    const bbox = buildBbox(coords)
    const zoom = pickZoom(bbox)
    const { tiles, tileW, tileH, transform } = buildTiles(bbox, zoom)
    const line = (path || [
      [coords[0].lat, coords[0].lon],
      [coords[1].lat, coords[1].lon],
    ]) as LatLng[]
    const polyline = line
      .map(([lat, lon]) => {
        const p = project(lat, lon, bbox, zoom, transform)
        return `${p.x},${p.y}`
      })
      .join(" ")
    const markers = coords.map((c, i) => ({
      ...project(c.lat, c.lon, bbox, zoom, transform),
      filled: i === 0,
    }))
    return { tiles, tileW, tileH, polyline, markers }
  }, [coords, path])

  if (queries.length < 2) return null

  return (
    <div
      className={cn(
        "w-full aspect-[2/1] overflow-hidden bg-[#e8eef2] relative",
        !embedded && "rounded-2xl border",
        className
      )}
      role="img"
      aria-label={t("pdp.dynamicQuote.routePreview") || "Route preview"}
    >
      {loading && (
        <div className="absolute inset-0 z-20 animate-pulse bg-muted/50" aria-hidden />
      )}

      {mapModel ? (
        <svg
          className="absolute inset-0 block w-full h-full"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="xMidYMid slice"
        >
          {mapModel.tiles.map((tile) => (
            <image
              key={tile.key}
              href={tile.url}
              x={tile.left}
              y={tile.top}
              width={mapModel.tileW}
              height={mapModel.tileH}
              preserveAspectRatio="none"
            />
          ))}
          <polyline
            points={mapModel.polyline}
            fill="none"
            stroke="#2563eb"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {mapModel.markers.map((m, i) => (
            <g key={i}>
              <circle cx={m.x} cy={m.y} r="9" fill="#fff" opacity="0.9" />
              <circle
                cx={m.x}
                cy={m.y}
                r="6"
                fill={m.filled ? "#111827" : "#fff"}
                stroke="#111827"
                strokeWidth="2.5"
              />
            </g>
          ))}
        </svg>
      ) : (
        !loading &&
        error && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground px-4 text-center bg-muted/40">
            {t("pdp.dynamicQuote.routePreviewUnavailable") ||
              "Map preview unavailable for these locations"}
          </div>
        )
      )}
    </div>
  )
}
