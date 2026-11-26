/** Selected navigation refresh; legacy module prompts remain cache-compatible. */
const REALISTIC_MODULE_PALETTES: Readonly<Record<string, string>> = {
  procurementSettings: "vibrant golden orange as the dominant object color against a uniform pastel lavender background",
  appsLauncher: "vibrant cobalt blue as the dominant object color against a uniform pastel peach background",
  profile: "vibrant turquoise as the dominant object color against a uniform pastel coral background",
  notifications: "vibrant golden yellow as the dominant object color against a uniform pastel sky-blue background",
  businessOpen: "vibrant emerald green as the dominant object color against a uniform pastel peach background",
  businessClosed: "vibrant warm red as the dominant object color against a uniform pastel peach background",
  themeLight: "vibrant golden yellow as the dominant object color against a uniform pastel sky-blue background",
  themeDark: "vibrant violet as the dominant object color against a uniform pastel lavender-blue background",
  theme: "vibrant violet as the dominant crescent color with a golden sun against a uniform pastel sky-blue background",
  procurementApprovals: "vibrant emerald green as the dominant object color against a uniform pastel rose background",
  procurementRules: "vibrant royal purple as the dominant object color against a uniform pastel butter-yellow background",
  procurementTenders: "vibrant warm red as the dominant object color against a uniform pastel mint background",
  connectors: "vibrant turquoise as the dominant color with a restrained cobalt accent against a uniform pastel peach background",
  copywriting: "vibrant royal violet polished metal as the dominant object color with a restrained rose-gold collar against a uniform pastel peach background",
}

export function getRealisticModuleImagePrompt(
  itemKey: string,
  subject: string,
  clarifier?: string,
): string | undefined {
  const palette = REALISTIC_MODULE_PALETTES[itemKey]
  if (!palette) return undefined
  const frontal = itemKey === "appsLauncher"

  return [
    frontal
      ? `Front-facing 3D ${subject}, volumetric and photorealistic, highly recognizable, completely textless, no typography`
      : `Volumetric 3D isometric object of a ${subject}, highly recognizable, completely textless, no words, letters, numbers, logos, or typography, with clean surfaces`,
    clarifier,
    frontal
      ? "Strict frontal orthographic view, straight on at eye level, no isometric angle, no three-quarter view, no tilt or rotation. Centered upright emblem. Depth through shading only, not visible side faces"
      : "Lifelike standalone object floating in mid-air, gentle three-quarter isometric perspective, identifying face clearly visible",
    "Optically centered, filling 88 to 92 percent of the canvas with consistent safe margins and the entire silhouette visible; no app tile, squircle, container, badge, frame, pedestal, floor, scenery, or secondary icon",
    "ZERO contact shadows, NO drop shadow on the floor, no cast shadow on the background, no ground plane",
    "Solid geometry with realistic physically based materials (PBR), authentic metal, glass, ceramic, leather, or paper textures appropriate to the object, crisp raytraced specular reflections, polished surfaces, soft rounded edges and subtle pearlescent highlights; not a cartoon or plastic toy",
    `High-contrast vibrant color palette featuring ${palette}; use one dominant chromatic hue and one restrained supporting accent, reserving black, gray, and white for small functional details and highlights`,
    "Standardized seamless flat pastel background, no gradients or texture, clear color-blocked contrast",
    "Simple composition, one primary symbol, few large components, no tiny details, strong legibility at small UI sizes, crisp silhouette and clean geometry",
    "Photorealistic studio lighting, global illumination, and a bright rim light around the object to separate it completely from the background",
    "Modern polished UI asset, Unreal Engine 5 render, 8k resolution, highly detailed macro photography style",
  ].filter(Boolean).join(". ")
}