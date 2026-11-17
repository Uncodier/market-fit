export function getBusinessStateImageKey(isOpen: boolean): "businessOpen" | "businessClosed" {
  return isOpen ? "businessOpen" : "businessClosed"
}

export function getThemeStateImageKey(isDarkMode: boolean): "themeDark" | "themeLight" {
  return isDarkMode ? "themeDark" : "themeLight"
}