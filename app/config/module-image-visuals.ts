import { publicPromptImageUrl } from "@/app/lib/image-utils"
import type { WorkspaceArea } from "./navigation-areas"

const AREA_IMAGE_COLORS: Record<WorkspaceArea, string> = {
  marketing: "red",
  sales: "blue",
  operations: "teal",
  buying: "amber",
  automation: "violet",
  applications: "indigo",
  finance: "emerald",
  reports: "lime",
  settings: "magenta",
}

/** Flat contrasting pastel field — no gradients. */
const AREA_IMAGE_BACKGROUNDS: Record<WorkspaceArea, string> = {
  marketing: "mint pastel",
  sales: "peach pastel",
  operations: "blush pastel",
  buying: "periwinkle pastel",
  automation: "pale lime pastel",
  applications: "peach pastel",
  finance: "blush pastel",
  reports: "lavender pastel",
  settings: "mint pastel",
}

const SCREEN_ICON_ALIASES: Record<string, string> = {
  aiWorkspace: "home",
}

function screenIconSubject(itemKey: string, title: string): string {
  const alias = SCREEN_ICON_ALIASES[itemKey]
  if (alias) return `${alias} icon`
  const fromKey = itemKey.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().trim()
  const label = fromKey || title.trim().toLowerCase() || "app"
  return `${label} icon`
}

export function getModuleImagePrompt(
  area: WorkspaceArea,
  itemKey: string,
  title: string,
): string {
  const subject = screenIconSubject(itemKey, title)
  const color = AREA_IMAGE_COLORS[area]
  const background = AREA_IMAGE_BACKGROUNDS[area]

  return [
    `Volumetric 3D isometric object of a ${subject}, highly recognizable, completely textless, no words and clean surface without any typography`,
    "Photorealistic and lifelike everyday object, standalone item floating purely in mid-air",
    "ZERO contact shadows, NO drop shadow on the floor",
    "Fully solid 3D geometry with highly realistic physically based materials (PBR), authentic textures (lifelike metal, glass, fabric, etc.) with crisp raytraced specular reflections",
    `High-contrast vibrant color palette featuring ${color} as the dominant color`,
    `Set against a standardized, uniform ${background} background to create a consistent, cohesive color-blocked contrast and make the main object pop brightly`,
    "Photorealistic studio lighting, global illumination, and a bright rim light around the object to separate it completely from the background",
    "Unreal Engine 5 render, 8k resolution, highly detailed macro photography style",
  ].join(". ")
}

export function getModuleImageUrl(
  area: WorkspaceArea,
  itemKey: string,
  title: string,
): string {
  return publicPromptImageUrl(getModuleImagePrompt(area, itemKey, title), 256)
}
