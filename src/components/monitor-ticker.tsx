import { useEffect } from "react";
import { isDesktopApp } from "@/lib/desktop";
import { useAppStore } from "@/lib/store";

/** Drives the simulated monitor in the browser preview. */
export function MonitorTicker() {
  const mode = useAppStore((s) => s.mode);
  const tick = useAppStore((s) => s.tickMonitor);

  useEffect(() => {
    // Demo data for the browser preview only; the desktop app records real samples.
    if (mode === "client" || isDesktopApp()) return;
    tick();
    const id = window.setInterval(tick, 6000);
    return () => window.clearInterval(id);
  }, [mode, tick]);

  return null;
}
