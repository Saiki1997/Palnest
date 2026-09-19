import type { InstalledMod } from "./types.ts";

export interface CrashBlame {
  modId: string;
  name: string;
  evidence: string;
}

function slug(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const HINTS = [
  /ue4ss[\\/]+mods[\\/]+([^\\/\s"'[\]]+)/i,
  /~mods[\\/]+([^\\/\s"'[\]]+\.pak)/i,
  /scripts[\\/]+main\.lua/i,
  /\[lua\]\s+([A-Za-z0-9_\- ]{2,80})/i,
  /mod(?:name)?[:\s]+([A-Za-z0-9_\- ]{2,80})/i,
  /palschema[\\/]+mods[\\/]+([^\\/\s"'[\]]+)/i,
];

function matchMod(mods: InstalledMod[], token: string): InstalledMod | undefined {
  const s = slug(token.replace(/\.pak$/i, ""));
  if (!s || s.length < 4) return undefined;
  const exact = mods.find((m) => slug(m.name) === s || slug(m.installPath.split(/[\\/]/).pop() ?? "") === s);
  if (exact) return exact;
  return mods.find((m) => {
    const names = [m.name, m.installPath].map((v) => slug(v)).filter((n) => n.length >= 4);
    return names.some((n) => n.includes(s) || s.includes(n));
  });
}

/** Name the enabled pack most likely to have killed PalServer from console text. */
export function blameCrash(mods: InstalledMod[], lines: { text: string }[]): CrashBlame | null {
  const enabled = mods.filter((m) => m.enabled && m.target !== "client");
  const recent = lines.slice(-80).map((l) => l.text);
  let hit: InstalledMod | undefined;
  let evidence = "";
  for (let i = recent.length - 1; i >= 0; i--) {
    const line = recent[i];
    for (const re of HINTS) {
      const m = line.match(re);
      if (!m) continue;
      const token = m[1] || line;
      const found = matchMod(enabled, token);
      if (found) {
        hit = found;
        evidence = line.slice(0, 220);
        break;
      }
    }
    if (hit) break;
  }
  if (!hit) {
    hit = enabled.filter((m) => m.broken).at(-1) ?? enabled.filter((m) => m.kind === "ue4ss").at(-1);
    evidence = hit ? "Last enabled pack after a PalServer watchdog trip (no Lua path in the log)." : "";
  }
  if (!hit) return null;
  return { modId: hit.id, name: hit.name, evidence };
}
