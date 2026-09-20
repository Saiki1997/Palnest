import type { DiscoverCategory, ModSource } from "./types";

export const NEXUS_CATEGORIES = [
  "Animations",
  "Audio",
  "Characters",
  "Gameplay",
  "Miscellaneous",
  "Outfits",
  "Pals",
  "Palworld",
  "Scripts",
  "User Interface",
  "Utilities",
  "Visuals",
  "Weapons",
];

const CATEGORY_ALIASES: Record<string, string> = {
  frameworks: "Utilities",
  framework: "Utilities",
  ui: "User Interface",
  "user interface": "User Interface",
  "quality of life": "Utilities",
  qol: "Utilities",
  map: "Utilities",
  breeding: "Pals",
  base: "Gameplay",
  pals: "Pals",
  gameplay: "Gameplay",
  scripts: "Scripts",
  audio: "Audio",
  visuals: "Visuals",
  visual: "Visuals",
  weapons: "Weapons",
  outfits: "Outfits",
  characters: "Characters",
  animations: "Animations",
  miscellaneous: "Miscellaneous",
  palworld: "Palworld",
  utilities: "Utilities",
};

export function normalizeCategory(raw?: string) {
  if (!raw) return "Miscellaneous";
  const hit = CATEGORY_ALIASES[raw.trim().toLowerCase()];
  if (hit) return hit;
  const named = NEXUS_CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase());
  return named || raw;
}

export function storeUrl(source: ModSource, sourceId: string, fallback = "") {
  if (source === "nexus") return `https://www.nexusmods.com/palworld/mods/${sourceId}`;
  if (source === "steam") return `https://steamcommunity.com/sharedfiles/filedetails/?id=${sourceId}`;
  if (source === "curseforge") return `https://www.curseforge.com/palworld/mods/${sourceId}`;
  return fallback;
}

export function stripHtml(html: string) {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countCategories(hits: { category?: string }[]): DiscoverCategory[] {
  const counts = new Map<string, number>();
  for (const h of hits) {
    const c = normalizeCategory(h.category);
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const rows = NEXUS_CATEGORIES.map((name) => ({ name, count: counts.get(name) || 0 }));
  for (const [name, count] of counts) {
    if (!rows.some((c) => c.name === name)) rows.push({ name, count });
  }
  return rows;
}
