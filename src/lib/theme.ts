import { useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "palnest-theme";
const listeners = new Set<() => void>();

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Runs before first paint (see `__root.tsx`) so the window never flashes the wrong theme. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked; still apply for this session.
  }
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", fn);
  return () => {
    listeners.delete(fn);
    media.removeEventListener("change", fn);
  };
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, read, () => "system");
}

/** The theme actually on screen, with "system" resolved. */
export function useResolvedTheme(): "light" | "dark" {
  const choice = useThemeChoice();
  const prefersLight = useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-color-scheme: light)").matches,
    () => false,
  );
  if (choice === "system") return prefersLight ? "light" : "dark";
  return choice;
}
