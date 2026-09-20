import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SaveBar } from "@/components/save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { mergeFx, OPTI_DX11, OPTI_DX12, UE4SS_BUILTINS, type ClientFx, type OptiFgInput, type OptiFgOutput, type OptiFsrUpgrade } from "@/lib/fx";
import { fetchPalSchemaReleases, fetchUe4ssReleases } from "@/lib/releases";
import { useAppStore } from "@/lib/store";
import { formatBytes, formatStamp, cn } from "@/lib/utils";
import type { InstallTarget, RemoteRelease } from "@/lib/types";

export const Route = createFileRoute("/_app/frameworks")({ component: FrameworksPage });

type FxTab = "ue4ss" | "palschema" | "reshade" | "optiscaler";

function FrameworksPage() {
  const mode = useAppStore((s) => s.mode);
  const frameworks = useAppStore((s) => s.frameworks);
  const mods = useAppStore((s) => s.mods);
  const installFramework = useAppStore((s) => s.installFramework);
  const ops = useAppStore((s) => s.ops);
  const setOps = useAppStore((s) => s.setOps);
  const fx = mergeFx(useAppStore((s) => s.fx));
  const setFx = useAppStore((s) => s.setFx);
  const writeDenFiles = useAppStore((s) => s.writeDenFiles);
  const [tab, setTab] = useState<FxTab>("ue4ss");
  const [ue4ss, setUe4ss] = useState<RemoteRelease[]>([]);
  const [schema, setSchema] = useState<RemoteRelease[]>([]);
  const [ueNote, setUeNote] = useState("Checking GitHub…");
  const [schemaNote, setSchemaNote] = useState("Checking GitHub…");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Partial<ClientFx> | null>(null);

  useEffect(() => {
    let live = true;
    void fetchUe4ssReleases().then((res) => {
      if (!live) return;
      setUe4ss(res.releases);
      setUeNote(res.ok ? "Latest from Okaetsu/RE-UE4SS" : res.error || "Cached Palworld build");
    });
    void fetchPalSchemaReleases().then((res) => {
      if (!live) return;
      setSchema(res.releases);
      setSchemaNote(res.ok ? "Latest from Okaetsu/PalSchema" : res.error || "Cached PalSchema");
    });
    return () => {
      live = false;
    };
  }, []);

  const channel = ops?.ue4ssChannel ?? "stable";
  const ueList = channel === "experimental" ? ue4ss : ue4ss.filter((r) => !r.prerelease);
  const latestUe =
    ueList.find(
      (r) =>
        /palworld/i.test(`${r.name} ${r.tag} ${r.body}`) ||
        r.assets.some((a) => /palworld/i.test(a.name)),
    ) || ueList[0];
  const latestSchema = schema[0];
  const palworldZip =
    latestUe?.assets.find((a) => /palworld/i.test(a.name) && !/dev/i.test(a.name)) || latestUe?.assets[0];

  function install(id: "ue4ss" | "palschema" | "reshade" | "optiscaler", side: InstallTarget, version: string, asset: string) {
    const key = `${id}-${side}`;
    setProgress((p) => ({ ...p, [key]: 8 }));
    let v = 8;
    const t = window.setInterval(() => {
      v = Math.min(100, v + 12 + Math.random() * 10);
      setProgress((p) => ({ ...p, [key]: v }));
      if (v >= 100) {
        window.clearInterval(t);
        installFramework(id, side, version, asset);
        toast.success(`${id === "ue4ss" ? "UE4SS" : id === "palschema" ? "Pal Schema" : id} ${version} installed`);
      }
    }, 180);
  }

  const showClient = mode !== "server";
  const showServer = mode !== "client";
  const next = { ...fx, ...draft };
  const dirty = Boolean(draft);

  function patch(p: Partial<ClientFx>) {
    setDraft((d) => ({ ...(d ?? {}), ...p }));
  }

  function save() {
    if (!draft) return;
    setFx(draft);
    writeDenFiles();
    setDraft(null);
    toast.success("Saved framework settings");
  }

  const schemaMods = mods.filter((m) => m.kind === "palschema");
  const tabs: { id: FxTab; label: string; hide?: boolean }[] = [
    { id: "ue4ss", label: "UE4SS" },
    { id: "palschema", label: "Pal Schema" },
    { id: "reshade", label: "ReShade", hide: !showClient },
    { id: "optiscaler", label: "OptiScaler", hide: !showClient },
  ];

  return (
    <div>
      <PageHeader
        title="Frameworks"
        description="UE4SS, Pal Schema, ReShade, and OptiScaler. Missing-side banners only appear when this den is client+server."
      />
      <div className="mb-5 flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {tabs
          .filter((t) => !t.hide)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-9 rounded-sm px-3 text-sm font-medium",
                tab === t.id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("mr-2 inline-block size-1.5 rounded-full", liveDot(frameworks[t.id === "palschema" ? "palschema" : t.id], mode))} />
              {t.label}
            </button>
          ))}
      </div>

      {tab === "ue4ss" ? (
        <Ue4ssPanel
          mode={mode}
          showClient={showClient}
          showServer={showServer}
          frameworks={frameworks}
          latestUe={latestUe}
          palworldZip={palworldZip}
          ueNote={ueNote}
          channel={channel}
          setChannel={(ch) => setOps({ ue4ssChannel: ch })}
          progress={progress}
          install={install}
          next={next}
          patch={patch}
        />
      ) : null}
      {tab === "palschema" ? (
        <PalSchemaPanel
          mode={mode}
          showClient={showClient}
          showServer={showServer}
          frameworks={frameworks}
          latestSchema={latestSchema}
          schemaNote={schemaNote}
          schemaMods={schemaMods}
          progress={progress}
          install={install}
          next={next}
          patch={patch}
        />
      ) : null}
      {tab === "reshade" && showClient ? (
        <ReshadePanel frameworks={frameworks} progress={progress} install={install} next={next} patch={patch} />
      ) : null}
      {tab === "optiscaler" && showClient ? (
        <OptiPanel frameworks={frameworks} progress={progress} install={install} next={next} patch={patch} />
      ) : null}

      <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(null)} hint="Framework config writes on Save — UE4SS-settings.ini, PalSchema config.json, ReShade.ini, OptiScaler.ini." />
    </div>
  );
}

function liveDot(fw: { clientVersion: string | null; serverVersion: string | null } | undefined, mode: string) {
  if (!fw) return "bg-muted-foreground/40";
  if (mode === "client") return fw.clientVersion ? "bg-ok" : "bg-muted-foreground/40";
  if (mode === "server") return fw.serverVersion ? "bg-ok" : "bg-muted-foreground/40";
  return fw.clientVersion || fw.serverVersion ? "bg-ok" : "bg-muted-foreground/40";
}

function sideLabel(client: string | null, server: string | null, mode: string) {
  if (mode === "client") return client ? `Client ${client}` : "Client missing";
  if (mode === "server") return server ? `Server ${server}` : "Server missing";
  const bits = [];
  bits.push(client ? `Client ${client}` : "Client missing");
  bits.push(server ? `Server ${server}` : "Server missing");
  return bits.join(" · ");
}

function Ue4ssPanel({
  mode,
  showClient,
  showServer,
  frameworks,
  latestUe,
  palworldZip,
  ueNote,
  channel,
  setChannel,
  progress,
  install,
  next,
  patch,
}: {
  mode: string;
  showClient: boolean;
  showServer: boolean;
  frameworks: ReturnType<typeof useAppStore.getState>["frameworks"];
  latestUe?: RemoteRelease;
  palworldZip?: RemoteRelease["assets"][number];
  ueNote: string;
  channel: string;
  setChannel: (ch: "stable" | "experimental") => void;
  progress: Record<string, number>;
  install: (id: "ue4ss", side: InstallTarget, version: string, asset: string) => void;
  next: ClientFx;
  patch: (p: Partial<ClientFx>) => void;
}) {
  const ue = frameworks.ue4ss;
  const overlayBusy = Boolean(frameworks.optiscaler.clientVersion || frameworks.reshade.clientVersion);
  return (
    <div className="grid gap-4">
      <div className="mb-1 flex flex-wrap gap-2">
        {(["stable", "experimental"] as const).map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => setChannel(ch)}
            className={cn(
              "h-9 rounded-sm border px-3 text-sm capitalize",
              channel === ch ? "border-primary bg-card" : "border-border hover:bg-muted",
            )}
          >
            {ch} UE4SS
          </button>
        ))}
      </div>
      <div className={cn("grid gap-4", showClient && showServer ? "lg:grid-cols-2" : "")}>
        {showClient ? (
          <article className="rounded-xl border border-border bg-card p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn("size-2 rounded-full", ue.clientVersion ? "bg-ok" : "bg-muted-foreground/50")} />
              <h2 className="font-medium">{ue.clientVersion ? "UE4SS is installed" : "UE4SS is not on the client"}</h2>
              {ue.clientVersion ? <Badge variant="outline">{ue.clientVersion}</Badge> : null}
              <Badge variant="outline">PALWORLD BUILD</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Loads as dwmapi.dll · {ueNote}
              {latestUe?.publishedAt ? ` · ${formatStamp(latestUe.publishedAt)}` : ""}
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{palworldZip ? `${palworldZip.name} (${formatBytes(palworldZip.size / 1024)})` : "UE4SS-Palworld.zip"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <InstallButton
                label="Install / update client"
                progress={progress["ue4ss-client"]}
                onClick={() => install("ue4ss", "client", latestUe?.tag || "2281fa31", palworldZip?.name || "UE4SS-Palworld.zip")}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  install("ue4ss", "client", "v3.0.1", "UE4SS-Palworld.zip");
                  toast.success("Rolling back client UE4SS to v3.0.1");
                }}
              >
                Roll back
              </Button>
            </div>
            <ConsoleBlock
              title="UE4SS console"
              overlayBusy={overlayBusy}
              value={next.ue4ssClient}
              onChange={(ue4ssClient) => patch({ ue4ssClient })}
            />
            <Builtins />
          </article>
        ) : null}
        {showServer ? (
          <article className="rounded-xl border border-border bg-card p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn("size-2 rounded-full", ue.serverVersion ? "bg-ok" : "bg-muted-foreground/50")} />
              <h2 className="font-medium">{ue.serverVersion ? "Server UE4SS is installed" : "Server UE4SS is not installed"}</h2>
              {ue.serverVersion ? <Badge variant="outline">{ue.serverVersion}</Badge> : null}
              <Badge variant="outline">PALWORLD BUILD</Badge>
              <label className="ml-auto flex items-center gap-2 text-sm">
                Loaded on server start
                <Switch checked={next.ue4ssLoadedOnStart} onCheckedChange={(v) => patch({ ue4ssLoadedOnStart: v })} />
              </label>
            </div>
            <p className="text-sm text-muted-foreground">UE4SS.log last written with PalServer · 2 backups kept</p>
            <div className="mt-3">
              <InstallButton
                label="Install / update server"
                progress={progress["ue4ss-server"]}
                onClick={() => install("ue4ss", "server", latestUe?.tag || "2281fa31", palworldZip?.name || "UE4SS-Palworld.zip")}
              />
            </div>
            <ConsoleBlock title="UE4SS console" overlayBusy={false} value={next.ue4ssServer} onChange={(ue4ssServer) => patch({ ue4ssServer })} />
            <Builtins />
          </article>
        ) : null}
      </div>
      {mode === "both" ? (
        <p className="text-sm text-muted-foreground">{sideLabel(ue.clientVersion, ue.serverVersion, mode)}</p>
      ) : null}
      <ProxyChain frameworks={frameworks} />
    </div>
  );
}

function ConsoleBlock({
  title,
  overlayBusy,
  value,
  onChange,
}: {
  title: string;
  overlayBusy: boolean;
  value: ClientFx["ue4ssClient"];
  onChange: (v: ClientFx["ue4ssClient"]) => void;
}) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-background p-4">
      <h3 className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">{title}</h3>
      <ToggleRow
        label="Debug console window"
        hint="Opens a separate console alongside the game and prints UE4SS and Lua output into it."
        checked={value.debugWindow}
        onCheckedChange={(v) => onChange({ ...value, debugWindow: v })}
      />
      <ToggleRow
        label="In-game debug window"
        hint={overlayBusy ? "Unavailable while OptiScaler and ReShade overlays are on — only one in-game overlay can run at a time." : "Draws UE4SS’s own debug window over the game."}
        checked={value.inGame}
        disabled={overlayBusy}
        onCheckedChange={(v) => onChange({ ...value, inGame: v })}
      />
      <ToggleRow
        label="Show it on start"
        hint="Puts the in-game window on screen as the game loads rather than leaving it hidden."
        checked={value.showOnStart}
        disabled={overlayBusy}
        onCheckedChange={(v) => onChange({ ...value, showOnStart: v })}
      />
    </div>
  );
}

function Builtins() {
  return (
    <details className="mt-4 rounded-lg border border-border bg-background p-4">
      <summary className="cursor-pointer text-sm font-medium">UE4SS built-ins · {UE4SS_BUILTINS.length} built-ins</summary>
      <ul className="mt-3 grid gap-1 text-sm text-muted-foreground">
        {UE4SS_BUILTINS.map((n) => (
          <li key={n} className="font-mono text-xs">
            {n}
          </li>
        ))}
      </ul>
    </details>
  );
}

function PalSchemaPanel({
  mode,
  showClient,
  showServer,
  frameworks,
  latestSchema,
  schemaNote,
  schemaMods,
  progress,
  install,
  next,
  patch,
}: {
  mode: string;
  showClient: boolean;
  showServer: boolean;
  frameworks: ReturnType<typeof useAppStore.getState>["frameworks"];
  latestSchema?: RemoteRelease;
  schemaNote: string;
  schemaMods: { id: string; name: string; enabled: boolean; version: string }[];
  progress: Record<string, number>;
  install: (id: "palschema", side: InstallTarget, version: string, asset: string) => void;
  next: ClientFx;
  patch: (p: Partial<ClientFx>) => void;
}) {
  const ps = frameworks.palschema;
  return (
    <div className="grid gap-4">
      <article className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn("size-2 rounded-full", ps.clientVersion || ps.serverVersion ? "bg-ok" : "bg-muted-foreground/50")} />
              <h2 className="font-medium">{ps.clientVersion || ps.serverVersion ? "Pal Schema is installed" : "Pal Schema is not installed"}</h2>
              <Badge variant="outline">{ps.clientVersion || ps.serverVersion || latestSchema?.tag || "v0.6.1"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Palworld’s own Steam build is 24181527. {schemaNote}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {schemaMods.length} schema mods loaded
              {showServer ? ` · Server: ${ps.serverVersion ? "installed" : "not installed"}, ${schemaMods.filter((m) => m.enabled).length} schema mods loaded. Dedicated servers are supported from 0.4.0 onwards.` : ""}
            </p>
          </div>
          {mode === "both" ? (
            <div className="flex items-center gap-2 text-sm">
              Client
              <Switch checked={next.palSchemaClient} onCheckedChange={(v) => patch({ palSchemaClient: v })} />
              Server
              <Switch checked={next.palSchemaServer} onCheckedChange={(v) => patch({ palSchemaServer: v })} />
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {showClient ? (
            <InstallButton
              label="Install on client"
              progress={progress["palschema-client"]}
              onClick={() => install("palschema", "client", latestSchema?.tag || "0.6.71", "PalSchema.zip")}
            />
          ) : null}
          {showServer ? (
            <InstallButton
              label="Install on server"
              progress={progress["palschema-server"]}
              onClick={() => install("palschema", "server", latestSchema?.tag || "0.6.71", "PalSchema.zip")}
            />
          ) : null}
        </div>
      </article>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Schema mods · {schemaMods.length} schema mods</h3>
          {schemaMods.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No schema mods are installed through the app yet. Anything you install from Discover that ships Pal Schema files lands here rather than in the mods list.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {schemaMods.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{m.name}</span>
                  <Badge variant="outline">{m.version}</Badge>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">Pal Schema config</h3>
          <p className="mb-3 text-sm text-muted-foreground">Read from PalSchema\config\config.json. Changes take effect the next time the game starts.</p>
          <label className="grid gap-2 text-sm">
            Language override
            <span className="text-xs text-muted-foreground">An ISO-639 code, so translation mods load for a language Palworld does not ship. Empty follows your Steam language.</span>
            <Input value={next.palSchemaLang} onChange={(e) => patch({ palSchemaLang: e.target.value })} placeholder="en" />
          </label>
          <ToggleRow
            label="Hot reload on save"
            hint="Reloads schema mods when their files change on disk. Meant for authoring a mod, not for playing."
            checked={next.palSchemaHotReload}
            onCheckedChange={(v) => patch({ palSchemaHotReload: v })}
          />
          <ToggleRow
            label="Verbose logging"
            hint="Writes a lot more detail into the UE4SS log. Worth turning on while chasing a schema mod that will not load."
            checked={next.palSchemaVerbose}
            onCheckedChange={(v) => patch({ palSchemaVerbose: v })}
          />
        </article>
      </div>
    </div>
  );
}

function ReshadePanel({
  frameworks,
  progress,
  install,
  next,
  patch,
}: {
  frameworks: ReturnType<typeof useAppStore.getState>["frameworks"];
  progress: Record<string, number>;
  install: (id: "reshade", side: InstallTarget, version: string, asset: string) => void;
  next: ClientFx;
  patch: (p: Partial<ClientFx>) => void;
}) {
  const rs = frameworks.reshade;
  return (
    <div className="grid gap-4">
      <article className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn("size-2 rounded-full", rs.clientVersion ? "bg-ok" : "bg-muted-foreground/50")} />
              <h2 className="font-medium">{rs.clientVersion ? "ReShade is installed" : "ReShade is not installed"}</h2>
              <Badge variant="outline">{rs.clientVersion || rs.latestKnown || "v6.7.3"}</Badge>
              <Badge variant="outline">ADDON BUILD</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Installed as dxgi.dll · with full addon support · active preset: {next.reshadePresets.find((p) => p.id === next.reshadePresetId)?.name ?? "none"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <InstallButton label="Install / update" progress={progress["reshade-client"]} onClick={() => install("reshade", "client", "6.5.1", "ReShade_Setup.exe")} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                install("reshade", "client", "6.3.1", "ReShade_Setup.exe");
                toast.success("Rolling back ReShade to 6.3.1");
              }}
            >
              Roll back
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.message("Guided setup walks DXGI → addons → a starter preset.")}>
              Guided setup
            </Button>
          </div>
        </div>
      </article>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">Presets ({next.reshadePresets.length})</h3>
          <ul className="space-y-2">
            {next.reshadePresets.map((p) => (
              <li key={p.id} className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2">
                <input
                  type="radio"
                  name="reshade-preset"
                  checked={next.reshadePresetId === p.id}
                  onChange={() => patch({ reshadePresetId: p.id, reshadePresets: next.reshadePresets.map((x) => ({ ...x, active: x.id === p.id })) })}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {p.name} <Badge variant="outline">{p.source}</Badge>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p.effects}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">Addons ({next.reshadeAddons.length})</h3>
          <ul className="space-y-3">
            {next.reshadeAddons.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.note}</p>
                </div>
                <Switch
                  checked={a.enabled}
                  onCheckedChange={(v) =>
                    patch({ reshadeAddons: next.reshadeAddons.map((x) => (x.id === a.id ? { ...x, enabled: v } : x)) })
                  }
                />
              </li>
            ))}
          </ul>
        </article>
      </div>
      <ProxyChain frameworks={frameworks} />
    </div>
  );
}

function OptiPanel({
  frameworks,
  progress,
  install,
  next,
  patch,
}: {
  frameworks: ReturnType<typeof useAppStore.getState>["frameworks"];
  progress: Record<string, number>;
  install: (id: "optiscaler", side: InstallTarget, version: string, asset: string) => void;
  next: ClientFx;
  patch: (p: Partial<ClientFx>) => void;
}) {
  const os = frameworks.optiscaler;
  return (
    <div className="grid gap-4">
      <article className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn("size-2 rounded-full", os.clientVersion ? "bg-ok" : "bg-muted-foreground/50")} />
              <h2 className="font-medium">{os.clientVersion ? "OptiScaler is installed" : "OptiScaler is not installed"}</h2>
              <Badge variant="outline">{os.clientVersion || os.latestKnown || "v0.9.4-final"}</Badge>
              <Badge variant="outline">WINMM.DLL</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Installed as winmm.dll · OptiScaler.ini beside the game · launches with DX12 · Frame generation output:{" "}
              {next.optiFgOutput === "fsr" ? "FSR frame generation" : next.optiFgOutput}
            </p>
          </div>
          <InstallButton label="Install / update" progress={progress["optiscaler-client"]} onClick={() => install("optiscaler", "client", os.latestKnown || "0.7.9", "OptiScaler.zip")} />
        </div>
      </article>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">Frame generation</h3>
          <p className="mb-3 text-sm text-muted-foreground">The technique that renders the generated frames.</p>
          <p className="mb-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">Output</p>
          {(
            [
              ["off", "Off", "No generated frames."],
              ["fsr", "FSR frame generation", "Uses amd_fidelityfx_dx12.dll, amd_fidelityfx_framegeneration_dx12.dll"],
              ["xess", "XeSS frame generation", "Needs libxess_fg.dll, libxell.dll"],
              ["nukem", "Nukem’s DLSSG to FSR3", "Converts a game’s own DLSSG calls. Palworld has none — this will crash on launch."],
            ] as [OptiFgOutput, string, string][]
          ).map(([id, label, hint]) => (
            <label key={id} className="mb-2 flex cursor-pointer gap-3 rounded-md border border-border bg-background px-3 py-2">
              <input type="radio" name="fg-out" checked={next.optiFgOutput === id} onChange={() => patch({ optiFgOutput: id })} className="mt-1" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
          <p className="mt-4 mb-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">Input</p>
          {(
            [
              ["off", "Off"],
              ["upscaler", "Upscaler"],
              ["fsr", "FSR frame generation"],
              ["fsr3", "FSR frame generation 3.0"],
              ["dlssg", "DLSSG"],
              ["nukem", "Nukem’s"],
            ] as [OptiFgInput, string][]
          ).map(([id, label]) => (
            <label key={id} className="mb-2 flex cursor-pointer gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <input type="radio" name="fg-in" checked={next.optiFgInput === id} onChange={() => patch({ optiFgInput: id })} />
              {label}
            </label>
          ))}
        </article>
        <article className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">Upscalers</h3>
          <label className="mb-4 grid gap-1 text-sm">
            DX12 upscaler
            <select
              className="h-10 rounded-sm border border-border bg-background px-2"
              value={next.optiDx12}
              onChange={(e) => patch({ optiDx12: e.target.value })}
            >
              {OPTI_DX12.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">The one that matters here, because frame generation needs DX12 anyway.</span>
          </label>
          <div className="mb-4">
            <p className="text-sm font-medium">Upgrade FSR 3.1 to FSR 4</p>
            <div className="mt-2 inline-flex rounded-md bg-muted p-1">
              {(["auto", "on", "off"] as OptiFsrUpgrade[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch({ optiFsr4: id })}
                  className={cn("h-8 rounded-sm px-3 text-sm capitalize", next.optiFsr4 === id ? "bg-card" : "text-muted-foreground")}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
          <label className="mb-4 grid gap-1 text-sm">
            DX11 upscaler
            <select
              className="h-10 rounded-sm border border-border bg-background px-2"
              value={next.optiDx11}
              onChange={(e) => patch({ optiDx11: e.target.value })}
            >
              {OPTI_DX11.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Vulkan upscaler
            <select
              className="h-10 rounded-sm border border-border bg-background px-2"
              value={next.optiVulkan}
              onChange={(e) => patch({ optiVulkan: e.target.value })}
            >
              <option value="auto">Auto</option>
              <option value="fsr22">FSR 2.2</option>
            </select>
            <span className="text-xs text-muted-foreground">Palworld does not use Vulkan. Auto is OptiScaler’s own default of FSR 2.2.</span>
          </label>
        </article>
      </div>
    </div>
  );
}

function ProxyChain({ frameworks }: { frameworks: ReturnType<typeof useAppStore.getState>["frameworks"] }) {
  const bits = [
    frameworks.reshade.clientVersion ? `dxgi.dll — ReShade ${frameworks.reshade.clientVersion}` : null,
    frameworks.optiscaler.clientVersion ? `winmm.dll — OptiScaler ${frameworks.optiscaler.clientVersion}` : null,
    frameworks.ue4ss.clientVersion || frameworks.ue4ss.serverVersion
      ? `dwmapi.dll — UE4SS ${frameworks.ue4ss.clientVersion || frameworks.ue4ss.serverVersion}`
      : null,
  ].filter(Boolean);
  if (!bits.length) return null;
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">Proxy DLL chain · {bits.length} components load through their own proxy dll. No collisions.</h3>
      <ul className="space-y-1 font-mono text-sm text-muted-foreground">
        {bits.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </article>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function InstallButton({
  label,
  progress,
  onClick,
}: {
  label: string;
  progress?: number;
  onClick: () => void;
}) {
  const running = progress !== undefined && progress < 100;
  return (
    <div>
      <Button size="sm" variant="outline" disabled={running} onClick={onClick}>
        {running ? "Fetching zip…" : label}
      </Button>
      {progress !== undefined && progress < 100 ? <Progress className="mt-2" value={progress} /> : null}
    </div>
  );
}
