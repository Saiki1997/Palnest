import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Link2, Play } from "lucide-react";
import { toast } from "sonner";
import { FolderScan, toastScanResult } from "@/components/folder-scan";
import { FileDrop } from "@/components/file-drop";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store";
import { mergeFx, parsePastedIni } from "@/lib/fx";
import { kindLabel, sourceLabel } from "@/lib/paths";
import { findConflicts, guessZipKind, modExtractDest } from "@/lib/ops";
import { guessKindFromListing, zipEntryNames } from "@/lib/mod-kind";
import { extractModZip, launchPalworld, steamcmdWorkshop } from "@/lib/runtime";
import type { ScanFile, ScanResult } from "@/lib/scan";
import type { InstallTarget, InstalledMod, ModKind } from "@/lib/types";
import { cn, formatStamp } from "@/lib/utils";

export const Route = createFileRoute("/_app/mods")({ component: ModsPage });

const KINDS: { id: "all" | ModKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ue4ss", label: "UE4SS" },
  { id: "palschema", label: "PalSchema" },
  { id: "pak", label: "PAK" },
  { id: "ini", label: "INI" },
];

function ModsPage() {
  const mods = useAppStore((s) => s.mods);
  const mode = useAppStore((s) => s.mode);
  const toggleMod = useAppStore((s) => s.toggleMod);
  const uninstallMod = useAppStore((s) => s.uninstallMod);
  const updateMod = useAppStore((s) => s.updateMod);
  const updateAllMods = useAppStore((s) => s.updateAllMods);
  const moveMod = useAppStore((s) => s.moveMod);
  const setModTarget = useAppStore((s) => s.setModTarget);
  const profiles = useAppStore((s) => s.profiles);
  const saveProfile = useAppStore((s) => s.saveProfile);
  const applyProfileById = useAppStore((s) => s.applyProfileById);
  const removeProfile = useAppStore((s) => s.removeProfile);
  const paths = useAppStore((s) => s.paths);
  const log = useAppStore((s) => s.log);
  const [kind, setKind] = useState<"all" | ModKind>("all");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<"all" | InstallTarget>("all");
  const [profileName, setProfileName] = useState("");
  const [workshopId, setWorkshopId] = useState("");
  const [pageTab, setPageTab] = useState<"installed" | "history">("installed");
  const [view, setView] = useState<"list" | "grid" | "compact">("list");
  const [pendingUninstall, setPendingUninstall] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ name: string; files: string[]; target: InstallTarget; kind?: ModKind } | null>(null);
  const [iniImport, setIniImport] = useState("");
  const fx = mergeFx(useAppStore((s) => s.fx));
  const identifyFile = useAppStore((s) => s.identifyFile);
  const dismissUnidentified = useAppStore((s) => s.dismissUnidentified);
  const addEngineBlock = useAppStore((s) => s.addEngineBlock);
  const installHit = useAppStore((s) => s.installHit);
  const server = useAppStore((s) => s.server);
  const ops = useAppStore((s) => s.ops);
  const frameworks = useAppStore((s) => s.frameworks);

  const filtered = useMemo(() => {
    return [...mods]
      .sort((a, b) => a.loadOrder - b.loadOrder)
      .filter((m) => (kind === "all" ? true : m.kind === kind))
      .filter((m) => (target === "all" ? true : m.target === target || m.target === "both"))
      .filter((m) => {
        if (!q.trim()) return true;
        const s = q.toLowerCase();
        return m.name.toLowerCase().includes(s) || m.author.toLowerCase().includes(s);
      });
  }, [mods, kind, q, target]);

  const stale = mods.filter((m) => m.version !== m.latestVersion).length;
  const conflicts = findConflicts(mods);

  return (
    <div>
      <PageHeader
        title="Mods"
        description="UE4SS scripts, PalSchema packs, and PAK files live in their own folders. Enable, order, and assign each to client, server, or both."
        actions={
          <>
            <ScanInstallButton />
            <Button variant="outline" asChild>
              <Link to="/discover">Add from stores</Link>
            </Button>
            <Button
              variant="secondary"
              disabled={!stale}
              onClick={() => {
                const n = updateAllMods();
                toast.success(n ? `Updated ${n} mods` : "Already current");
              }}
            >
              Update outdated{stale ? ` (${stale})` : ""}
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1 rounded-md bg-muted p-1">
        <button
          type="button"
          onClick={() => setPageTab("installed")}
          className={cn("h-9 rounded-sm px-3 text-sm font-medium", pageTab === "installed" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          Installed
        </button>
        <Link
          to="/discover"
          className="inline-flex h-9 items-center rounded-sm px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Discover
        </Link>
        <button
          type="button"
          onClick={() => setPageTab("history")}
          className={cn("h-9 rounded-sm px-3 text-sm font-medium", pageTab === "history" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          History
        </button>
      </div>

      {pageTab === "history" ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-medium">Install history</h2>
          {fx.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing installed yet this session.</p>
          ) : (
            <ul className="divide-y divide-border">
              {fx.history.map((h) => (
                <li key={h.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {h.name} <Badge variant="outline">{h.action}</Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">{h.detail}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatStamp(h.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {pageTab === "installed" ? (
        <>
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              void launchPalworld(paths.client, server, ops?.linuxHost);
              toast.message("Launching Palworld");
            }}
          >
            <Play className="size-4" />
            Launch Palworld
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPlan({ name: "Dropped zip", files: ["enabled.txt", "Scripts/main.lua", "README.md"], target: mode === "server" ? "server" : "client", kind: "ue4ss" })}>
            Install from file
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!stale}
            onClick={() => {
              const n = updateAllMods();
              toast.success(n ? `Updated ${n} mods` : "Already current");
            }}
          >
            Check for updates{stale ? ` (${stale})` : ""}
          </Button>
          <select
            className="h-9 rounded-sm border border-border bg-background px-2 text-sm"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const err = applyProfileById(id);
              if (err) toast.error(err);
              else toast.success("Loadout applied");
              e.currentTarget.value = "";
            }}
            aria-label="Profiles"
          >
            <option value="">Profiles</option>
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {frameworks.ue4ss.clientVersion || frameworks.ue4ss.serverVersion
            ? `UE4SS ${frameworks.ue4ss.clientVersion || frameworks.ue4ss.serverVersion}`
            : "UE4SS not installed"}
          {" · "}
          {frameworks.palschema.clientVersion || frameworks.palschema.serverVersion
            ? "Pal Schema is installed"
            : "Pal Schema off"}
          {" · "}
          {stale ? `${stale} updates` : "Up to date"}
        </p>
      </div>
      {fx.unidentified.filter((u) => !u.dismissed).length ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-card px-4 py-3">
          <p className="text-sm">
            {fx.unidentified.filter((u) => !u.dismissed).length} new file in UE4SS Mods — identify?
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                fx.unidentified.filter((u) => !u.dismissed).forEach((u) => identifyFile(u.id));
                toast.success("Identified as local drops");
              }}
            >
              Identify
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fx.unidentified.forEach((u) => dismissUnidentified(u.id))}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Loadouts</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">Save enabled mods as PvE, creative, or event and swap without reinstalling.</p>
          <div className="mb-3 flex gap-2">
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="PvE" />
            <Button
              onClick={() => {
                saveProfile(profileName.trim() || "Loadout");
                setProfileName("");
                toast.success("Loadout saved");
              }}
            >
              Save
            </Button>
          </div>
          <ul className="space-y-2">
            {(profiles ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-muted-foreground">{p.enabledIds.length} on</span>
                </span>
                <span className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const err = applyProfileById(p.id);
                      if (err) toast.error(err);
                      else toast.success(`Applied ${p.name}`);
                    }}
                  >
                    Apply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeProfile(p.id)}>
                    Remove
                  </Button>
                </span>
              </li>
            ))}
            {(profiles ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No loadouts yet.</p> : null}
          </ul>
        </article>
        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Conflict map</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">Same PAK name, overlapping PalSchema rows, or a broken pack left on.</p>
          {conflicts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live conflicts.</p>
          ) : (
            <ul className="space-y-2">
              {conflicts.map((c) => (
                <li key={c.id} className="text-sm">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-muted-foreground">{c.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Install a zip</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">
            Nexus / CurseForge / GitHub archives extract into UE4SS Mods, PalSchema, or Paks/~mods on Palnest.exe.
          </p>
          <FileDrop
            accept=".zip"
            label="Drop a mod zip"
            hint="Palnest.exe writes the folder. This preview queues it in the world."
            onFile={(file) => {
              const destRoot = paths.server || paths.client;
              const diskPath = (file as File & { path?: string }).path;
              void (async () => {
                let kind = guessZipKind(file.name);
                let files = [file.name];
                try {
                  if (file.size < 8_000_000) {
                    const buf = new Uint8Array(await file.arrayBuffer());
                    const listing = zipEntryNames(buf);
                    if (listing.length) {
                      kind = guessKindFromListing(listing, file.name);
                      files = listing.slice(0, 24);
                    }
                  }
                } catch {
                  /* filename fallback */
                }
                const dest = destRoot ? modExtractDest(destRoot, kind) : "";
                if (diskPath && dest) void extractModZip(diskPath, dest);
                setPlan({
                  name: file.name.replace(/\.zip$/i, ""),
                  files,
                  target: mode === "server" ? "server" : mode === "client" ? "client" : "both",
                  kind,
                });
              })();
            }}
          />
        </article>
        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Steam Workshop</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">steamcmd +workshop_download_item 1623730. Needs a PalServer folder.</p>
          <div className="flex gap-2">
            <Input value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} placeholder="Workshop item id" />
            <Button
              onClick={() => {
                const id = workshopId.trim();
                if (!id) {
                  toast.error("Workshop id required");
                  return;
                }
                const dest = paths.server || paths.client;
                void steamcmdWorkshop(dest || "C:\\PalServers\\PalServer", id);
                log({ level: "ok", source: "steamcmd", message: `Pulled Workshop ${id} into ${dest || "PalServer"}.` });
                toast.success(`Workshop ${id} queued`);
                setWorkshopId("");
              }}
            >
              Pull
            </Button>
          </div>
        </article>
      </section>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={cn(
                "h-9 rounded-sm px-3 text-sm font-medium",
                kind === k.id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        {mode === "both" ? (
          <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
            {(["all", "client", "server", "both"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTarget(t)}
                className={cn(
                  "h-9 rounded-sm px-3 text-sm font-medium capitalize",
                  target === t ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name"
          className="lg:ml-auto lg:max-w-xs"
        />
        <div className="flex gap-1 rounded-md bg-muted p-1">
          {(["list", "grid", "compact"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn("h-9 rounded-sm px-3 text-sm capitalize", view === v ? "bg-card text-foreground" : "text-muted-foreground")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">Add to Engine.ini</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to your Engine.ini</DialogTitle>
              <DialogDescription>Paste a labelled block. Palnest can reorder or remove it later from Engine tweaks.</DialogDescription>
            </DialogHeader>
            <textarea
              className="min-h-32 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
              value={iniImport}
              onChange={(e) => setIniImport(e.target.value)}
              placeholder="; Ultimate Engine Tweaks"
            />
            <Button
              onClick={() => {
                const parsed = parsePastedIni(iniImport);
                if (!parsed.lines.trim()) {
                  toast.error("Paste INI first");
                  return;
                }
                addEngineBlock({ name: parsed.name, target: "client", lines: parsed.lines, enabled: true });
                setIniImport("");
                toast.success("Queued for Engine.ini — Save on Engine tweaks");
              }}
            >
              Apply to Engine.ini
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {filtered.map((m) => (
            <article key={m.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <img src={m.image || "/palworld-cover.jpg"} alt="" className="aspect-[16/10] w-full object-cover" />
              <div className="p-3">
                <p className="line-clamp-2 font-medium">{m.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.version} · {kindLabel(m.kind)} · {m.target}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <ModSideSwitches mod={m} mode={mode} setModTarget={setModTarget} toggleMod={toggleMod} />
                  <Button size="sm" variant="ghost" onClick={() => setPendingUninstall(m.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium">No mods in this shelf</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse a Palworld or PalServer folder to detect mods already installed, or pull from Nexus, Steam, or
              CurseForge.
            </p>
            <div className="mt-4 flex justify-center">
              <ScanInstallButton />
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((m, i) => (
              <li key={m.id} className={cn("flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center", view === "compact" && "py-2")}>
                <div className="hidden flex-col sm:flex">
                  <Button variant="ghost" size="icon-sm" aria-label="Move up" onClick={() => moveMod(m.id, -1)} disabled={i === 0}>
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move down"
                    onClick={() => moveMod(m.id, 1)}
                    disabled={i === filtered.length - 1}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{m.name}</p>
                    <Badge variant="outline">{kindLabel(m.kind)}</Badge>
                    <Badge variant="default">{sourceLabel(m.source)}</Badge>
                    {m.broken ? <Badge variant="danger">Broken</Badge> : null}
                    {m.version !== m.latestVersion ? <Badge variant="warn">Update</Badge> : null}
                    {!m.serverCompatible ? <Badge variant="outline">Client</Badge> : null}
                    {!m.clientCompatible ? <Badge variant="outline">Server</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{m.installPath}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                  <p className="font-mono text-xs text-muted-foreground">
                    {m.version}
                    {m.version !== m.latestVersion ? ` → ${m.latestVersion}` : ""}
                  </p>
                  <ModSideSwitches mod={m} mode={mode} setModTarget={setModTarget} toggleMod={toggleMod} />
                  <div className="flex items-center gap-2">
                    {m.version !== m.latestVersion ? (
                      <Button size="sm" variant="outline" onClick={() => { updateMod(m.id); toast.success(`Updated ${m.name}`); }}>
                        Update
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPendingUninstall(m.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

      <Dialog open={Boolean(pendingUninstall)} onOpenChange={(v) => !v && setPendingUninstall(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uninstall {mods.find((m) => m.id === pendingUninstall)?.name}?</DialogTitle>
            <DialogDescription>
              One confirmation covers the whole set: tracked files they installed are deleted, then empty folders are cleaned up.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const mod = mods.find((m) => m.id === pendingUninstall);
            if (!mod) return null;
            return (
              <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm">
                {mod.name} — {mod.fileCount} files — {mod.installPath}
              </div>
            );
          })()}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingUninstall(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!pendingUninstall) return;
                const name = mods.find((m) => m.id === pendingUninstall)?.name;
                uninstallMod(pendingUninstall);
                toast.message(`Removed ${name}`);
                setPendingUninstall(null);
              }}
            >
              Uninstall mod
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(plan)} onOpenChange={(v) => !v && setPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install plan</DialogTitle>
            <DialogDescription>Nothing touches disk until you click Install.</DialogDescription>
          </DialogHeader>
          {plan ? (
            <div className="grid gap-3">
              <p className="text-sm font-medium">Installing {plan.name}: {plan.files.length} files.</p>
              <div className="flex flex-wrap gap-2">
                {(["client", "server", "both"] as InstallTarget[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPlan({ ...plan, target: t })}
                    className={cn("h-9 rounded-sm border px-3 text-sm capitalize", plan.target === t ? "border-primary" : "border-border")}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <ul className="rounded-md border border-border bg-background p-3 font-mono text-xs">
                {plan.files.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPlan(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    const kind = plan.kind ?? guessZipKind(plan.name);
                    installHit(
                      {
                        id: `local-${plan.name}`,
                        name: plan.name.replace(/\.zip$/i, ""),
                        author: "Local",
                        version: "1.0",
                        source: "local",
                        sourceId: plan.name,
                        url: "",
                        downloads: 0,
                        description: `Installed from ${plan.name}`,
                        kind,
                        updatedAt: new Date().toISOString(),
                        serverCompatible: true,
                        gameVersions: [],
                        requires: [],
                      },
                      plan.target,
                    );
                    log({ level: "ok", source: "mods", message: `Install plan applied for ${plan.name} → ${plan.target}.` });
                    toast.success(`Installed ${plan.name} on ${plan.target}`);
                    setPlan(null);
                  }}
                >
                  Install
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
        </>
      ) : null}
    </div>
  );
}

function ModSideSwitches({
  mod,
  mode,
  setModTarget,
  toggleMod,
}: {
  mod: InstalledMod;
  mode: "client" | "server" | "both";
  setModTarget: (id: string, target: InstallTarget) => void;
  toggleMod: (id: string) => void;
}) {
  const showClient = mode !== "server";
  const showServer = mode !== "client";
  const clientOn = mod.enabled && (mod.target === "client" || mod.target === "both");
  const serverOn = mod.enabled && (mod.target === "server" || mod.target === "both");

  function apply(side: "client" | "server", on: boolean) {
    const nextClient = side === "client" ? on : clientOn;
    const nextServer = side === "server" ? on : serverOn;
    if (nextClient && nextServer) {
      setModTarget(mod.id, "both");
      if (!mod.enabled) toggleMod(mod.id);
    } else if (nextClient) {
      setModTarget(mod.id, "client");
      if (!mod.enabled) toggleMod(mod.id);
    } else if (nextServer) {
      setModTarget(mod.id, "server");
      if (!mod.enabled) toggleMod(mod.id);
    } else if (mod.enabled) {
      toggleMod(mod.id);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {showClient ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Client
          <Switch checked={clientOn} onCheckedChange={(v) => apply("client", v)} aria-label={`${mod.name} on client`} />
        </label>
      ) : null}
      {showClient && showServer ? (
        <Link2 className={cn("size-3.5", clientOn && serverOn ? "text-primary" : "text-muted-foreground/40")} />
      ) : null}
      {showServer ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Server
          <Switch checked={serverOn} onCheckedChange={(v) => apply("server", v)} aria-label={`${mod.name} on server`} />
        </label>
      ) : null}
    </div>
  );
}

function ScanInstallButton() {
  const mode = useAppStore((s) => s.mode);
  const paths = useAppStore((s) => s.paths);
  const setPaths = useAppStore((s) => s.setPaths);
  const ingestDetected = useAppStore((s) => s.ingestDetected);
  const defaultSide: "client" | "server" = mode === "server" ? "server" : "client";
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"client" | "server">(defaultSide);
  const [path, setPath] = useState(side === "client" ? paths.client : paths.server);
  const [listing, setListing] = useState<ScanFile[]>([]);
  const [preview, setPreview] = useState<ScanResult | null>(null);

  function pickSide(next: "client" | "server") {
    setSide(next);
    setPath(next === "client" ? paths.client : paths.server);
    setListing([]);
    setPreview(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const initial = mode === "server" ? "server" : "client";
          setSide(initial);
          setPath(initial === "client" ? paths.client : paths.server);
          setListing([]);
          setPreview(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Scan folder</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detect installed mods</DialogTitle>
          <DialogDescription>
            Browse a Palworld or PalServer folder. Palnest matches UE4SS scripts, PalSchema packs, and PAK files already
            on disk.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {mode === "both" ? (
            <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
              {(["client", "server"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickSide(t)}
                  className={cn(
                    "h-9 rounded-sm px-3 text-sm font-medium capitalize",
                    side === t ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}
          <FolderScan
            id="scan-install-path"
            label={side === "client" ? "Palworld game" : "Dedicated server"}
            value={path}
            onChange={(next) => {
              setPath(next);
              setListing([]);
              setPreview(null);
            }}
            placeholder={side === "client" ? "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Palworld" : "C:\\PalServers\\HollowIsle"}
            hint="Pick the folder that contains Pal, not a single file."
            result={preview}
            onScanned={(root, files, result) => {
              setPath(root);
              setListing(files);
              setPreview(result);
            }}
          />
          <Button
            disabled={!preview}
            onClick={() => {
              if (!preview) return;
              if (path.trim()) {
                setPaths(side === "client" ? { client: path.trim() } : { server: path.trim() });
              }
              const stats = ingestDetected(side, preview);
              toastScanResult(preview, stats);
              setOpen(false);
            }}
          >
            Add to world
          </Button>
          {!listing.length ? (
            <p className="text-xs text-muted-foreground">Browse first. Palnest cannot read a pasted Windows path from this browser.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
