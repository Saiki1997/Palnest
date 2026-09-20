import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SaveBar } from "@/components/save-bar";
import { IniEditorPanel } from "@/components/ini-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/lib/store";
import { groupedEngineTweaks, OPTIMIZE_PRESETS, renderCommandLine, tweaksToIni, addCustomArg } from "@/lib/args";
import { composeEngineIni, mergeFx, parsePastedIni } from "@/lib/fx";
import { instanceExe, overlayInstanceArgs } from "@/lib/fleet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/optimize")({ component: OptimizePage });

function OptimizePage() {
  const mode = useAppStore((s) => s.mode);
  const paths = useAppStore((s) => s.paths);
  const server = useAppStore((s) => s.server);
  const args = useAppStore((s) => s.launchArgs);
  const replaceLaunchArgs = useAppStore((s) => s.replaceLaunchArgs);
  const writeDenFiles = useAppStore((s) => s.writeDenFiles);
  const applyPreset = useAppStore((s) => s.applyPreset);
  const [flag, setFlag] = useState("");
  const [tab, setTab] = useState<"args" | "world" | "engine">("engine");
  const [draftArgs, setDraftArgs] = useState<typeof args | null>(null);

  const working = draftArgs ?? args;
  const argsDirty = Boolean(draftArgs);
  const exe =
    mode === "client"
      ? `${paths.client || "%CLIENT%"}\\Pal\\Binaries\\Win64\\Palworld.exe`
      : instanceExe(server, paths.server);
  const command = useMemo(() => renderCommandLine(exe, overlayInstanceArgs(working, server)), [exe, working, server]);
  const showServer = mode !== "client";

  function patchArg(id: string, patch: Partial<(typeof args)[number]>) {
    setDraftArgs((prev) => (prev ?? args).map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function saveArgs() {
    if (!draftArgs) return;
    replaceLaunchArgs(draftArgs);
    writeDenFiles();
    setDraftArgs(null);
    toast.success("Saved launch arguments");
  }

  return (
    <div>
      <PageHeader
        title="Engine tweaks"
        description="Launch arguments, PalWorldSettings, and Engine.ini performance tweaks. Server performance and Network stack on top of a world preset. Port, query, public IP, and public port follow the selected world and its tunnel."
      />

      <div className="mb-4 flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {(
          [
            ["args", "Launch args"],
            ["world", "World settings"],
            ["engine", "Engine.ini"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "h-9 rounded-sm px-3 text-sm font-medium",
              tab === id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "args" && showServer ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {OPTIMIZE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                applyPreset(p.id);
                setDraftArgs(null);
                toast.success(`Applied ${p.name}`);
              }}
              className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
            >
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {p.stackable ? "Stacks" : `${p.players} players`}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {tab === "args" ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Command line</h2>
            <Button type="button" size="sm" disabled={!argsDirty} onClick={saveArgs}>
              Save changes
            </Button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
            {command}
          </pre>
          <ul className="mt-4 divide-y divide-border">
            {working
              .filter((a) => (showServer ? true : a.category !== "network" && a.category !== "community"))
              .map((a) => (
                <li key={a.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <Switch checked={a.enabled} onCheckedChange={(v) => patchArg(a.id, { enabled: v })} />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm">{a.flag}{a.value ? `=${a.value}` : ""}</p>
                    <p className="text-sm text-muted-foreground">{a.note}</p>
                  </div>
                  {a.value !== "" || a.category === "custom" ? (
                    <Input
                      className="sm:max-w-36"
                      value={a.value}
                      onChange={(e) => patchArg(a.id, { value: e.target.value })}
                      aria-label={`${a.flag} value`}
                    />
                  ) : null}
                  {!a.builtin ? (
                    <Button size="sm" variant="ghost" onClick={() => setDraftArgs((prev) => (prev ?? args).filter((x) => x.id !== a.id))}>
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
          </ul>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!flag.trim()) return;
              setDraftArgs((prev) => [...(prev ?? args), addCustomArg(flag.trim())]);
              setFlag("");
            }}
          >
            <Input value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="-customFlag or EpicApp=PalServer" />
            <Button type="submit" variant="outline">
              Add flag
            </Button>
          </form>
          <SaveBar
            dirty={argsDirty}
            onSave={saveArgs}
            onDiscard={() => setDraftArgs(null)}
            hint="Launch arguments stay in this editor until you save. PalServer reads them on the next start."
          />
        </section>
      ) : null}

      {tab === "world" ? <IniEditorPanel /> : null}

      {tab === "engine" ? <EngineIniEditor mode={mode} /> : null}
    </div>
  );
}

function EngineIniEditor({ mode }: { mode: "client" | "server" | "both" }) {
  const tweaks = useAppStore((s) => s.engineTweaks);
  const setEngineTweak = useAppStore((s) => s.setEngineTweak);
  const writeDenFiles = useAppStore((s) => s.writeDenFiles);
  const fx = mergeFx(useAppStore((s) => s.fx));
  const setFx = useAppStore((s) => s.setFx);
  const addEngineBlock = useAppStore((s) => s.addEngineBlock);
  const moveEngineBlock = useAppStore((s) => s.moveEngineBlock);
  const removeEngineBlock = useAppStore((s) => s.removeEngineBlock);
  const showClient = mode !== "server";
  const showServer = mode !== "client";
  const [side, setSide] = useState<"client" | "server">(showClient ? "client" : "server");
  const [uiScale, setUiScale] = useState(fx.uiScale);
  const [paste, setPaste] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [liveText, setLiveText] = useState<string | null>(null);
  const [tweakOn, setTweakOn] = useState<Record<string, boolean>>({});

  const target = side;
  const workingTweaks = tweaks.map((t) => ({ ...t, enabled: tweakOn[t.id] ?? t.enabled }));
  const blocks = fx.engineBlocks.filter((b) => b.target === "both" || b.target === target);
  const composed = composeEngineIni({
    tweaksIni: tweaksToIni(workingTweaks, target),
    blocks: fx.engineBlocks,
    target,
    uiScale,
  });
  const text = liveText ?? composed;

  function save() {
    for (const [id, on] of Object.entries(tweakOn)) setEngineTweak(id, { enabled: on });
    const payload =
      target === "client"
        ? { uiScale, engineIniClient: liveText ?? composed }
        : { uiScale, engineIniServer: liveText ?? composed };
    setFx(payload);
    writeDenFiles();
    setDirty(false);
    setLiveText(null);
    setTweakOn({});
    toast.success(`Saved ${target} Engine.ini`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {showClient ? (
          <button
            type="button"
            onClick={() => setSide("client")}
            className={cn("h-9 rounded-sm px-3 text-sm font-medium", side === "client" ? "bg-card text-foreground" : "text-muted-foreground")}
          >
            Client
          </button>
        ) : null}
        {showServer ? (
          <button
            type="button"
            onClick={() => setSide("server")}
            className={cn("h-9 rounded-sm px-3 text-sm font-medium", side === "server" ? "bg-card text-foreground" : "text-muted-foreground")}
          >
            Server
          </button>
        ) : null}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {side === "client"
          ? "Graphics and engine tweaks for your game, not the server. The file lives under %LOCALAPPDATA%, and the game overwrites it on exit unless it is read-only. This editor keeps it read-only for you."
          : "Dedicated Engine.ini next to PalWorldSettings.ini. Tick, net driver, GC, and streaming belong here."}
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="grid gap-4 content-start">
          {side === "client" ? (
            <article className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">UI scale {uiScale}%</h2>
              <input
                type="range"
                min={50}
                max={150}
                value={uiScale}
                onChange={(e) => {
                  setUiScale(Number(e.target.value));
                  setDirty(true);
                }}
                className="w-full accent-primary"
              />
              <p className="mt-2 text-sm text-muted-foreground">
                Shrinks the in-game HUD and menus (ApplicationScale). 100% is off. Click Save to write the change.
              </p>
            </article>
          ) : null}
          <article className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                Managed tweaks in this file {blocks.length} blocks
              </h2>
              <Button size="sm" variant="outline" onClick={() => setPasteOpen((v) => !v)}>
                Paste tweak
              </Button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">Later blocks win where the same key appears twice. Use the arrows to move the block that should win to the bottom, then Save.</p>
            {pasteOpen ? (
              <div className="mb-3 grid gap-2">
                <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} className="min-h-28 font-mono text-xs" placeholder="Paste an Engine.ini block" />
                <Button
                  size="sm"
                  onClick={() => {
                    const parsed = parsePastedIni(paste);
                    if (!parsed.lines.trim()) {
                      toast.error("Paste some INI first");
                      return;
                    }
                    addEngineBlock({ name: parsed.name, target: side, lines: parsed.lines, enabled: true });
                    setPaste("");
                    setPasteOpen(false);
                    setDirty(true);
                    toast.success("Block added — Save to write Engine.ini");
                  }}
                >
                  Add block
                </Button>
              </div>
            ) : null}
            <ul className="space-y-2">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.version ? <Badge variant="outline">{b.version}</Badge> : null}
                      {b.source ? <Badge variant="outline" className="ml-1">{b.source}</Badge> : null}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { moveEngineBlock(b.id, -1); setDirty(true); }}>↑</Button>
                  <Button size="sm" variant="ghost" onClick={() => { moveEngineBlock(b.id, 1); setDirty(true); }}>↓</Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => { removeEngineBlock(b.id); setDirty(true); }}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">Built-in keys</h2>
            {groupedEngineTweaks(tweaks)
              .filter(([, list]) => list.some((t) => t.target === "both" || t.target === target))
              .map(([label, list]) => (
                <div key={label} className="mb-3 last:mb-0">
                  <h3 className="mb-1 text-xs text-muted-foreground">{label}</h3>
                  {list
                    .filter((t) => t.target === "both" || t.target === target)
                    .map((t) => (
                      <label key={t.id} className="mb-2 flex items-center gap-2 text-sm">
                        <Switch
                          checked={tweakOn[t.id] ?? t.enabled}
                          onCheckedChange={(v) => {
                            setTweakOn((prev) => ({ ...prev, [t.id]: v }));
                            setDirty(true);
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-mono text-xs">{t.key}</span>
                          <span className="block text-xs text-muted-foreground">{t.hint}</span>
                        </span>
                      </label>
                    ))}
                </div>
              ))}
          </article>
        </div>
        <article className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline">Read-only protected after save</Badge>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLiveText(null);
                  toast.message("Reloaded from managed blocks");
                }}
              >
                Reload
              </Button>
              <Button size="sm" onClick={save}>
                Save
              </Button>
            </div>
          </div>
          <Textarea
            value={text}
            onChange={(e) => {
              setLiveText(e.target.value);
              setDirty(true);
            }}
            className="min-h-[520px] font-mono text-xs"
          />
        </article>
      </div>
      <SaveBar dirty={dirty} onSave={save} onDiscard={() => { setUiScale(fx.uiScale); setLiveText(null); setTweakOn({}); setDirty(false); }} />
    </div>
  );
}