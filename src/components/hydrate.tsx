import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/lib/store";

export function HydrateGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    const done = Promise.resolve(useAppStore.persist?.rehydrate?.());
    void done.finally(() => {
      useAppStore.setState({ hydrateReady: true });
    });
  }, []);
  return children;
}
