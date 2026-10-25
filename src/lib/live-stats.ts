import { create } from "zustand";

/** Latest measured process stats per server. Not persisted: it is only true while Palnest watches the process. */
export type ProcStats = { cpu: number; ramMb: number; at: number };

export const useLiveStats = create<{ byId: Record<string, ProcStats> }>(() => ({ byId: {} }));

export function recordProcStats(id: string, stats: Omit<ProcStats, "at">) {
  useLiveStats.setState((s) => ({ byId: { ...s.byId, [id]: { ...stats, at: Date.now() } } }));
}

export function clearProcStats(id: string) {
  useLiveStats.setState((s) => {
    if (!(id in s.byId)) return s;
    const byId = { ...s.byId };
    delete byId[id];
    return { byId };
  });
}
