"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      setTheme((localStorage.getItem("signal:theme") as Theme) || "system");
    } catch {}
  }, []);
  const next = () => {
    const order: Theme[] = ["system", "light", "dark"];
    const t = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(t);
    try {
      if (t === "system") {
        localStorage.removeItem("signal:theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("signal:theme", t);
        document.documentElement.dataset.theme = t;
      }
    } catch {}
    window.dispatchEvent(new Event("signal:theme"));
  };
  const Icon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;
  const label = theme === "system" ? "System theme" : theme === "light" ? "Light theme" : "Dark theme";
  return (
    <button onClick={next} className="icon-btn focus-ring" aria-label={`${label} — click to change`} title={label}>
      <Icon size={16} strokeWidth={1.9} />
    </button>
  );
}
