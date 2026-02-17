"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme} className="btn btn-ghost btn-circle" aria-label="Toggle theme">
      {theme === "black" ? (
        <Sun size={20} className="text-base-content" />
      ) : (
        <Moon size={20} className="text-base-content" />
      )}
    </button>
  );
}
