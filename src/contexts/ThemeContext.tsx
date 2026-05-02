import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useAuth } from "./AuthContext";

export type ThemeMode = "light" | "dark" | "auto";
export type ThemePalette = "coral" | "blue" | "green" | "violet" | "mocha";

interface ThemeContextValue {
  mode: ThemeMode;
  palette: ThemePalette;
  chatBackground: string | null;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "auto",
  palette: "coral",
  chatBackground: null,
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();

  const mode: ThemeMode = (profile as any)?.theme_mode || "auto";
  const palette: ThemePalette = (profile as any)?.theme_palette || "coral";
  const chatBackground: string | null = (profile as any)?.chat_background || null;

  // Apply palette on <html>
  useEffect(() => {
    const html = document.documentElement;
    if (palette === "coral") {
      html.removeAttribute("data-palette");
    } else {
      html.setAttribute("data-palette", palette);
    }
  }, [palette]);

  // Apply light/dark/auto
  useEffect(() => {
    const html = document.documentElement;
    const apply = (isDark: boolean) => {
      if (isDark) html.classList.add("dark");
      else html.classList.remove("dark");
    };

    if (mode === "dark") apply(true);
    else if (mode === "light") apply(false);
    else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mode]);

  const value = useMemo(
    () => ({ mode, palette, chatBackground }),
    [mode, palette, chatBackground]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
