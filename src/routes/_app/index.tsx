import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Activity,
  Cpu,
  Download,
  LayoutGrid,
  MemoryStick,
  Play,
  Plus,
  Server,
  Shield,
  Square,
} from "lucide-react";
import { CreateDenDialog } from "@/components/create-den-dialog";
import { CpuLoadChart, HOST_RAM_GB, RamLoadBar, ramFromPct } from "@/components/dash-charts";
import { FirewallDialog } from "@/components/firewall-dialog";
import { ImportServerDialog } from "@/components/import-server-dialog";
import { DenChecklist } from "@/components/setup-guide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { runChecker } from "@/lib/checker";
import { OPTIMIZE_PRESETS } from "@/lib/args";
import { fleetOf, runningCount } from "@/lib/fleet";
import { useAppStore } from "@/lib/store";
import { cn, formatUptime } from "@/lib/utils";
import { useMonitorView } from "@/components/world-pulse";
import type { ServerState } from "@/lib/types";

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
  const startAllServers = useAppStore((s) => s.startAllServers);
  const stopAllServers = useAppStore((s) => s.stopAllServers);
  const startServer = useAppStore((s) => s.startServer);
  const stopServer = useAppStore((s) => s.stopServer);
  const selectServer = useAppStore((s) => s.selectServer);
  const applyPreset = useAppStore((s) => s.applyPreset);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [firewallOpen, setFirewallOpen] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const fleet = fleetOf({ instances, server });
  const live = runningCount(fleet);
  const showServer = mode !== "client";
  const monitor = useMonitorView();
  const findings = useMemo(
    () => runChecker({ mods, mode, gameVersion: server.version, frameworks }),
    [mods, mode, server.version, frameworks],
  );
  const attention = findings.filter((f) => f.severity !== "info").slice(0, 4);
  const cpu = monitor.latest?.hostCpu ?? 0;
  const ramGb = ramFromPct(monitor.latest?.hostRamPct ?? 0);
  const enabled = mods.filter((m) => m.enabled);

  return (
    <div>
      <CreateDenDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportServerDialog open={importOpen} onOpenChange={setImportOpen} />
      <FirewallDialog open={firewallOpen} onOpenChange={setFirewallOpen} />

      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
            {showServer ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-muted/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", live > 0 ? "bg-ok" : "bg-primary")} />
                {fleet.length} Node{fleet.length === 1 ? "" : "s"}
                <span aria-hidden>·</span>
                {live} Active
              </span>
            ) : (
              <Badge variant="outline">Client</Badge>
            )}
          </div>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {showServer
              ? "Global control center and orchestrator for dedicated Palworld servers."
              : "What needs a look on this Palworld client, and what just changed."}
          </p>
        </div>
        {showServer ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Download className="size-4" />
              Import existing server
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New Server
            </Button>
          </div>
        ) : (
          <Button asChild>
            <Link to="/frameworks">Install UE4SS</Link>
          </Button>
        )}
      </header>

      <DenChecklist
        compact
        dismissed={guideDismissed}
        onDismiss={dismissGuide}
        state={{
          onboarded: true,
          mode,
          paths,
          keys,
          frameworks,
          mods,
          checkerRan,
          instances,
        }}
      />

      {showServer ? (
        <>
          <section className="dash-glass hub-rail mb-4 flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                <p className="text-xs font-medium tracking-widest uppercase">Multi-server command hub</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Orchestrate lifecycle states and firewall rules across all configured server nodes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <Button
                variant="outline"
                className="border-ok/40 text-ok hover:bg-ok/10"
                onClick={() => {
                  const r = startAllServers();
                  if (r.started) toast.success(`Started ${r.started} node${r.started === 1 ? "" : "s"}`);
                  if (r.skipped) toast.error(`${r.skipped} skipped — port or world clash`);
                  if (!r.started && !r.skipped) toast.message("Every node is already running");
                }}
              >
                <Play className="size-4" />
                Start All
              </Button>
              <Button
                variant="outline"
                className="border-danger/40 text-danger hover:bg-danger/10"
                onClick={() => {
                  const n = stopAllServers();
                  toast.message(n ? `Stopped ${n}` : "Nothing running");
                }}
              >
                <Square className="size-3.5 fill-current" />
                Stop All
              </Button>
              <Button variant="outline" onClick={() => setFirewallOpen(true)}>
                <Shield className="size-4" />
                Configure Firewall
              </Button>
            </div>
          </section>

          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total servers"
              value={String(fleet.length)}
              badge="Configured"
              icon={Server}
            />
            <StatCard
              label="Active servers"
              value={String(live)}
              badge={live ? "Live" : "Stopped"}
              icon={Activity}
              valueClass={live ? "text-ok" : "text-primary"}
            />
            <StatCard
              label="CPU usage"
              value={`${cpu.toFixed(0)}%`}
              badge="Host Load"
              icon={Cpu}
              valueClass="text-chart-cpu"
            />
            <StatCard
              label="RAM usage"
              value={`${ramGb.toFixed(1)} GB`}
              badge={`/ ${HOST_RAM_GB.toFixed(1)} GB Total`}
              icon={MemoryStick}
              valueClass="text-chart-ram"
            />
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <CpuLoadChart samples={monitor.samples} live={live > 0} />
            <RamLoadBar samples={monitor.samples} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fleet.map((inst) => (
              <NodeCard
                key={inst.id}
                inst={inst}
                selected={inst.id === (activeServerId || server.id)}
                profile={profiles[inst.id] ?? "community"}
                onSelect={() => selectServer(inst.id)}
                onProfile={(id) => {
                  selectServer(inst.id);
                  applyPreset(id);
                  setProfiles((prev) => ({ ...prev, [inst.id]: id }));
                  const label = PROFILES.find((p) => p.id === id)?.label ?? id;
                  toast.success(`${inst.name} set to ${label}`);
                }}
                onStart={() => {
                  const err = startServer(inst.id);
                  if (err) toast.error(err);
                  else toast.success(`${inst.name} started`);
                }}
                onStop={() => {
                  stopServer(inst.id);
                  toast.message(`${inst.name} stopped`);
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex min-h-[220px] flex-col items-start justify-between rounded-xl border border-dashed border-primary/40 bg-card/60 p-5 text-left transition-colors hover:border-primary hover:bg-card"
            >
              <div>
                <p className="font-medium">Import existing server</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Point at a PalServer folder you already run. PalWorldSettings.ini, mods, and the world come with it.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm text-primary">
                <Download className="size-4" />
                Browse PalServer folder
              </span>
            </button>
          </div>
        </>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Mode" value="Client" badge="Dedicated pages hidden" icon={Server} />
          <StatCard label="Mods" value={String(enabled.length)} badge="Live" icon={LayoutGrid} />
          <StatCard
            label="Health"
            value={attention.length ? `${attention.length}` : "Clear"}
            badge={attention.length ? "To check" : "Nothing blocking"}
            icon={Shield}
            valueClass={attention.length ? "text-warn" : "text-ok"}
          />
          <StatCard
            label="UE4SS"
            value={frameworks.ue4ss.clientVersion ?? "—"}
            badge={frameworks.palschema.clientVersion ? `PalSchema ${frameworks.palschema.clientVersion}` : "PalSchema off"}
            icon={Cpu}
          />
        </div>
      )}

      {attention.length > 0 ? (
        <section className="dash-glass mt-4 rounded-xl p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-medium">Needs a look</h2>
            <Link to="/checker" className="text-sm text-primary">
              Open checker
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {attention.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.detail}</p>
                </div>
                <Badge variant={f.severity === "error" ? "danger" : "warn"}>{f.kind}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  badge,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string;
  badge: string;
  icon: typeof Server;
  valueClass?: string;
}) {
  return (
    <article className="dash-glass relative rounded-xl p-4">
      <p className="pr-10 text-xs font-medium tracking-widest text-muted-foreground uppercase">{label}</p>
      <span className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <p className={cn("mt-5 text-3xl font-semibold tracking-tight tabular-nums", valueClass)}>{value}</p>
      <span className="mt-3 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{badge}</span>
    </article>
  );
}

function NodeCard({
  inst,
  selected,
  profile,
  onSelect,
  onProfile,
  onStart,
  onStop,
}: {
  inst: ServerState;
  selected: boolean;
  profile: string;
  onSelect: () => void;
  onProfile: (id: string) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const binding = inst.running && !inst.listenAt;
  const life = !inst.running ? "Stopped" : binding ? "Binding UDP" : "Listening";
  const uptime = inst.running ? formatUptime(inst.listenAt ?? inst.startedAt) : "—";

  return (
    <article
      className={cn(
        "dash-glass rounded-xl p-5 transition-[box-shadow] duration-150",
        selected && "node-active",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={onSelect}>
          <div className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full", inst.running ? (binding ? "bg-warn" : "bg-ok") : "bg-muted-foreground/50")} />
            <h2 className="truncate font-medium">{inst.name}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{inst.description || "Palworld dedicated server node"}</p>
        </button>
        <Select value={profile} onValueChange={onProfile}>
          <SelectTrigger className="h-9 w-auto min-w-28 shrink-0 rounded-full border-transparent bg-muted px-3 text-xs">
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MetaTile
          label="Ports (game/query/rcon)"
          value={`${inst.port}/${inst.queryPort}/${inst.rconPort}`}
        />
        <MetaTile label="Max players" value={`${inst.maxPlayers} Slots`} />
        <MetaTile label="Lifecycle state" value={life} />
        <MetaTile label="Real uptime" value={uptime} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {inst.running ? (
          <Button size="sm" variant="outline" className="border-danger/40 text-danger hover:bg-danger/10" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button size="sm" className="bg-ok text-background hover:opacity-90" onClick={onStart}>
            Start
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link to="/server" onClick={onSelect}>
            Open
          </Link>
        </Button>
      </div>
    </article>
  );
}

function MetaTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-muted/80 px-3 py-3">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-mono text-sm tabular-nums">{value}</p>
    </div>
  );
}
