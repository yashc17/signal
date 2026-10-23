"use client";
// Personal layer: starred companies + application status, stored only in this browser.
import { useCallback, useEffect, useState } from "react";

export const STATUSES = ["interested", "applied", "interviewing", "offer", "pass"] as const;
export type Status = (typeof STATUSES)[number];
export type WatchEntry = { status: Status; note?: string; added: string };
export type Watchlist = Record<string, WatchEntry>;

const KEY = "signal:watchlist";
const EVT = "signal:watchlist";

function read(): Watchlist {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function write(w: Watchlist) {
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

export function useWatchlist() {
  const [list, setList] = useState<Watchlist>({});
  useEffect(() => {
    const sync = () => setList(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const toggle = useCallback((slug: string) => {
    const w = read();
    if (w[slug]) delete w[slug];
    else w[slug] = { status: "interested", added: new Date().toISOString().slice(0, 10) };
    write(w);
  }, []);
  const update = useCallback((slug: string, patch: Partial<WatchEntry>) => {
    const w = read();
    if (!w[slug]) return;
    w[slug] = { ...w[slug], ...patch };
    write(w);
  }, []);
  const replace = useCallback((w: Watchlist) => write(w), []);
  return { list, toggle, update, replace };
}
