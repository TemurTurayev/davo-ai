"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTBControlStore } from "@/lib/store";
import { useEffect } from "react";

const THEMES = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "auto", icon: Monitor, label: "Auto" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTBControlStore();

  // Apply theme to html
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    if (theme === "auto") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = prefersDark ? "dark" : "light";
    } else {
      root.dataset.theme = theme;
    }
  }, [theme]);

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[2];
  const Icon = current.icon;

  const cycle = () => {
    const idx = THEMES.findIndex((t) => t.value === theme);
    setTheme(THEMES[(idx + 1) % THEMES.length].value);
  };

  return (
    <button
      onClick={cycle}
      title={current.label}
      aria-label={`Theme: ${current.label}`}
      className="w-9 h-9 rounded-full bg-[var(--color-mist)] hover:bg-white text-[var(--color-slate-600)] flex items-center justify-center transition-colors shadow-sm"
    >
      <Icon size={16} />
    </button>
  );
}
