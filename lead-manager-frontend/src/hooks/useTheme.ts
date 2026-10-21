import { useState, useEffect } from "react";
import type { ThemeColor } from "@/types/leadManager";
import { THEME_COLORS } from "@/types/leadManager";

function getInitialIsDark(): boolean {
  if (typeof window === "undefined") return true;
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") return false;
  if (savedTheme === "dark") return true;
  return document.documentElement.classList.contains("dark");
}

function getInitialThemeColor(): ThemeColor {
  if (typeof window === "undefined") return "violet";
  const savedColor = localStorage.getItem("theme_color") as ThemeColor | null;
  if (savedColor && savedColor in THEME_COLORS) {
    return savedColor;
  }
  return "violet";
}

function getInitialCustomPrimary(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("custom_primary");
}

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(getInitialIsDark);
  const [themeColor, setThemeColorState] = useState<ThemeColor>(getInitialThemeColor);
  const [customPrimary, setCustomPrimaryState] = useState<string | null>(getInitialCustomPrimary);

  // Sync dark class on html element
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // Sync data-theme-color & --primary on html element
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (customPrimary) {
      document.documentElement.style.setProperty("--primary", customPrimary);
      document.documentElement.style.setProperty("--primary-hover", customPrimary);
      localStorage.setItem("custom_primary", customPrimary);
    } else {
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--primary-hover");
      localStorage.removeItem("custom_primary");
    }

    document.documentElement.setAttribute("data-theme-color", themeColor);
    localStorage.setItem("theme_color", themeColor);
  }, [themeColor, customPrimary]);

  const setThemeColor = (color: ThemeColor) => {
    setCustomPrimaryState(null);
    setThemeColorState(color);
  };

  const setCustomPrimary = (hex: string | null) => {
    setCustomPrimaryState(hex);
  };

  return {
    isDark,
    setIsDark,
    toggleIsDark: () => setIsDark((d) => !d),
    themeColor,
    setThemeColor,
    customPrimary,
    setCustomPrimary,
  };
}
