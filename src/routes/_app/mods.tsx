import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { kindLabel, sourceLabel } from "@/lib/paths";
import { findConflicts, guessZipKind, modExtractDest } from "@/lib/ops";
import { guessKindFromListing, zipEntryNames } from "@/lib/mod-kind";
import { extractModZip, steamcmdWorkshop } from "@/lib/runtime";
import type { ScanFile, ScanResult } from "@/lib/scan";
import type { InstallTarget, ModKind } from "@/lib/types";
import { cn } from "@/lib/utils";

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
                try {
                  if (file.size < 8_000_000) {
                    const buf = new Uint8Array(await file.arrayBuffer());
                    const listing = zipEntryNames(buf);
                    if (listing.length) kind = guessKindFromListing(listing, file.name);
                  }
                } catch {
                  /* filename fallback */
                }
                const dest = destRoot ? modExtractDest(destRoot, kind) : "";
                if (diskPath && dest) void extractModZip(diskPath, dest);
                log({
                  level: "ok",
                  source: "mods",
                  message: `Extracted ${file.name} as ${kind} into ${dest || "the matching mod folder"}.`,
                });
                toast.success(`Queued ${file.name} as ${kind}`);
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
      </div>

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
              <li key={m.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
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
                  {mode === "both" ? (
                    <select
                      className="h-9 rounded-sm border border-border bg-background px-2 text-sm"
                      value={m.target}
                      onChange={(e) => setModTarget(m.id, e.target.value as InstallTarget)}
                      aria-label={`Install target for ${m.name}`}
                    >
                      <option value="client">Client</option>
                      <option value="server">Server</option>
                      <option value="both">Both</option>
                    </select>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Switch checked={m.enabled} onCheckedChange={() => toggleMod(m.id)} aria-label={`Enable ${m.name}`} />
                    {m.version !== m.latestVersion ? (
                      <Button size="sm" variant="outline" onClick={() => { updateMod(m.id); toast.success(`Updated ${m.name}`); }}>
                        Update
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        uninstallMod(m.id);
                        toast("Removed " + m.name);
                      }}
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
