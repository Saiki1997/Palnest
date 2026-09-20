import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function nextCopyName(existing: string[], base: string) {
  const root = base.replace(/\s+copy(?:\s+\d+)?$/i, "").trim() || base;
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  let label = `${root} copy`;
  let i = 2;
  while (taken.has(label.toLowerCase())) {
    label = `${root} copy ${i}`;
    i += 1;
  }
  return label;
}

export function formatUptime(startedAt: string | null, now = Date.now()) {
  if (!startedAt) return "Stopped";
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 47) return `${Math.floor(h / 24)}d ${h % 24}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s % 60}s`;
  return `${m}m ${s % 60}s`;
}

export function formatBytes(kb: number) {
  if (kb < 1024) return `${Math.round(kb)} KB`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${(kb / 1024 / 1024).toFixed(2)} GB`;
}

export function timeAgo(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatStamp(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1)}m`;
}

export function formatSizePretty(kb?: number) {
  if (kb == null || kb <= 0) return "0B";
  const bytes = kb * 1024;
  if (bytes < 1024) return `${Math.round(bytes)}B`;
  if (bytes < 1024 * 1024) {
    const k = bytes / 1024;
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)}MB`;
}

export function formatDayLong(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function periodCutoff(period: string, from?: string, to?: string): { start?: number; end?: number } {
  const now = Date.now();
  if (period === "custom") {
    return {
      start: from ? new Date(from).getTime() : undefined,
      end: to ? new Date(to).getTime() + 86400000 - 1 : undefined,
    };
  }
  const days =
    period === "1d" ? 1 : period === "7d" ? 7 : period === "14d" ? 14 : period === "28d" ? 28 : period === "1y" ? 365 : 0;
  if (!days) return {};
  return { start: now - days * 86400000, end: now };
}
