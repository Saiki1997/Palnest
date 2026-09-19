import type { AppMode } from "./types";

export type GuideStepId =
  | "mode"
  | "path-client"
  | "path-server"
  | "ue4ss"
  | "palschema"
  | "keys"
  | "mod"
  | "checker"
  | "tunnel";

export interface GuideSnapshot {
  onboarded: boolean;
  mode: AppMode;
  paths: { client: string; server: string };
  keys: { nexus: string; steam: string; curseforge: string };
  frameworks: Record<string, { clientVersion: string | null; serverVersion: string | null }>;
  mods: { target: string }[];
  checkerRan: boolean;
  instances?: { running?: boolean; tunnel?: { status?: string } }[];
}

export interface GuideStep {
  id: GuideStepId;
  n: number;
  title: string;
  body: string;
  optional?: boolean;
  done: boolean;
  href?: string;
}

function sideInstalled(
  fw: { clientVersion: string | null; serverVersion: string | null } | undefined,
  mode: AppMode,
) {
  if (!fw) return false;
  if (mode === "client") return Boolean(fw.clientVersion);
  if (mode === "server") return Boolean(fw.serverVersion);
  return Boolean(fw.clientVersion) && Boolean(fw.serverVersion);
}

function hasModForMode(mods: { target: string }[], mode: AppMode) {
  if (mode === "client") return mods.some((m) => m.target === "client" || m.target === "both");
  if (mode === "server") return mods.some((m) => m.target === "server" || m.target === "both");
  return mods.length > 0;
}

export function denGuide(state: GuideSnapshot): GuideStep[] {
  const needsClient = state.mode !== "server";
  const needsServer = state.mode !== "client";
  const steps: GuideStep[] = [];
  let n = 1;

  steps.push({
    id: "mode",
    n: n++,
    title: "Pick a mode",
    body:
      state.mode === "client"
        ? "Client only — Palworld.exe, no dedicated box."
        : state.mode === "server"
          ? "Server only — PalServer, game install is optional."
          : "Client + server — one world for both installs.",
    done: state.onboarded,
    href: "/settings",
  });

  if (needsClient) {
    steps.push({
      id: "path-client",
      n: n++,
      title: "Set the Palworld game folder",
      body: "Steam copy of Palworld. Browse it to detect UE4SS, PalSchema, and PAK mods already installed.",
      optional: true,
      done: Boolean(state.paths.client.trim()),
      href: "/settings",
    });
  }

  if (needsServer) {
    steps.push({
      id: "path-server",
      n: n++,
      title: "Set the dedicated server folder",
      body: "PalServer root. Browse it to import the world and detect mods already on disk.",
      optional: true,
      done: Boolean(state.paths.server.trim()),
      href: "/settings",
    });
  }

  steps.push({
    id: "ue4ss",
    n: n++,
    title: needsClient && !needsServer ? "Install UE4SS on the client" : needsServer && !needsClient ? "Install UE4SS on the server" : "Install UE4SS on client and server",
    body: "Palworld 1.0 needs the Palworld UE4SS zip, not the generic 3.0.1 build.",
    done: sideInstalled(state.frameworks.ue4ss, state.mode),
    href: "/frameworks",
  });

  steps.push({
    id: "palschema",
    n: n++,
    title: "Install PalSchema",
    body: "JSON packs live under ue4ss/Mods/PalSchema/mods.",
    done: sideInstalled(state.frameworks.palschema, state.mode),
    href: "/frameworks",
  });

  steps.push({
    id: "keys",
    n: n++,
    title: "Add store API keys",
    body: "Nexus, Steam, or CurseForge. The Palnest index works without keys.",
    optional: true,
    done: Boolean(state.keys.nexus || state.keys.steam || state.keys.curseforge),
    href: "/settings",
  });

  steps.push({
    id: "mod",
    n: n++,
    title: "Add a mod",
    body: "Discover from Nexus, Steam Workshop, or CurseForge. Palnest sorts UE4SS, PalSchema, and PAK folders.",
    done: hasModForMode(state.mods, state.mode),
    href: "/discover",
  });

  steps.push({
    id: "checker",
    n: n++,
    title: "Run the mod checker",
    body: "Catch broken packs and version pins after UE4SS or a game update.",
    done: state.checkerRan,
    href: "/checker",
  });

  if (needsServer) {
    steps.push({
      id: "tunnel",
      n: n++,
      title: "Share the island",
      body: "Forward UDP yourself, or one-click playit.gg / PortWarp so friends can join without a router rule. You can also create a second PalServer on the next port block.",
      optional: true,
      done: Boolean(
        state.instances?.some((i) => i.tunnel?.status === "online" || i.running),
      ),
      href: "/tunnels",
    });
  }

  return steps;
}

export function guideRemaining(steps: GuideStep[]) {
  return steps.filter((s) => !s.done && !s.optional);
}

export function guideShouldShow(steps: GuideStep[], dismissed: boolean) {
  if (dismissed) return false;
  return steps.some((s) => !s.done);
}

export function guideProgress(steps: GuideStep[]) {
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  return { done, total: required.length, pct: required.length ? Math.round((done / required.length) * 100) : 100 };
}
