import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

export function MonitorTicker() {
  const mode = useAppStore((s) => s.mode);
  const tick = useAppStore((s) => s.tickMonitor);

  useEffect(() => {
    if (mode === "client") return;
    tick();
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [mode, tick]);

  return null;
}
