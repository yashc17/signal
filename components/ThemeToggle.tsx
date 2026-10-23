"use client";
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
  return (
    <button onClick={next} className="control text-xs" aria-label={`Theme: ${theme}`} title="Toggle theme">
      {theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark"}
    </button>
  );
}
