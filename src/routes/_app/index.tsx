import { useEffect, useMemo, useState, lazy, Suspense, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowRight,
  Copy,
  CopyPlus,
  Download,
  HardDrive,
  Play,
  Plus,
  RotateCw,
  ScrollText,
  Shield,
  Square,
  Trash2,
  Users,
  Archive,
} from "lucide-react";
import { CreateDenDialog } from "@/components/create-den-dialog";
import { FirewallDialog } from "@/components/firewall-dialog";
import { ImportServerDialog } from "@/components/import-server-dialog";
import { PageHeader } from "@/components/page-header";
import { DenChecklist } from "@/components/setup-guide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMonitorView } from "@/components/world-pulse";
import { OPTIMIZE_PRESETS } from "@/lib/args";
import { CURRENT_GAME } from "@/lib/catalog";
import { runChecker } from "@/lib/checker";
import { isDesktopApp } from "@/lib/desktop";
import { fleetOf, runningCount } from "@/lib/fleet";
import { useLiveStats } from "@/lib/live-stats";
import { HOST_RAM_GB, ramFromPct, type MetricSample } from "@/lib/monitor";
import { steamcmdDedicated } from "@/lib/runtime";
import { fetchSteamDedicatedLatest, type DedicatedLatest } from "@/lib/steam-latest";
import { useAppStore } from "@/lib/store";
import { joinHost } from "@/lib/tunnels";
import type { ServerState } from "@/lib/types";
import { cn, formatUptime } from "@/lib/utils";

const CpuLoadChart = lazy(() => import("@/components/dash-charts").then((m) => ({ default: m.CpuLoadChart })));
const RamLoadChart = lazy(() => import("@/components/dash-charts").then((m) => ({ default: m.RamLoadChart })));

export const Route = createFileRoute("/_app/")({ component: HomePage });

const PROFILES = OPTIMIZE_PRESETS.filter((p) => !p.stackable).map((p) => ({
  id: p.id,
  label: p.id === "community" ? "Balanced" : p.name,
}));

function HomePage() {
  const mode = useAppStore((s) => s.mode);
  const server = useAppStore((s) => s.server);
  const instances = useAppStore((s) => s.instances);
  const mods = useAppStore((s) => s.mods);
  const frameworks = useAppStore((s) => s.frameworks);
  const guideDismissed = useAppStore((s) => s.guideDismissed);
  const checkerRan = useAppStore((s) => s.checkerRan);
  const paths = useAppStore((s) => s.paths);
  const keys = useAppStore((s) => s.keys);
  const dismissGuide = useAppStore((s) => s.dismissGuide);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const fleet = fleetOf({ instances, server });
  const dedicated = mode !== "client";
  const monitor = useMonitorView();
  const findings = useMemo(
    () => runChecker({ mods, mode, gameVersion: server.version, frameworks }),
    [mods, mode, server.version, frameworks],
  );
  const attention = findings.filter((f) => f.severity !== "info").slice(0, 5);

  return (
    <div>
      <CreateDenDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportServerDialog open={importOpen} onOpenChange={setImportOpen} />

      <PageHeader
        title="Overview"
        description={
          dedicated
            ? `${fleet.length} server${fleet.length === 1 ? "" : "s"} on this PC, ${runningCount(fleet)} running.`
            : "Your Palworld client: frameworks, mods, and anything that needs a look."
        }
        actions={
          dedicated ? (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Download />
                Import server
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus />
                New server
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link to="/frameworks">Set up UE4SS</Link>
            </Button>
          )
        }
      />

      <DenChecklist
        compact
        dismissed={guideDismissed}
        onDismiss={dismissGuide}
        state={{ onboarded: true, mode, paths, keys, frameworks, mods, checkerRan, instances }}
      />

      {dedicated ? (
        <>
          <HostStrip latest={monitor.latest} running={runningCount(fleet)} total={fleet.length} />
          <ServerGrid fleet={fleet} onImport={() => setImportOpen(true)} />
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Suspense fallback={<div className="panel h-[228px]" />}>
              <CpuLoadChart samples={monitor.samples} />
            </Suspense>
            <Suspense fallback={<div className="panel h-[228px]" />}>
              <RamLoadChart samples={monitor.samples} />
            </Suspense>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Attention items={attention} />
            <PalServerUpdate version={server.version} installPath={server.installPath || paths.server} serverId={server.id} />
          </div>
        </>
      ) : (
        <>
          <div className="panel mb-6 grid grid-cols-2 divide-border lg:grid-cols-4 lg:divide-x">
            <Stat label="Mods enabled" value={String(mods.filter((m) => m.enabled).length)} hint={`${mods.length} installed`} />
            <Stat label="UE4SS" value={frameworks.ue4ss.clientVersion ?? "Not installed"} hint="Client" />
            <Stat
              label="PalSchema"
              value={frameworks.palschema.clientVersion ?? "Off"}
              hint={frameworks.palschema.clientVersion ? "Installed" : "Optional"}
            />
            <Stat
              label="Health"
              value={attention.length ? `${attention.length} to check` : "All clear"}
              hint="From the checker"
              tone={attention.length ? "warn" : "ok"}
            />
          </div>
          <Attention items={attention} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: ReactNode; tone?: "ok" | "warn" }) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-xl font-semibold tabular-nums",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function HostStrip({ latest, running, total }: { latest?: MetricSample; running: number; total: number }) {
  const totalGb = latest?.hostRamGb ?? HOST_RAM_GB;
  const measured = Boolean(latest);
  return (
    <div className="panel mb-6 grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border">
      <Stat label="Servers running" value={`${running} / ${total}`} hint={running ? "Live now" : "All stopped"} tone={running ? "ok" : undefined} />
      <Stat label="Host CPU" value={measured ? `${latest!.hostCpu.toFixed(0)}%` : "—"} hint="Whole PC" />
      <Stat
        label="Memory"
        value={measured ? `${ramFromPct(latest!.hostRamPct, totalGb).toFixed(1)} GB` : "—"}
        hint={measured ? `of ${totalGb.toFixed(0)} GB` : "Measured while a server runs"}
      />
      <Stat
        label="Disk free"
        value={measured && latest!.diskFreeGb ? `${latest!.diskFreeGb.toFixed(0)} GB` : "—"}
        hint={measured && latest!.diskUsedPct ? `${latest!.diskUsedPct.toFixed(0)}% used on the server drive` : "Server drive"}
      />
    </div>
  );
}

function ServerGrid({ fleet, onImport }: { fleet: ServerState[]; onImport: () => void }) {
  const server = useAppStore((s) => s.server);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const startAllServers = useAppStore((s) => s.startAllServers);
  const stopAllServers = useAppStore((s) => s.stopAllServers);
  const removeServer = useAppStore((s) => s.removeServer);
  const [firewallOpen, setFirewallOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const anyRunning = fleet.some((i) => i.running);

  return (
    <section>
      <FirewallDialog open={firewallOpen} onOpenChange={setFirewallOpen} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Servers</h2>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const r = startAllServers();
              if (r.started) toast.success(`Started ${r.started} server${r.started === 1 ? "" : "s"}`);
              if (r.skipped) toast.error(`${r.skipped} skipped because of a port or world clash`);
              if (!r.started && !r.skipped) toast.message("Every server is already running");
            }}
          >
            <Play />
            Start all
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!anyRunning}
            onClick={() => {
              const n = stopAllServers();
              toast.message(n ? `Stopped ${n}` : "Nothing running");
            }}
          >
            <Square />
            Stop all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setFirewallOpen(true)}>
            <Shield />
            Firewall
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {fleet.map((inst) => (
          <ServerCard
            key={inst.id}
            inst={inst}
            selected={inst.id === (activeServerId || server.id)}
            canDelete={fleet.length > 1}
            onDelete={() => setPendingDelete(inst.id)}
          />
        ))}
        <button
          type="button"
          onClick={onImport}
          className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-5 text-center text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          <Download className="size-5" />
          <span className="text-[13px] font-medium text-foreground">Import a server you already run</span>
          <span className="max-w-64 text-xs">Settings, mods and the world come along. Nothing is copied or moved.</span>
        </button>
      </div>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this server?</DialogTitle>
            <DialogDescription>
              {fleet.find((i) => i.id === pendingDelete)?.name ?? "This server"} is removed from Palnest. Its PalServer folder on disk stays where it is.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!pendingDelete) return;
                const err = removeServer(pendingDelete);
                if (err) toast.error(err);
                else toast.message("Server removed");
                setPendingDelete(null);
              }}
            >
              Remove server
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function IconAction({ label, onClick, children, danger, disabled }: { label: string; onClick?: () => void; children: ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(danger && "hover:bg-danger/10 hover:text-danger")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ServerCard({
  inst,
  selected,
  canDelete,
  onDelete,
}: {
  inst: ServerState;
  selected: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const startServer = useAppStore((s) => s.startServer);
  const stopServer = useAppStore((s) => s.stopServer);
  const restartServer = useAppStore((s) => s.restartServer);
  const cloneServer = useAppStore((s) => s.cloneServer);
  const selectServer = useAppStore((s) => s.selectServer);
  const applyPreset = useAppStore((s) => s.applyPreset);
  const latest = useAppStore((s) => s.monitor.samples[s.monitor.samples.length - 1]);
  const measured = useLiveStats((s) => s.byId[inst.id]);
  const [profile, setProfile] = useState("community");
  const binding = inst.running && !inst.listenAt;
  const state = !inst.running ? "Stopped" : binding ? "Starting" : "Running";
  const online = inst.players.filter((p) => p.online).length;
  const totalGb = latest?.hostRamGb ?? HOST_RAM_GB;
  // The browser preview has no process to measure, so it shows the demo series for the selected server.
  const stats = inst.running
    ? measured ?? (!isDesktopApp() && selected && latest ? { cpu: latest.procCpu, ramMb: latest.procRamGb * 1024 } : null)
    : null;
  const join = joinHost(inst);

  return (
    <article className={cn("panel panel-hover flex flex-col p-4", selected && "panel-selected")}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={() => selectServer(inst.id)}>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                !inst.running ? "bg-muted-foreground/40" : binding ? "animate-pulse bg-warn" : "bg-ok",
              )}
            />
            <h3 className="truncate text-[15px] font-semibold">{inst.name}</h3>
            <Badge variant={!inst.running ? "default" : binding ? "warn" : "ok"}>{state}</Badge>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{inst.description || `PalServer ${inst.version}`}</p>
        </button>
        <Select
          value={profile}
          onValueChange={(id) => {
            selectServer(inst.id);
            applyPreset(id);
            setProfile(id);
            toast.success(`${inst.name} set to ${PROFILES.find((p) => p.id === id)?.label ?? id}`);
          }}
        >
          <SelectTrigger aria-label="Performance profile" className="h-7 w-auto shrink-0 gap-1 border-transparent bg-muted px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROFILES.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(join).then(
            () => toast.success(`Copied ${join}`),
            () => toast.message(join),
          );
        }}
        className="mt-3 flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-left font-mono text-xs transition-colors hover:bg-muted/70"
      >
        <span className="truncate">{join}</span>
        <Copy className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Players</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {online} / {inst.maxPlayers}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Uptime</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{inst.running ? formatUptime(inst.listenAt ?? inst.startedAt) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ports</dt>
          <dd className="mt-0.5 font-mono tabular-nums">
            {inst.port}/{inst.queryPort}
          </dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <Meter label="CPU" value={stats ? `${stats.cpu.toFixed(0)}%` : "—"} pct={stats?.cpu ?? 0} className="bg-chart-cpu" />
        <Meter
          label="Memory"
          value={stats ? `${(stats.ramMb / 1024).toFixed(1)} GB` : "—"}
          pct={stats ? (stats.ramMb / (totalGb * 1024)) * 100 : 0}
          className="bg-chart-ram"
        />
      </div>

      <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3">
        {inst.running ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              stopServer(inst.id);
              toast.message(`${inst.name} stopped`);
            }}
          >
            <Square className="fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              const err = startServer(inst.id);
              if (err) toast.error(err);
              else toast.success(`${inst.name} starting`);
            }}
          >
            <Play className="fill-current" />
            Start
          </Button>
        )}
        <IconAction
          label="Restart"
          disabled={!inst.running}
          onClick={() => {
            const err = restartServer(inst.id);
            if (err) toast.error(err);
            else toast.success(`${inst.name} restarting`);
          }}
        >
          <RotateCw />
        </IconAction>
        <div className="ml-auto flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" asChild>
                <Link to="/logs" aria-label="Console" onClick={() => selectServer(inst.id)}>
                  <ScrollText />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Console</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" asChild>
                <Link to="/server" search={{ tab: "players" }} aria-label="Players" onClick={() => selectServer(inst.id)}>
                  <Users />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Players</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" asChild>
                <Link to="/worlds" search={{ tab: "backups" }} aria-label="Backups" onClick={() => selectServer(inst.id)}>
                  <Archive />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Backups</TooltipContent>
          </Tooltip>
          <IconAction
            label="Clone"
            onClick={() => {
              const r = cloneServer(inst.id);
              if (r.error) toast.error(r.error);
              else toast.success("Server cloned");
            }}
          >
            <CopyPlus />
          </IconAction>
          <IconAction label={inst.running ? "Stop before removing" : "Remove"} danger disabled={!canDelete || inst.running} onClick={onDelete}>
            <Trash2 />
          </IconAction>
        </div>
      </div>
    </article>
  );
}

function Meter({ label, value, pct, className }: { label: string; value: string; pct: number; className: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{value}</span>
      </div>
      <Progress value={Math.min(100, pct)} indicatorClassName={className} />
    </div>
  );
}

function Attention({ items }: { items: ReturnType<typeof runChecker> }) {
  return (
    <section className="panel p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-medium">Needs a look</h2>
        <Link to="/checker" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Open checker
          <ArrowRight className="size-3" />
        </Link>
      </div>
      {items.length ? (
        <ul className="divide-y divide-border">
          {items.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-1 last:pb-0">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{f.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{f.detail}</p>
              </div>
              <Badge variant={f.severity === "error" ? "danger" : "warn"}>{f.kind}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-xs text-muted-foreground">Nothing is blocking. Mods, frameworks and versions line up.</p>
      )}
    </section>
  );
}

function PalServerUpdate({ version, installPath, serverId }: { version: string; installPath: string; serverId: string }) {
  const updateServer = useAppStore((s) => s.updateServer);
  const [hit, setHit] = useState<DedicatedLatest | null>(null);
  const [busy, setBusy] = useState(false);

  function check() {
    setBusy(true);
    void fetchSteamDedicatedLatest(version)
      .then((next) => setHit(next))
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return (
    <section className="panel flex flex-col p-4">
      <div className="flex items-center gap-2">
        <HardDrive className="size-4 text-muted-foreground" />
        <h2 className="text-[13px] font-medium">PalServer {version}</h2>
        {hit?.newer ? <Badge variant="primary">Update available</Badge> : hit ? <Badge variant="ok">Up to date</Badge> : null}
      </div>
      <p className="mt-2 flex-1 text-xs text-muted-foreground">
        {busy && !hit
          ? "Checking Steam for the latest dedicated server build…"
          : hit
            ? hit.newer
              ? `Version ${hit.version}${hit.build ? ` (build ${hit.build})` : ""} is out. Update with SteamCMD; the server restarts after.`
              : `You are on the current ${CURRENT_GAME} dedicated server line.`
            : "Could not reach Steam. Check again in a moment."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={check}>
          {busy ? "Checking…" : "Check again"}
        </Button>
        {hit?.newer ? (
          <Button
            size="sm"
            onClick={() => {
              void steamcmdDedicated(installPath || "C:\\PalServers\\PalServer", hit.version);
              updateServer(hit.version, serverId);
              toast.success(`Updating PalServer to ${hit.version}`);
            }}
          >
            Update to {hit.version}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
