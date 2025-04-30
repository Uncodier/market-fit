"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  isDarkMode: boolean
  toggleTheme: () => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  isDarkMode: false,
  toggleTheme: () => null
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

// Helper function to apply theme and refresh CSS variables
const applyTheme = (theme: string, setIsDarkMode: (isDark: boolean) => void) => {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  setIsDarkMode(theme === "dark");
  
  // Force refresh of CSS variables by triggering a layout recalculation
  // This ensures all components using CSS variables get updated
  const currentScroll = window.scrollY;
  document.body.style.display = "none";
  // This forces a reflow, flushing the CSS changes
  void document.body.offsetHeight;
  document.body.style.display = "";
  window.scrollTo(0, currentScroll);
  
  // Dispatch a custom event so components can react to theme changes
  window.dispatchEvent(new CustomEvent("themechange", {
    detail: { isDark: theme === "dark" }
  }));
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey) as Theme
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [storageKey])

  useEffect(() => {
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      
      applyTheme(systemTheme, setIsDarkMode);
      return
    }

    applyTheme(theme, setIsDarkMode);
  }, [theme])

  // Add listener for system theme changes
  useEffect(() => {
    if (theme !== "system") return;
    
    // This handler will update the theme when system preference changes
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const newTheme = event.matches ? "dark" : "light";
      applyTheme(newTheme, setIsDarkMode);
    };
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme]);

  // Toggle between dark and light mode
  const toggleTheme = () => {
    setTheme(prev => {
      // If system, choose the opposite of the current system preference
      if (prev === "system") {
        const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const newTheme = systemIsDark ? "light" : "dark";
        localStorage.setItem(storageKey, newTheme);
        return newTheme;
      }
      
      // Otherwise toggle between light/dark
      const newTheme = prev === "dark" ? "light" : "dark";
      localStorage.setItem(storageKey, newTheme);
      return newTheme;
    });
  };

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
    isDarkMode,
    toggleTheme
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
} 