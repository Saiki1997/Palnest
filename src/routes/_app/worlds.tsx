import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileDrop } from "@/components/file-drop";
import { ImportServerDialog } from "@/components/import-server-dialog";
import { PageHeader } from "@/components/page-header";
import { SettingsFields } from "@/components/settings-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { downloadBytes, downloadText, readFileBytes, readFileText, saveBytes, saveText } from "@/lib/download";
import { editedCount, isEdited, parseOptionSettings, settingsToIni } from "@/lib/ini";
import {
  encodeLevelMetaSav,
  encodeWorldOptionSav,
  iniPath,
  inspectSav,
  levelMetaPath,
  levelSavPath,
  parseWorldSnapshot,
  snapshotToJson,
  worldOptionPath,
} from "@/lib/sav";
import { buildWorldFilePack } from "@/lib/world-pack";
import { useAppStore } from "@/lib/store";
import { restoreSavedZip } from "@/lib/runtime";
import type { SaveGuild, SavePlayer, WorldSnapshot } from "@/lib/types";
import { cn, formatStamp, nid, timeAgo } from "@/lib/utils";

type Tab = "list" | "ini" | "sav";

export const Route = createFileRoute("/_app/worlds")({
  validateSearch: (s: Record<string, unknown>): { tab: Tab } => ({
    tab: s.tab === "ini" || s.tab === "sav" ? s.tab : "list",
  }),
  component: WorldsPage,
});

function WorldsPage() {
  const mode = useAppStore((s) => s.mode);
  const search = Route.useSearch();
  const nextTab: Tab = search.tab === "ini" || search.tab === "sav" ? search.tab : "list";
  const [tab, setTab] = useState<Tab>(nextTab);
  const [importOpen, setImportOpen] = useState(false);
  useEffect(() => {
    setTab(nextTab);
  }, [nextTab]);

  if (mode === "client") return <Navigate to="/" />;

  return (
    <div>
      <ImportServerDialog open={importOpen} onOpenChange={setImportOpen} />
      <PageHeader
        title="Worlds"
        description="Edit PalWorldSettings.ini and World.sav / WorldOption.sav together. Existing worlds ignore the INI until WorldOption.sav matches."
        actions={
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Import existing server
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {(
          [
            ["list", "Worlds"],
            ["ini", "PalWorldSettings.ini"],
            ["sav", "World.sav"],
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
      {tab === "list" ? <WorldList /> : null}
      {tab === "ini" ? <IniEditor onOpenSav={() => setTab("sav")} /> : null}
      {tab === "sav" ? <SavEditor onOpenIni={() => setTab("ini")} /> : null}
    </div>
  );
}

function useWorldPack() {
  const settings = useAppStore((s) => s.worldSettings);
  const worlds = useAppStore((s) => s.worlds);
  const worldSaves = useAppStore((s) => s.worldSaves);
  const paths = useAppStore((s) => s.paths);
  const createBackup = useAppStore((s) => s.createBackup);
  const active = worlds.find((w) => w.active) ?? worlds[0];
  const save = active ? worldSaves[active.id] : undefined;
  const override = save?.optionOverride ?? active?.optionOverride ?? false;

  async function pack() {
    if (!active) throw new Error("Create or import a world first.");
    return buildWorldFilePack({
      settings,
      world: active,
      optionOverride: override,
      players: save?.players ?? [],
      guilds: save?.guilds ?? [],
      serverRoot: paths.server,
    });
  }

  return { active, save, settings, paths, createBackup, override, pack };
}

function WorldFileBar() {
  const { active, pack, createBackup } = useWorldPack();
  const writeDenFiles = useAppStore((s) => s.writeDenFiles);
  const snapshotSaved = useAppStore((s) => s.snapshotSaved);
  const [busy, setBusy] = useState(false);

  async function run(kind: "zip" | "ini" | "option" | "meta") {
    if (!active) {
      toast.error("Create or import a world first.");
      return;
    }
    setBusy(true);
    try {
      createBackup("manual", `Before ${kind === "zip" ? "world file pack" : kind} export`);
      const built = await pack();
      if (kind === "zip") {
        const how = await saveBytes(built.zip, built.zipName, "application/zip");
        if (how !== "cancelled") toast.success(`Saved ${built.zipName}`);
        return;
      }
      const file = built.files.find((f) =>
        kind === "ini" ? f.name.endsWith(".ini") : kind === "option" ? f.name === "WorldOption.sav" : f.name === "LevelMeta.sav",
      );
      if (!file) return;
      const how =
        kind === "ini"
          ? await saveText(new TextDecoder().decode(file.data), file.name, "text/plain")
          : await saveBytes(file.data, file.name);
      if (how !== "cancelled") toast.success(`Saved ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build world files");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={!active}
        onClick={() => {
          writeDenFiles();
          toast.success("Wrote PalWorldSettings.ini, Engine.ini, WorldOption.sav, LevelMeta.sav, and launch args into the PalServer folder.");
        }}
      >
        Write to PalServer
      </Button>
      <Button
        variant="secondary"
        disabled={!active}
        onClick={() => {
          snapshotSaved();
          toast.success("Saved-folder zip queued. Palnest.exe copies Pal\\Saved; this preview keeps a journal snapshot.");
        }}
      >
        Zip Saved folder
      </Button>
      <Button disabled={busy || !active} variant="outline" onClick={() => void run("zip")}>
        {busy ? "Building…" : "Download INI + World.sav pack"}
      </Button>
      <Button variant="outline" disabled={busy || !active} onClick={() => void run("ini")}>
        PalWorldSettings.ini
      </Button>
      <Button variant="outline" disabled={busy || !active} onClick={() => void run("option")}>
        WorldOption.sav
      </Button>
      <Button variant="ghost" disabled={busy || !active} onClick={() => void run("meta")}>
        LevelMeta.sav
      </Button>
    </div>
  );
}

function WorldList() {
  const worlds = useAppStore((s) => s.worlds);
  const backups = useAppStore((s) => s.backups);
  const worldSaves = useAppStore((s) => s.worldSaves);
  const switchWorld = useAppStore((s) => s.switchWorld);
  const createBackup = useAppStore((s) => s.createBackup);
  const restoreBackup = useAppStore((s) => s.restoreBackup);
  const autoBackup = useAppStore((s) => s.autoBackup);
  const patchWorld = useAppStore((s) => s.patchWorld);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <WorldFileBar />
        <Button
          variant="outline"
          onClick={() => {
            createBackup("manual", "Manual snapshot");
            toast.success("World snapshot saved");
          }}
        >
          Snapshot active world
        </Button>
      </div>
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {worlds.map((w) => {
          const save = worldSaves[w.id];
          return (
            <article key={w.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium">{w.name}</h2>
                  <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{w.guid}</p>
                </div>
                {w.active ? <Badge variant="ok">Active</Badge> : <Badge variant="outline">Idle</Badge>}
              </div>
              <label className="mt-4 block text-xs text-muted-foreground">
                World name
                <Input
                  aria-label="World name"
                  value={w.name}
                  onChange={(e) => patchWorld(w.id, { name: e.target.value })}
                  className="mt-1"
                />
              </label>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Days</dt>
                  <dd>
                    <Input
                      type="number"
                      min={0}
                      className="mt-1 h-10 font-mono tabular-nums"
                      value={w.days}
                      onChange={(e) => patchWorld(w.id, { days: Number(e.target.value) || 0 })}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="mt-2 font-mono tabular-nums">{w.sizeMb} MB</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Guilds</dt>
                  <dd className="mt-2 font-mono tabular-nums">{save?.guilds.length ?? w.guilds}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {save?.optionOverride || w.optionOverride ? (
                  <Badge variant="warn">WorldOption.sav overrides INI</Badge>
                ) : (
                  <Badge variant="outline">INI applies</Badge>
                )}
                <p className="text-xs text-muted-foreground">Last played {timeAgo(w.lastPlayed)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {!w.active ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      switchWorld(w.id);
                      toast("Active world switched");
                    }}
                  >
                    Make active
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/worlds" search={{ tab: "ini" }}>
                    Edit INI
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/worlds" search={{ tab: "sav" }}>
                    Edit World.sav
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
        {worlds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No worlds yet. Import a server or start a new dedicated install.</p>
        ) : null}
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Backups</h2>
          <p className="text-xs text-muted-foreground">{autoBackup ? "Scheduled snapshots + last 7 kept" : "Auto off"}</p>
        </div>
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No snapshots yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {backups.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {b.label} <span className="text-muted-foreground">· {b.worldName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatStamp(b.createdAt)} · {b.sizeMb} MB · game {b.version} · {b.kind}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    restoreBackup(b.id);
                    if (b.zipPath) {
                      const st = useAppStore.getState();
                      void restoreSavedZip(b.zipPath, st.server, st.paths);
                    }
                    toast.success(b.zipPath ? "Restored Pal\\Saved from zip. Server stopped." : "World restored. Server stopped.");
                  }}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function IniEditor({ onOpenSav }: { onOpenSav: () => void }) {
  const settings = useAppStore((s) => s.worldSettings);
  const paths = useAppStore((s) => s.paths);
  const worlds = useAppStore((s) => s.worlds);
  const worldSaves = useAppStore((s) => s.worldSaves);
  const setWorldSetting = useAppStore((s) => s.setWorldSetting);
  const importIni = useAppStore((s) => s.importIni);
  const resetWorldSettings = useAppStore((s) => s.resetWorldSettings);
  const applySavImport = useAppStore((s) => s.applySavImport);
  const [query, setQuery] = useState("");
  const [paste, setPaste] = useState("");
  const [mode, setMode] = useState<"form" | "source">("form");
  const [source, setSource] = useState("");
  const [sourceDirty, setSourceDirty] = useState(false);
  const active = worlds.find((w) => w.active);
  const save = active ? worldSaves[active.id] : undefined;
  const edited = editedCount(settings);
  const preview = useMemo(() => settingsToIni(settings), [settings]);

  useEffect(() => {
    if (!sourceDirty) setSource(preview);
  }, [preview, sourceDirty]);

  async function onUpload(file: File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".sav")) {
      if (!active) {
        toast.error("Create or import a world first.");
        return;
      }
      const bytes = await readFileBytes(file);
      const report = await inspectSav(bytes, file.name);
      const n = applySavImport(active.id, {
        fileName: file.name,
        size: file.size,
        settings: report.settings,
        kind: report.kind,
        note: report.note,
        meta: report.meta,
      });
      toast.success(`Read ${file.name}${n ? ` · ${n} keys` : ""}`);
      return;
    }
    const text = await readFileText(file);
    const n = importIni(text);
    setSourceDirty(false);
    toast.success(`Imported ${n} keys from ${file.name}`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">PalWorldSettings.ini</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{iniPath(paths.server)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{edited} edited</Badge>
            <div className="flex rounded-md bg-muted p-1">
              {(["form", "source"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={cn(
                    "h-8 rounded-sm px-2.5 text-xs font-medium",
                    mode === id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {id === "form" ? "Fields" : "Source"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {save?.optionOverride || active?.optionOverride ? (
          <div className="mb-4 rounded-md border border-border bg-background p-3 text-sm">
            <p className="font-medium">This world has WorldOption.sav</p>
            <p className="mt-1 text-muted-foreground">
              Dedicated will ignore most gameplay keys in the INI. Download WorldOption.sav from the pack, or delete that
              file on the box so the INI applies.
            </p>
            <Button className="mt-3" size="sm" variant="outline" onClick={onOpenSav}>
              Open World.sav editor
            </Button>
          </div>
        ) : null}
        {mode === "form" ? (
          <>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search keys, labels, groups"
              className="mb-4"
            />
            <SettingsFields settings={settings} onChange={setWorldSetting} query={query} />
          </>
        ) : (
          <div>
            <Label htmlFor="ini-source">INI source</Label>
            <Textarea
              id="ini-source"
              className="mt-2 min-h-80 font-mono text-xs"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setSourceDirty(true);
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  const n = importIni(source);
                  setSourceDirty(false);
                  toast.success(`Applied ${n} keys`);
                }}
              >
                Apply source
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSource(preview);
                  setSourceDirty(false);
                }}
              >
                Revert
              </Button>
            </div>
          </div>
        )}
      </section>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Write both files</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Stop PalServer first. The pack is PalWorldSettings.ini, WorldOption.sav, and LevelMeta.sav.
          </p>
          <WorldFileBar />
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Import</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Drop PalWorldSettings.ini or WorldOption.sav, or paste OptionSettings.
          </p>
          <FileDrop
            accept=".ini,.sav,text/plain"
            label="Drop PalWorldSettings.ini or World.sav"
            hint="Also accepts WorldOption.sav"
            onFile={(f) => void onUpload(f)}
          />
          <div className="mt-3 grid gap-2">
            <Label htmlFor="ini-paste">Paste</Label>
            <Textarea
              id="ini-paste"
              className="min-h-24 font-mono text-xs"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="OptionSettings=(ServerName=...)"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!paste.trim()) return;
                const n = importIni(paste);
                setSourceDirty(false);
                toast.success(`Read ${n} keys`);
              }}
            >
              Import paste
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(preview);
                toast.success("Copied PalWorldSettings.ini");
              }}
            >
              Copy
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                resetWorldSettings();
                setSourceDirty(false);
                toast("Restored vanilla defaults");
              }}
            >
              Reset vanilla
            </Button>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Live INI</h2>
          <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-background p-3 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {preview}
          </pre>
        </section>
      </aside>
    </div>
  );
}

function SavEditor({ onOpenIni }: { onOpenIni: () => void }) {
  const settings = useAppStore((s) => s.worldSettings);
  const paths = useAppStore((s) => s.paths);
  const worlds = useAppStore((s) => s.worlds);
  const worldSaves = useAppStore((s) => s.worldSaves);
  const applySavImport = useAppStore((s) => s.applySavImport);
  const ensureWorldSave = useAppStore((s) => s.ensureWorldSave);
  const setOptionOverride = useAppStore((s) => s.setOptionOverride);
  const upsertSavePlayer = useAppStore((s) => s.upsertSavePlayer);
  const removeSavePlayer = useAppStore((s) => s.removeSavePlayer);
  const upsertSaveGuild = useAppStore((s) => s.upsertSaveGuild);
  const removeSaveGuild = useAppStore((s) => s.removeSaveGuild);
  const assignPlayerToGuild = useAppStore((s) => s.assignPlayerToGuild);
  const patchWorld = useAppStore((s) => s.patchWorld);
  const createBackup = useAppStore((s) => s.createBackup);
  const setWorldSetting = useAppStore((s) => s.setWorldSetting);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [savQuery, setSavQuery] = useState("");

  const active = worlds.find((w) => w.active) ?? worlds[0];
  useEffect(() => {
    if (active) ensureWorldSave(active.id);
  }, [active, ensureWorldSave]);
  const save = active ? worldSaves[active.id] : undefined;
  const override = save?.optionOverride ?? active?.optionOverride ?? false;
  const host = save?.players?.[0];

  async function onUpload(file: File) {
    if (!active) {
      toast.error("Create or import a world first.");
      return;
    }
    setBusy(true);
    try {
      if (file.name.toLowerCase().endsWith(".ini")) {
        const text = await readFileText(file);
        const parsed = parseOptionSettings(text);
        const n = applySavImport(active.id, {
          fileName: file.name,
          size: file.size,
          settings: parsed,
          kind: "unknown",
          note: "Settings taken from PalWorldSettings.ini.",
        });
        setNote(`Imported ${n} keys from ${file.name}.`);
        toast.success(`Imported ${n} keys`);
        return;
      }
      if (file.name.toLowerCase().endsWith(".json")) {
        const text = await readFileText(file);
        const snap = parseWorldSnapshot(text);
        if (!snap) {
          toast.error("Not a Palnest world snapshot");
          return;
        }
        applySavImport(active.id, {
          fileName: file.name,
          size: file.size,
          settings: snap.settings,
          snapshot: snap,
          kind: "snapshot",
          note: "Players, guilds, and settings loaded from a Palnest snapshot.",
        });
        setNote(`Loaded snapshot ${file.name}.`);
        toast.success("World snapshot loaded");
        return;
      }
      const bytes = await readFileBytes(file);
      const report = await inspectSav(bytes, file.name);
      const n = applySavImport(active.id, {
        fileName: file.name,
        size: file.size,
        settings: report.settings,
        kind: report.kind,
        note: report.note,
        meta: report.meta,
      });
      if (report.meta?.worldName) {
        setNote(`${report.note} World name “${report.meta.worldName}”.`);
      } else {
        setNote(report.note + (n ? ` ${n} option keys applied.` : ""));
      }
      toast.success(`Read ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that save");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadFiles(files: File[]) {
    const order = [...files].sort((a, b) => {
      const rank = (n: string) => (n.endsWith(".ini") ? 0 : n.endsWith(".json") ? 1 : n.toLowerCase().includes("meta") ? 2 : 3);
      return rank(a.name.toLowerCase()) - rank(b.name.toLowerCase());
    });
    for (const file of order) await onUpload(file);
  }

  async function downloadOptionSav() {
    if (!active) return;
    createBackup("manual", "Before WorldOption.sav export");
    const bytes = await encodeWorldOptionSav(settings);
    downloadBytes(bytes, "WorldOption.sav");
    setOptionOverride(active.id, true);
    toast.success("Downloaded WorldOption.sav");
  }

  async function downloadMetaSav() {
    if (!active) return;
    createBackup("manual", "Before LevelMeta.sav export");
    const bytes = await encodeLevelMetaSav({
      worldName: active.name,
      hostPlayerName: host?.name ?? "",
      hostPlayerLevel: host?.level ?? 1,
      inGameDay: active.days,
    });
    downloadBytes(bytes, "LevelMeta.sav");
    toast.success("Downloaded LevelMeta.sav");
  }

  function downloadSnapshot() {
    if (!active) return;
    const snap: WorldSnapshot = {
      palnest: 1,
      kind: "world-snapshot",
      world: {
        id: active.id,
        name: active.name,
        guid: active.guid,
        days: active.days,
        sizeMb: active.sizeMb,
      },
      optionOverride: override,
      settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
      players: save?.players ?? [],
      guilds: save?.guilds ?? [],
    };
    downloadText(snapshotToJson(snap), "World.sav.json", "application/json");
    toast.success("Downloaded World.sav.json");
  }

  if (!active) {
    return <p className="text-sm text-muted-foreground">Create or import a world first.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">World.sav / WorldOption.sav</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Dedicated stores the map in Level.sav. World settings that stick live in WorldOption.sav next to it — that is
          the file people mean when they say edit World.sav. Drop PalWorldSettings.ini, WorldOption.sav, or LevelMeta.sav.
        </p>
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Palworld 1.0 Level.sav is often PlM (Oodle). Palnest detects that header so it will not corrupt the map, and still
          edits WorldOption.sav, LevelMeta.sav, players, and guilds. A full pal / inventory / base decode needs Pocketpair's Oodle lib.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Level.sav</dt>
            <dd className="font-mono text-xs break-all">{levelSavPath(paths.server, active.guid)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">WorldOption.sav</dt>
            <dd className="font-mono text-xs break-all">{worldOptionPath(paths.server, active.guid)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">LevelMeta.sav</dt>
            <dd className="font-mono text-xs break-all">{levelMetaPath(paths.server, active.guid)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">PalWorldSettings.ini</dt>
            <dd className="font-mono text-xs break-all">{iniPath(paths.server)}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <FileDrop
            accept=".sav,.json,.ini"
            multiple
            label={busy ? "Reading…" : "Drop PalWorldSettings.ini, World.sav, WorldOption.sav, LevelMeta.sav"}
            hint="Multiple files at once. Also accepts Palnest World.sav.json"
            onFiles={(files) => void onUploadFiles(files)}
          />
        </div>
        {note || save?.imported ? (
          <p className="mt-3 text-sm text-muted-foreground">{note || save?.imported?.note}</p>
        ) : null}
        {save?.imported ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Last file {save.imported.name} · {save.imported.kind} · {formatStamp(save.imported.at)}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Write PalWorldSettings.ini + World.sav</h2>
        <p className="mt-1 mb-3 max-w-2xl text-sm text-muted-foreground">
          Pack includes PalWorldSettings.ini, WorldOption.sav (world settings), and LevelMeta.sav (name and day). Put the
          INI in Config, the two .sav files in the world folder. Do not replace Level.sav with these.
        </p>
        <WorldFileBar />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">WorldOption overlay</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              When this is on, dedicated reads WorldOption.sav and ignores most PalWorldSettings.ini keys — including
              BaseCampWorkerMaxNum.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{override ? "Present" : "Absent"}</span>
            <Switch checked={override} onCheckedChange={(v) => setOptionOverride(active.id, v)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void downloadOptionSav()}>Download WorldOption.sav</Button>
          <Button variant="outline" onClick={() => void downloadMetaSav()}>
            Download LevelMeta.sav
          </Button>
          <Button variant="outline" onClick={downloadSnapshot}>
            Download World.sav.json
          </Button>
          <Button variant="ghost" onClick={onOpenIni}>
            Edit INI keys
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">LevelMeta.sav</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          World name and in-game day written into LevelMeta.sav. Host name and level come from the first player in the
          snapshot.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">
            World name
            <Input
              className="mt-1"
              value={active.name}
              onChange={(e) => patchWorld(active.id, { name: e.target.value })}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            In-game day
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={active.days}
              onChange={(e) => patchWorld(active.id, { days: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Host player
            <Input className="mt-1" value={host ? `${host.name} · lv ${host.level}` : "—"} readOnly />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium">WorldOption settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Same keys as PalWorldSettings.ini. Written into WorldOption.sav when you download the pack.
            </p>
          </div>
          <Badge variant="outline">{editedCount(settings)} edited</Badge>
        </div>
        <Input
          className="mb-4"
          value={savQuery}
          onChange={(e) => setSavQuery(e.target.value)}
          placeholder="Search to edit any WorldOption key"
        />
        {savQuery.trim() || settings.some((s) => isEdited(s)) ? (
          <SettingsFields
            settings={savQuery.trim() ? settings : settings.filter((s) => isEdited(s))}
            onChange={setWorldSetting}
            query={savQuery}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No keys differ from vanilla. Search to change a WorldOption value.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-medium">Players in {active.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit the world snapshot. Removing someone drops them from this world file, not the live server list.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              upsertSavePlayer(active.id, {
                id: nid("p"),
                name: "New player",
                uid: nid("uid"),
                steamId: "",
                level: 1,
                exp: 0,
                guild: "",
                pals: 0,
                lastSeen: new Date().toISOString(),
                online: false,
              })
            }
          >
            Add player
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Level</th>
                <th className="pb-2 font-medium">Pals</th>
                <th className="pb-2 font-medium">Guild</th>
                <th className="pb-2 font-medium">Steam ID</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(save?.players ?? []).map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  onChange={(next) => upsertSavePlayer(active.id, next)}
                  onRemove={() => removeSavePlayer(active.id, p.id)}
                />
              ))}
            </tbody>
          </table>
          {(save?.players ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No players in this snapshot yet.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-medium">Guilds</h2>
            <p className="mt-1 text-sm text-muted-foreground">Rename, retarget the owner, or dissolve an empty guild.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const guild: SaveGuild = { id: nid("g"), name: "New guild", owner: "", members: 0, bases: 0 };
              upsertSaveGuild(active.id, guild);
              patchWorld(active.id, { guilds: (save?.guilds.length ?? 0) + 1 });
            }}
          >
            Add guild
          </Button>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {(save?.guilds ?? []).map((g) => (
            <li key={g.id} className="rounded-md border border-border bg-background p-3">
              <Input value={g.name} onChange={(e) => upsertSaveGuild(active.id, { ...g, name: e.target.value })} />
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs text-muted-foreground">
                  Owner
                  <Input
                    className="mt-1"
                    value={g.owner}
                    onChange={(e) => upsertSaveGuild(active.id, { ...g, owner: e.target.value })}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Members
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    value={g.members}
                    onChange={(e) => upsertSaveGuild(active.id, { ...g, members: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Bases
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    value={g.bases}
                    onChange={(e) => upsertSaveGuild(active.id, { ...g, bases: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(save?.players ?? [])
                  .filter((p) => p.guild !== g.name)
                  .map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        assignPlayerToGuild(active.id, p.id, g.name);
                        toast.success(`${p.name} joined ${g.name}`);
                      }}
                    >
                      Add {p.name}
                    </Button>
                  ))}
                <Button className="ml-auto" size="sm" variant="ghost" onClick={() => removeSaveGuild(active.id, g.id)}>
                  Dissolve
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {(save?.guilds ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No guilds in this world.</p>
        ) : null}
      </section>
    </div>
  );
}

function PlayerRow({
  player,
  onChange,
  onRemove,
}: {
  player: SavePlayer;
  onChange: (p: SavePlayer) => void;
  onRemove: () => void;
}) {
  return (
    <tr>
      <td className="py-2 pr-2">
        <Input value={player.name} onChange={(e) => onChange({ ...player, name: e.target.value })} />
      </td>
      <td className="py-2 pr-2">
        <Input
          type="number"
          min={1}
          max={60}
          className="w-20"
          value={player.level}
          onChange={(e) => onChange({ ...player, level: Number(e.target.value) || 1 })}
        />
      </td>
      <td className="py-2 pr-2">
        <Input
          type="number"
          min={0}
          className="w-20"
          value={player.pals}
          onChange={(e) => onChange({ ...player, pals: Number(e.target.value) || 0 })}
        />
      </td>
      <td className="py-2 pr-2">
        <Input value={player.guild} onChange={(e) => onChange({ ...player, guild: e.target.value })} />
      </td>
      <td className="py-2 pr-2">
        <Input
          className="font-mono text-xs"
          value={player.steamId}
          onChange={(e) => onChange({ ...player, steamId: e.target.value })}
        />
      </td>
      <td className="py-2">
        <Button size="sm" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      </td>
    </tr>
  );
}
