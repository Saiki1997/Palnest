import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SettingsFields } from "@/components/settings-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store";
import { groupedEngineTweaks, OPTIMIZE_PRESETS, renderCommandLine, tweaksToIni } from "@/lib/args";
import { instanceExe, overlayInstanceArgs } from "@/lib/fleet";
import { editedCount, settingsToIni } from "@/lib/ini";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/optimize")({ component: OptimizePage });

function OptimizePage() {
  const mode = useAppStore((s) => s.mode);
  const paths = useAppStore((s) => s.paths);
  const server = useAppStore((s) => s.server);
  const args = useAppStore((s) => s.launchArgs);
  const settings = useAppStore((s) => s.worldSettings);
  const tweaks = useAppStore((s) => s.engineTweaks);
  const setLaunchArg = useAppStore((s) => s.setLaunchArg);
  const addLaunchArg = useAppStore((s) => s.addLaunchArg);
  const removeLaunchArg = useAppStore((s) => s.removeLaunchArg);
  const applyPreset = useAppStore((s) => s.applyPreset);
  const setWorldSetting = useAppStore((s) => s.setWorldSetting);
  const setEngineTweak = useAppStore((s) => s.setEngineTweak);
  const writeDenFiles = useAppStore((s) => s.writeDenFiles);
  const [flag, setFlag] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"args" | "world" | "engine">("args");

  const exe =
    mode === "client"
      ? `${paths.client || "%CLIENT%"}\\Pal\\Binaries\\Win64\\Palworld.exe`
      : instanceExe(server, paths.server);
  const command = useMemo(() => renderCommandLine(exe, overlayInstanceArgs(args, server)), [exe, args, server]);
  const engineIni = useMemo(() => tweaksToIni(tweaks, mode === "client" ? "client" : "server"), [tweaks, mode]);
  const showServer = mode !== "client";
  const enabledTweaks = tweaks.filter((t) => t.enabled && (showServer ? t.target !== "client" : t.target !== "server")).length;

  return (
    <div>
      <PageHeader
        title="Optimize"
        description="Launch arguments, PalWorldSettings, and Engine.ini performance tweaks. Server performance and Network stack on top of a world preset. Port, query, public IP, and public port follow the selected world and its tunnel."
      />

      {showServer ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {OPTIMIZE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                applyPreset(p.id);
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

      {tab === "args" ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Command line</h2>
          <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
            {command}
          </pre>
          <ul className="mt-4 divide-y divide-border">
            {args
              .filter((a) => (showServer ? true : a.category !== "network" && a.category !== "community"))
              .map((a) => (
                <li key={a.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <Switch checked={a.enabled} onCheckedChange={(v) => setLaunchArg(a.id, { enabled: v })} />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm">{a.flag}{a.value ? `=${a.value}` : ""}</p>
                    <p className="text-sm text-muted-foreground">{a.note}</p>
                  </div>
                  {a.value !== "" || a.category === "custom" ? (
                    <Input
                      className="sm:max-w-36"
                      value={a.value}
                      onChange={(e) => setLaunchArg(a.id, { value: e.target.value })}
                      aria-label={`${a.flag} value`}
                    />
                  ) : null}
                  {!a.builtin ? (
                    <Button size="sm" variant="ghost" onClick={() => removeLaunchArg(a.id)}>
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
              addLaunchArg(flag.trim());
              setFlag("");
            }}
          >
            <Input value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="-customFlag or EpicApp=PalServer" />
            <Button type="submit" variant="outline">
              Add flag
            </Button>
          </form>
        </section>
      ) : null}

      {tab === "world" ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {editedCount(settings)} keys differ from vanilla. Import, download, and World.sav live on Worlds.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/worlds" search={{ tab: "ini" }}>
                Full INI + World.sav editor
              </Link>
            </Button>
          </div>
          <Input
            className="mb-4"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search world settings"
          />
          <SettingsFields settings={settings} onChange={setWorldSetting} query={query} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                const text = settingsToIni(settings);
                void navigator.clipboard?.writeText(text);
                toast.success("Copied PalWorldSettings.ini");
              }}
            >
              Copy current INI
            </Button>
          </div>
        </section>
      ) : null}

      {tab === "engine" ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {enabledTweaks} Engine.ini keys write into Pal\\Saved\\Config\\WindowsServer on start and Write to PalServer.
              Tick, net driver, GC, and streaming stay on the dedicated box; view distance stays on the game.
            </p>
            {showServer ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    applyPreset("perf");
                    toast.success("Applied server performance pack");
                  }}
                >
                  Apply server performance
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    writeDenFiles();
                    toast.success("Wrote Engine.ini next to PalWorldSettings.ini");
                  }}
                >
                  Write Engine.ini
                </Button>
              </div>
            ) : null}
          </div>
          {groupedEngineTweaks(tweaks)
            .filter(([, list]) => showServer || list.some((t) => t.target !== "server"))
            .map(([label, list]) => (
              <div key={label} className="mb-4 last:mb-0">
                <h3 className="mb-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">{label}</h3>
                <ul className="divide-y divide-border">
                  {list
                    .filter((t) => (showServer ? true : t.target !== "server"))
                    .map((t) => (
                      <li key={t.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                        <Switch checked={t.enabled} onCheckedChange={(v) => setEngineTweak(t.id, { enabled: v })} />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm">
                            [{t.section}] {t.key}={t.value}
                          </p>
                          <p className="text-sm text-muted-foreground">{t.hint}</p>
                        </div>
                        <Badge variant="outline">{t.target}</Badge>
                        {t.lines?.length ? (
                          <Badge variant="outline">{t.lines.length} keys</Badge>
                        ) : (
                          <Input
                            className="sm:max-w-36"
                            value={t.value}
                            onChange={(e) => setEngineTweak(t.id, { value: e.target.value })}
                          />
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          <pre className="mt-4 overflow-x-auto rounded-md bg-background p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
            {engineIni}
          </pre>
        </section>
      ) : null}
    </div>
  );
}