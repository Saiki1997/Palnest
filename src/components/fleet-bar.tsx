import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImportServerDialog } from "@/components/import-server-dialog";
import { joinHost, tunnelLabel } from "@/lib/tunnels";
import { fleetOf, runningCount } from "@/lib/fleet";
import { useAppStore } from "@/lib/store";
import { cn, formatUptime } from "@/lib/utils";
import type { ServerState } from "@/lib/types";

export function useFleet() {
  const instances = useAppStore((s) => s.instances);
  const server = useAppStore((s) => s.server);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const fleet = instances?.length ? instances : fleetOf({ instances, server });
  return { fleet, activeId: activeServerId || server.id, server };
}

export function FleetStrip({ compact }: { compact?: boolean }) {
  const { fleet, activeId } = useFleet();
  const selectServer = useAppStore((s) => s.selectServer);
  const startServer = useAppStore((s) => s.startServer);
  const stopServer = useAppStore((s) => s.stopServer);
  const worlds = useAppStore((s) => s.worlds);
  const live = runningCount(fleet);
  const [importOpen, setImportOpen] = useState(false);

  if (fleet.length < 1) return null;

  return (
    <div className={cn("mb-6", compact && "mb-4")}>
      <ImportServerDialog open={importOpen} onOpenChange={setImportOpen} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Fleet · {live} running / {fleet.length}
        </p>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
            Import existing
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/server" search={{ tab: "ops" }}>
              Manage worlds
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {fleet.map((inst) => {
          const world = worlds.find((w) => w.id === inst.worldId);
          const active = inst.id === activeId;
          return (
            <article
              key={inst.id}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                active ? "border-primary bg-card" : "border-border bg-card hover:bg-muted",
              )}
            >
              <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={() => selectServer(inst.id)}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{inst.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    UDP {inst.port}
                    {world ? ` · ${world.name}` : ""}
                  </p>
                </div>
                <StatusPips inst={inst} />
              </button>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {inst.running ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      stopServer(inst.id);
                      toast.message(`${inst.name} stopped`);
                    }}
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const err = startServer(inst.id);
                      if (err) toast.error(err);
                      else toast.success(`${inst.name} started on UDP ${inst.port}`);
                    }}
                  >
                    Start
                  </Button>
                )}
                {inst.tunnel.status === "online" ? (
                  <span className="truncate font-mono text-xs text-muted-foreground">{joinHost(inst)}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {inst.running ? formatUptime(inst.startedAt) : "Stopped"}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function StatusPips({ inst }: { inst: ServerState }) {
  const binding = inst.running && !inst.listenAt;
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-1">
      <Badge variant={inst.running ? (binding ? "outline" : "ok") : "outline"}>
        {binding ? "Binding UDP" : inst.running ? "Live" : "Stopped"}
      </Badge>
      {inst.tunnel.provider !== "none" ? (
        <Badge variant={inst.tunnel.status === "online" && Boolean(inst.listenAt) ? "primary" : "outline"}>
          {inst.tunnel.provider === "playit" ? "playit" : "PortWarp"} ·{" "}
          {inst.tunnel.status === "online" && inst.running && !inst.listenAt ? "Waiting" : tunnelLabel(inst.tunnel.status)}
        </Badge>
      ) : null}
    </div>
  );
}
