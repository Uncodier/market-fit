type DemoTableMap = Record<string, any>

export function mergeDemoData(base: DemoTableMap, ...overlays: DemoTableMap[]): DemoTableMap {
  return overlays.reduce((current, overlay) => applyOverlay(current, overlay), { ...base })
}

function applyOverlay(base: DemoTableMap, overlay: DemoTableMap): DemoTableMap {
  const merged: DemoTableMap = { ...base }

  for (const [key, value] of Object.entries(overlay || {})) {
    if (key === "settingsPatch" && value && typeof value === "object" && !Array.isArray(value)) {
      merged.settings = (base.settings || []).map((row: any) => ({ ...row, ...value }))
      continue
    }

    if (key === "sitesPatch" && value && typeof value === "object" && !Array.isArray(value)) {
      merged.sites = (base.sites || []).map((row: any) => ({ ...row, ...value }))
      continue
    }

    if (Array.isArray(value) && Array.isArray(base[key])) {
      merged[key] = [...base[key], ...value]
      continue
    }

    merged[key] = value
  }

  return merged
}
