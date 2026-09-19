import { cmpGameVersion, CURRENT_GAME } from "./catalog.ts";
import { DEPOT_PINS } from "./ops.ts";

export interface DedicatedLatest {
  version: string;
  build: string;
  newer: boolean;
  note: string;
  source: "steamcmd" | "pin";
  checkedAt: string;
}

function versionForManifest(manifest: string) {
  for (const [version, pin] of Object.entries(DEPOT_PINS)) {
    if (pin.manifest === manifest) return version;
  }
  return "";
}

export function parseSteamDedicatedInfo(body: unknown, current = CURRENT_GAME): DedicatedLatest {
  const checkedAt = new Date().toISOString();
  const bag = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const data = (bag.data && typeof bag.data === "object" ? bag.data : bag) as Record<string, unknown>;
  const app = (data["2394010"] || data[2394010] || data) as Record<string, unknown> | undefined;
  const depots = app && typeof app === "object" ? (app.depots as Record<string, unknown> | undefined) : undefined;
  const depot = depots && ((depots["2394011"] || depots[2394011]) as Record<string, unknown> | undefined);
  const manifests = depot && typeof depot === "object" ? (depot.manifests as Record<string, unknown> | undefined) : undefined;
  const pub = manifests && (manifests.public || manifests["public"]);
  const gid =
    typeof pub === "string"
      ? pub
      : pub && typeof pub === "object"
        ? String((pub as { gid?: string; id?: string }).gid || (pub as { id?: string }).id || "")
        : "";
  const mapped = gid ? versionForManifest(gid) : "";
  const newer = mapped ? cmpGameVersion(mapped, current) > 0 : Boolean(gid && !mapped);
  return {
    version: mapped || (newer ? `build ${gid}` : current),
    build: gid || DEPOT_PINS[current]?.manifest || "",
    newer,
    note: newer
      ? mapped
        ? `SteamCMD lists Palworld dedicated ${mapped} (manifest ${gid}). This world is on ${current}.`
        : `SteamCMD has a newer dedicated manifest ${gid} that Palnest has not pinned yet. Update when you are ready.`
      : `SteamCMD agrees this world is on the current Palworld dedicated line (${current}).`,
    source: gid ? "steamcmd" : "pin",
    checkedAt,
  };
}

export function pinnedLatest(current = CURRENT_GAME): DedicatedLatest {
  const pin = DEPOT_PINS[current];
  return {
    version: current,
    build: pin?.manifest || "",
    newer: false,
    note: `Pinned Palworld dedicated ${current}${pin ? ` (manifest ${pin.manifest})` : ""}. Check SteamCMD when Pocketpair ships a later build.`,
    source: "pin",
    checkedAt: new Date().toISOString(),
  };
}

export async function fetchSteamDedicatedLatest(current = CURRENT_GAME): Promise<DedicatedLatest> {
  try {
    const res = await fetch("https://api.steamcmd.net/v1/info/2394010");
    if (!res.ok) return { ...pinnedLatest(current), note: `SteamCMD lookup returned ${res.status}. Showing the pinned ${current} line.` };
    return parseSteamDedicatedInfo(await res.json(), current);
  } catch {
    return { ...pinnedLatest(current), note: `SteamCMD is unreachable from here. Palnest stays on pinned ${current}.` };
  }
}
