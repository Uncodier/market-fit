import fs from "node:fs"
import path from "node:path"
import { getModuleImageUrl, getModuleImagePrompt } from "@/app/config/module-image-visuals"
import { NAV_ITEM_ICON } from "@/app/config/module-visuals"
import { getBusinessStateImageKey, getThemeStateImageKey } from "@/app/config/sidebar-control-images"

describe("sidebar control images", () => {
  it.each(["businessOpen", "businessClosed", "themeLight", "themeDark"])("uses fixed shared artwork and a fallback for %s", (key) => {
    expect(getModuleImageUrl("settings", key, "Translated label")).toBe(`/api/images/modules/${key}`)
    expect(getModuleImagePrompt("settings", key, "Open")).toBe(getModuleImagePrompt("settings", key, "Closed"))
    expect(NAV_ITEM_ICON[key]).toBeDefined()
  })

  it.each([
    ["app/components/settings/BusinessOpenToggle.tsx", "getBusinessStateImageKey(isOpen)"],
    ["app/components/navigation/ConfigurationSection.tsx", "getThemeStateImageKey(isDarkMode)"],
  ])("connects %s to the image without replacing its switch", (file, key) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8")
    expect(source).toContain(`moduleImage={{ area: "settings", itemKey: ${key} }}`)
    expect(source).toContain("<Switch")
    expect(source).toContain("onCheckedChange=")
  })

  it("changes artwork for each live control state", () => {
    expect(getBusinessStateImageKey(true)).toBe("businessOpen")
    expect(getBusinessStateImageKey(false)).toBe("businessClosed")
    expect(getThemeStateImageKey(true)).toBe("themeDark")
    expect(getThemeStateImageKey(false)).toBe("themeLight")
    for (const keys of [["businessOpen", "businessClosed"], ["themeLight", "themeDark"]]) {
      expect(getModuleImagePrompt("settings", keys[0], "")).not.toBe(getModuleImagePrompt("settings", keys[1], ""))
    }
  })
})