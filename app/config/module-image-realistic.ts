/** Selected navigation refresh; legacy module prompts remain cache-compatible. */
const REALISTIC_MODULE_PALETTES: Readonly<Record<string, string>> = {
  procurementSettings: "vibrant golden orange as the dominant object color against a uniform pastel lavender background",
  appsLauncher: "vibrant cobalt blue as the dominant object color against a uniform pastel peach background",
  procurementApprovals: "vibrant emerald green as the dominant object color against a uniform pastel rose background",
  procurementRules: "vibrant royal purple as the dominant object color against a uniform pastel butter-yellow background",
  procurementTenders: "vibrant warm red as the dominant object color against a uniform pastel mint background",
}

export function getRealisticModuleImagePrompt(
  itemKey: string,
  subject: string,
  clarifier?: string,
): string | undefined {
  const palette = REALISTIC_MODULE_PALETTES[itemKey]
  if (!palette) return undefined

  return [
    `Volumetric 3D isometric object of a ${subject}, highly recognizable, completely textless, no words, letters, numbers, logos, or typography, with clean surfaces`,
    clarifier,
    "Photorealistic and lifelike standalone object floating purely in mid-air, viewed in a gentle consistent three-quarter isometric perspective with its identifying face clearly visible",
    "Optically centered and evenly balanced, filling 88 to 92 percent of the canvas with a narrow consistent safe margin and the entire natural silhouette visible; no app tile, iOS-style squircle, rounded-square container, badge, button, frame, plaque, pedestal, floor, horizon, scenery, or secondary icon",
    "ZERO contact shadows, NO drop shadow on the floor, no cast shadow on the background, no ground plane",
    "Fully solid 3D geometry with highly realistic physically based materials (PBR), authentic lifelike metal, glass, ceramic, leather, or paper textures appropriate to the object, with crisp raytraced specular reflections; smooth polished surfaces, soft rounded edges, subtle pearlescent highlights where physically appropriate, not a cartoon or plastic toy",
    `High-contrast vibrant color palette featuring ${palette}; use one dominant chromatic hue and one restrained supporting accent, reserving black, gray, and white for small functional details and highlights`,
    "Standardized seamless flat pastel color-blocked background, without gradients or texture, providing clear separation and making the main object pop brightly",
    "Keep the composition simple, with one primary symbol, few large components, no tiny details, and strong legibility at small UI sizes; prioritize a crisp readable silhouette and clean geometry over decorative complexity",
    "Photorealistic studio lighting, global illumination, and a bright rim light around the object to separate it completely from the background",
    "Modern polished UI asset, Unreal Engine 5 render, 8k resolution, highly detailed macro photography style",
  ].filter(Boolean).join(". ")
}