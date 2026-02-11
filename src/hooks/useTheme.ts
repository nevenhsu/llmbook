"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "black";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 從 localStorage 載入 theme
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const initialTheme = savedTheme || (prefersDark ? "black" : "light");

    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
    setIsLoading(false);
  }, []);

  const toggleTheme = () => {
    const newTheme: Theme = theme === "light" ? "black" : "light";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return { theme, toggleTheme, setTheme: setThemeValue, isLoading };
}
