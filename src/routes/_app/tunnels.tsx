import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPips, useFleet } from "@/components/fleet-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { joinHost, joinIp, providerMeta, TUNNEL_PROVIDERS, tunnelLaunchFlags } from "@/lib/tunnels";
import { overlayInstanceArgs } from "@/lib/fleet";
import { denListenLabel, isSlowListenBuild } from "@/lib/listen";
import { renderCommandLine } from "@/lib/args";
import { mapUpnp } from "@/lib/runtime";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { TunnelProvider } from "@/lib/types";
import { hostDetectAgents } from "@/lib/host";
import { emptyAgentScan, type AgentHit, type AgentScan } from "@/lib/agents";

export const Route = createFileRoute("/_app/tunnels")({ component: TunnelsPage });

async function copyText(value: string, ok: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(ok);
  } catch {
    toast.message(value);
  }
}

function TunnelsPage() {
  const mode = useAppStore((s) => s.mode);
  const { fleet, activeId } = useFleet();
  const selectServer = useAppStore((s) => s.selectServer);
  const setTunnelProvider = useAppStore((s) => s.setTunnelProvider);
  const runTunnel = useAppStore((s) => s.runTunnel);
  const args = useAppStore((s) => s.launchArgs);
  const setOps = useAppStore((s) => s.setOps);
  const ops = useAppStore((s) => s.ops);
  const [picked, setPicked] = useState<string>(activeId);
  const [agents, setAgents] = useState<AgentScan>(() => emptyAgentScan(true));
  const [scanning, setScanning] = useState(false);
  const lastFound = useRef("");

  function applyScan(hit: AgentScan, announce: boolean) {
    setAgents(hit);
    const st = useAppStore.getState();
    for (const box of st.instances?.length ? st.instances : [st.server]) {
      const kind = box.tunnel.provider;
      if (kind !== "playit" && kind !== "portwarp") continue;
      const agent = kind === "playit" ? hit.playit : hit.portwarp;
      if ((agent.installed || agent.running) && !box.tunnel.agentInstalled) {
        st.patchServer(box.id, {
          tunnel: { ...box.tunnel, agentInstalled: true, agentVersion: agent.path || "detected" },
        });
      }
    }
    const found = [
      hit.portwarp.running || hit.portwarp.installed ? `PortWarp ${hit.portwarp.running ? "running" : "installed"}` : "",
      hit.playit.running || hit.playit.installed ? `playit ${hit.playit.running ? "running" : "installed"}` : "",
    ].filter(Boolean);
    const key = found.join(" · ");
    if (announce) {
      if (found.length) toast.success(key);
      else toast.message(hit.simulated ? "Can't see this PC from the preview. Download an agent, then scan in Palnest.exe." : "No PortWarp or playit found — download one below.");
    } else if (key && key !== lastFound.current) {
      toast.success(`Detected ${key}`);
    }
    lastFound.current = key;
  }

  function scanAgents(announce = true) {
    setScanning(true);
    void hostDetectAgents()
      .then((hit) => applyScan(hit, announce))
      .finally(() => setScanning(false));
  }

  useEffect(() => {
    scanAgents(false);
    function onFocus() {
      void hostDetectAgents().then((hit) => applyScan(hit, false));
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missingAgents = !agents.playit.installed && !agents.portwarp.installed;
  useEffect(() => {
    if (!missingAgents) return;
    const id = window.setInterval(() => {
      void hostDetectAgents().then((hit) => applyScan(hit, false));
    }, 8000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingAgents]);

  if (mode === "client") return <Navigate to="/" />;

  const inst = fleet.find((i) => i.id === picked) ?? fleet.find((i) => i.id === activeId) ?? fleet[0];
  if (!inst) {
    return (
      <div>
        <PageHeader title="Tunnels" description="Create a dedicated world first." />
        <Button asChild>
          <Link to="/server" search={{ tab: "ops" }}>
            Open Server
          </Link>
        </Button>
      </div>
    );
  }

  const meta = providerMeta(inst.tunnel.provider);
  const flags = tunnelLaunchFlags(inst.tunnel);
  const cmd = renderCommandLine("PalServer.exe", overlayInstanceArgs(args, inst));
  const publicBits = cmd.split(" ").filter((p) => p.startsWith("-public") || p === "-publiclobby");

  function act(action: Parameters<typeof runTunnel>[1], provider?: TunnelProvider) {
    const err = runTunnel(inst.id, action, provider);
    if (err) toast.error(err);
    else if (action === "start") toast.success(`${inst.name} tunnel is online`);
    else if (action === "install") toast.success("Agent staged in this world");
  }

  return (
    <div>
      <PageHeader
        title="Tunnels"
        description="Skip router port-forward. playit.gg and PortWarp both carry Palworld UDP so friends can join from outside the LAN."
      />

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Tunnel agents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Palnest scans for playit.exe, pwrp.exe, and portwarp.exe. Missing agents show a download — install, then this page picks them up automatically.
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={scanning} onClick={() => scanAgents(true)}>
            {scanning ? "Scanning…" : "Scan again"}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TUNNEL_PROVIDERS.map((p) => (
            <AgentDetectCard
              key={p.id}
              provider={p}
              hit={p.id === "playit" ? agents.playit : agents.portwarp}
              scanning={scanning}
              onUse={() => {
                setTunnelProvider(inst.id, p.id);
                toast.success(`${p.name} selected for ${inst.name}`);
              }}
              selected={inst.tunnel.provider === p.id}
            />
          ))}
        </div>
      </section>

      <div className="mb-3 flex flex-wrap gap-2">
        {fleet.map((box) => (
          <button
            key={box.id}
            type="button"
            onClick={() => {
              setPicked(box.id);
              selectServer(box.id);
            }}
            className={cn(
              "h-11 rounded-sm border px-3 text-sm font-medium",
              box.id === inst.id ? "border-primary bg-card" : "border-border hover:bg-muted",
            )}
          >
            {box.name}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">{inst.name}</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Local UDP {inst.port} · query {inst.queryPort}
            </p>
            {inst.running ? (
              <p className="mt-1 text-sm text-muted-foreground">{denListenLabel(inst)}</p>
            ) : null}
          </div>
          <StatusPips inst={inst} />
        </div>

        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Provider</p>
        <div className="mb-5 grid gap-2 sm:grid-cols-3">
          {([{ id: "none" as const, name: "Direct / LAN", body: "You forward UDP yourself." }, ...TUNNEL_PROVIDERS.map((p) => ({ id: p.id, name: p.name, body: p.protocol }))]).map(
            (p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTunnelProvider(inst.id, p.id)}
                className={cn(
                  "rounded-lg border p-3 text-left",
                  inst.tunnel.provider === p.id ? "border-primary bg-background" : "border-border hover:bg-muted",
                )}
              >
                <p className="text-sm font-medium">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.body}</p>
              </button>
            ),
          )}
        </div>

        {inst.tunnel.provider === "none" ? (
          <div>
            <p className="text-sm text-muted-foreground">
              Forward UDP {inst.port} (game) and {inst.queryPort} (Steam query) on the host router, or pick a tunnel so Palnest can fill{" "}
              <span className="font-mono">-publicip</span> / <span className="font-mono">-publicport</span>.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                setOps({ upnp: true });
                void mapUpnp(inst.port, true);
                toast.success(ops?.upnp ? "UPnP already on" : "UPnP mapping requested for this world");
              }}
            >
              Try UPnP on UDP {inst.port}
            </Button>
          </div>
        ) : (
          <ol className="grid gap-4">
            <li className="grid grid-cols-[auto_1fr] gap-3">
              <span className="flex size-8 items-center justify-center rounded-full border border-border text-sm">1</span>
              <div>
                <p className="font-medium">Install the {meta?.name} agent</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Palnest stages the agent next to PalServer. On the desktop app it runs beside the world; in this preview it is simulated.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => act("install", inst.tunnel.provider)} disabled={inst.tunnel.agentInstalled}>
                    {inst.tunnel.agentInstalled ? `Agent ${inst.tunnel.agentVersion}` : "Install agent"}
                  </Button>
                  {meta ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={meta.download} target="_blank" rel="noreferrer">
                        Official download
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>

            {inst.tunnel.provider === "playit" ? (
              <li className="grid grid-cols-[auto_1fr] gap-3">
                <span className="flex size-8 items-center justify-center rounded-full border border-border text-sm">2</span>
                <div>
                  <p className="font-medium">Claim the playit agent</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open the claim URL, sign in, then confirm here. Palworld tunnels use the Palworld type, origin 127.0.0.1:{inst.port}.
                  </p>
                  {inst.tunnel.claimUrl ? (
                    <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{inst.tunnel.claimUrl}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inst.tunnel.claimUrl ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={inst.tunnel.claimUrl} target="_blank" rel="noreferrer">
                          Open claim
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => act("claim")} disabled={!inst.tunnel.agentInstalled}>
                        Get claim URL
                      </Button>
                    )}
                    <Button size="sm" onClick={() => act("confirm")} disabled={inst.tunnel.status !== "claim"}>
                      I've claimed it
                    </Button>
                  </div>
                </div>
              </li>
            ) : (
              <li className="grid grid-cols-[auto_1fr] gap-3">
                <span className="flex size-8 items-center justify-center rounded-full border border-border text-sm">2</span>
                <div>
                  <p className="font-medium">Sign in to PortWarp</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The agent uses your PortWarp account. Palnest waits until PalServer binds UDP {inst.port}
                    {isSlowListenBuild(inst.version)
                      ? ` — ${inst.version} listens after world load, not when the process starts.`
                      : "."}{" "}
                    Steam query {inst.queryPort} is attached only if it is listening as UDP (older worlds often bind it as TCP, which A2S never sees).
                  </p>
                </div>
              </li>
            )}

            <li className="grid grid-cols-[auto_1fr] gap-3">
              <span className="flex size-8 items-center justify-center rounded-full border border-border text-sm">3</span>
              <div>
                <p className="font-medium">Create and start the tunnel</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {inst.tunnel.provider === "playit"
                    ? "Type Palworld, leave origin at localhost. Palnest then writes -publicip and -publicport."
                    : `UDP game port after PalServer binds. Query extra only if UDP ${inst.queryPort} is up — PortWarp will not auto-detect A2S.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => act("create")} disabled={!inst.tunnel.agentInstalled}>
                    Create tunnel
                  </Button>
                  {inst.tunnel.status === "online" ? (
                    <Button size="sm" variant="outline" onClick={() => act("stop")}>
                      Stop tunnel
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => act("start")} disabled={!inst.tunnel.agentInstalled}>
                      Start tunnel
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => act("reset")}>
                    Clear
                  </Button>
                </div>
                {inst.tunnel.lastError ? <p className="mt-2 text-sm text-danger">{inst.tunnel.lastError}</p> : null}
              </div>
            </li>
          </ol>
        )}

        {inst.tunnel.game ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Join (IP)</p>
              <p className="mt-2 break-all font-mono text-sm">{joinIp(inst)}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => copyText(joinIp(inst), "IP copied")}>
                Copy IP
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Join (host)</p>
              <p className="mt-2 break-all font-mono text-sm">{joinHost(inst)}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => copyText(joinHost(inst), "Host copied")}>
                Copy host
              </Button>
            </div>
            {inst.tunnel.query ? (
              <div className="rounded-lg border border-border bg-background p-4 sm:col-span-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Steam query extra</p>
                <p className="mt-2 font-mono text-sm">
                  {inst.tunnel.query.host}:{inst.tunnel.query.port}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {flags.publicIp ? (
          <div className="mt-4 rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Launch flags Palnest will add</p>
            <p className="mt-2 break-all font-mono text-xs">{publicBits.join(" ") || "—"}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AgentDetectCard({
  provider,
  hit,
  onUse,
  selected,
}: {
  provider: (typeof TUNNEL_PROVIDERS)[number];
  hit: AgentHit;
  scanning: boolean;
  onUse: () => void;
  selected: boolean;
}) {
  const missing = !hit.installed && !hit.running;
  const status = hit.running ? "Running" : hit.installed ? "Installed" : "Not found";
  return (
    <article className={cn("rounded-xl border bg-background p-4", selected ? "border-primary" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{provider.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{provider.blurb}</p>
        </div>
        <Badge variant={hit.running ? "ok" : "outline"}>{status}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{hit.note}</p>
      {hit.path ? <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{hit.path}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {missing ? (
          <Button size="sm" asChild>
            <a href={provider.download} target="_blank" rel="noreferrer">
              <Download className="size-4" />
              Download {provider.name}
            </a>
          </Button>
        ) : (
          <Button size="sm" onClick={onUse}>
            {selected ? "Selected" : "Use this agent"}
          </Button>
        )}
        <Button size="sm" variant="ghost" asChild>
          <a href={provider.url} target="_blank" rel="noreferrer">
            Docs
          </a>
        </Button>
        {missing ? null : (
          <Button size="sm" variant="outline" asChild>
            <a href={provider.download} target="_blank" rel="noreferrer">
              Re-download
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}
