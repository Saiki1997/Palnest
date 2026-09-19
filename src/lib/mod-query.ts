/** Parse a Discover query: name, numeric id, or Nexus / Steam / CurseForge URL. */
export interface ParsedModQuery {
  text: string;
  source?: "nexus" | "steam" | "curseforge";
  sourceId?: string;
  url?: string;
}

export function parseModQuery(raw: string): ParsedModQuery {
  const text = raw.trim();
  if (!text) return { text: "" };

  const steam = text.match(/(?:steamcommunity\.com\/(?:sharedfiles|workshop)\/filedetails\/\?id=|workshop\/filedetails\/\?id=)(\d{6,})/i);
  if (steam) {
    return { text, source: "steam", sourceId: steam[1], url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${steam[1]}` };
  }

  const nexus = text.match(/nexusmods\.com\/palworld\/mods\/(\d+)/i);
  if (nexus) {
    return { text, source: "nexus", sourceId: nexus[1], url: `https://www.nexusmods.com/palworld/mods/${nexus[1]}` };
  }

  const curse = text.match(/curseforge\.com\/minecraft\/mc-mods\/|curseforge\.com\/[^/]+\/palworld[^/]*\/(?:mods|projects)\/([^/?#]+)/i);
  if (curse?.[1]) {
    return { text, source: "curseforge", sourceId: curse[1], url: text };
  }

  const curseId = text.match(/curseforge\.com\/.*[?&](?:projectid|id)=(\d+)/i);
  if (curseId) {
    return { text, source: "curseforge", sourceId: curseId[1], url: text };
  }

  if (/^\d{3,}$/.test(text)) {
    return { text, sourceId: text };
  }

  return { text };
}

export function catalogQueryHaystack(mod: {
  id: string;
  name: string;
  author: string;
  sourceId: string;
  url: string;
  category?: string;
  tags?: string[];
  description?: string;
}) {
  return [mod.id, mod.name, mod.author, mod.sourceId, mod.url, mod.category, ...(mod.tags ?? []), mod.description ?? ""]
    .join(" ")
    .toLowerCase();
}

export function matchesModQuery(
  mod: {
    id: string;
    name: string;
    author: string;
    source: string;
    sourceId: string;
    url: string;
    category?: string;
    tags?: string[];
    description?: string;
  },
  query: string,
  source?: string,
) {
  const parsed = parseModQuery(query);
  if (source && mod.source !== source && parsed.source && parsed.source !== source) return false;
  if (source && !parsed.source && mod.source !== source) return false;
  if (parsed.source && parsed.source !== mod.source && source && parsed.source !== source) return false;
  if (parsed.sourceId) {
    const id = parsed.sourceId.toLowerCase();
    if (mod.sourceId.toLowerCase() === id || mod.id.toLowerCase().includes(id) || (mod.url && mod.url.includes(parsed.sourceId))) {
      return !parsed.source || parsed.source === mod.source || !source;
    }
    if (!query.trim() || parsed.text === parsed.sourceId) return false;
  }
  const q = (parsed.sourceId ? parsed.text : query).trim().toLowerCase();
  if (!q) return true;
  return catalogQueryHaystack(mod).includes(q);
}
