import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { PathField } from "@/components/path-field";
import { StatusPips, useFleet } from "@/components/fleet-bar";
import { ImportServerDialog } from "@/components/import-server-dialog";
import { JoinCard } from "@/components/join-card";
import { IniEditorPanel } from "@/components/ini-editor";
import { ServerOpsPanel } from "@/components/server-ops";
import { GuildPanel } from "@/components/guild-panel";
import { SaveBar } from "@/components/save-bar";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { overlayInstanceArgs, instanceExe, runningCount, suggestedInstallPath } from "@/lib/fleet";
import { joinHost, joinIp } from "@/lib/tunnels";
import { renderCommandLine } from "@/lib/args";
import { downloadText } from "@/lib/download";
import { DEPOT_PINS } from "@/lib/ops";
import { fetchSteamDedicatedLatest, type DedicatedLatest } from "@/lib/steam-latest";
import { launchPalworld, linuxScriptDownload, restAnnounce, restBan, restKick, restSave, restUnban, sendRcon, steamcmdDedicated } from "@/lib/runtime";
import { useAppStore } from "@/lib/store";
import { cn, formatStamp, formatUptime } from "@/lib/utils";

type ServerTab = "settings" | "ops" | "players" | "guilds" | "instance";

export const Route = createFileRoute("/_app/server")({
  validateSearch: (s: Record<string, unknown>): { tab: ServerTab } => ({
    tab:
      s.tab === "settings" || s.tab === "players" || s.tab === "guilds" || s.tab === "instance" || s.tab === "ops"
        ? s.tab
        : "ops",
  }),
  component: ServerPage,
});

function ServerPage() {
  const mode = useAppStore((s) => s.mode);
  const { fleet, activeId } = useFleet();
  const server = fleet.find((i) => i.id === activeId) ?? fleet[0];
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const startServer = useAppStore((s) => s.startServer);
  const stopServer = useAppStore((s) => s.stopServer);
  const restartServer = useAppStore((s) => s.restartServer);
  const updateServer = useAppStore((s) => s.updateServer);
  const rollbackServer = useAppStore((s) => s.rollbackServer);
  const createServer = useAppStore((s) => s.createServer);
  const cloneServer = useAppStore((s) => s.cloneServer);
  const removeServer = useAppStore((s) => s.removeServer);
  const selectServer = useAppStore((s) => s.selectServer);
  const startAllServers = useAppStore((s) => s.startAllServers);
  const stopAllServers = useAppStore((s) => s.stopAllServers);
  const patchServer = useAppStore((s) => s.patchServer);
  const paths = useAppStore((s) => s.paths);
  const worlds = useAppStore((s) => s.worlds);
  const args = useAppStore((s) => s.launchArgs);
  const settings = useAppStore((s) => s.worldSettings);
  const bans = useAppStore((s) => s.bans);
  const allow = useAppStore((s) => s.allow);
  const addBan = useAppStore((s) => s.addBan);
  const removeBan = useAppStore((s) => s.removeBan);
  const setAllow = useAppStore((s) => s.setAllow);
  const kick = useAppStore((s) => s.kick);
  const banPlayer = useAppStore((s) => s.banPlayer);
  const announce = useAppStore((s) => s.announce);
  const saveWorldLive = useAppStore((s) => s.saveWorldLive);
  const writeDenFiles = useAppStore((s) => s.writeDenFiles);
  const importBanlist = useAppStore((s) => s.importBanlist);
  const ops = useAppStore((s) => s.ops);

  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newWorld, setNewWorld] = useState<"new" | "clone" | "existing">("new");
  const [newWorldId, setNewWorldId] = useState(worlds[0]?.id ?? "");
  const [newPlayers, setNewPlayers] = useState("32");
  const [newCommunity, setNewCommunity] = useState(false);
  const [broadcast, setBroadcast] = useState("");
  const [banName, setBanName] = useState("");
  const [banSteam, setBanSteam] = useState("");
  const [banReason, setBanReason] = useState("");
  const [allowText, setAllowText] = useState(allow.join("\n"));
  const [steamLatest, setSteamLatest] = useState<DedicatedLatest | null>(null);
  const [steamBusy, setSteamBusy] = useState(false);
  const frameworks = useAppStore((s) => s.frameworks);
  const mods = useAppStore((s) => s.mods);

  if (mode === "client") return <Navigate to="/" />;
  if (!server) return null;

  const newer = server.versions.filter((v) => v.version !== server.version);
  const canRollback = server.history.length > 1;
  const world = worlds.find((w) => w.id === server.worldId);
  const live = runningCount(fleet);
  const cmd = renderCommandLine(instanceExe(server, paths.server), overlayInstanceArgs(args, server));

  function boot(id: string) {
    const err = startServer(id);
    if (err) toast.error(err);
    else toast.success("Dedicated started");
  }

  return (
    <div>
      <ImportServerDialog open={importOpen} onOpenChange={setImportOpen} />
      <PageHeader
        title="Server"
        description="Create extra PalServer copies on this host, run them together on staggered ports, and import a box you already keep."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                const r = startAllServers();
                if (r.started) toast.success(`Started ${r.started} world${r.started === 1 ? "" : "s"}`);
                if (r.skipped) toast.error(`${r.skipped} skipped — port or world clash`);
              }}
            >
              Start all
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const n = stopAllServers();
                toast.message(n ? `Stopped ${n}` : "Nothing running");
              }}
            >
              Stop all
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>New world</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create a dedicated server</DialogTitle>
                  <DialogDescription>
                    Palnest assigns the next free port block (game / REST / query / RCON) so two PalServers can run on one machine.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="new-name">Name</Label>
                    <Input
                      id="new-name"
                      value={newName}
                      onChange={(e) => {
                        setNewName(e.target.value);
                        if (!newPath) setNewPath(suggestedInstallPath(paths.server, e.target.value || "New world"));
                      }}
                      placeholder="Ashfall"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-desc">Description</Label>
                    <Input id="new-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="PvE, no raids." />
                  </div>
                  <PathField
                    id="new-path"
                    label="PalServer folder"
                    value={newPath}
                    onChange={setNewPath}
                    placeholder={suggestedInstallPath(paths.server, newName || "Ashfall")}
                    hint="A second copy of PalServer, or a SteamCMD install of its own. Do not point two live worlds at the same Saved folder."
                  />
                  <div className="grid gap-2">
                    <Label>World</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(
                        [
                          ["new", "Fresh world"],
                          ["clone", "Clone active"],
                          ["existing", "Use existing"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setNewWorld(id)}
                          className={cn(
                            "h-11 rounded-sm border px-3 text-sm",
                            newWorld === id ? "border-primary bg-background" : "border-border hover:bg-muted",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {newWorld === "existing" ? (
                      <select
                        className="h-11 rounded-sm border border-border bg-background px-3 text-sm"
                        value={newWorldId}
                        onChange={(e) => setNewWorldId(e.target.value)}
                      >
                        {worlds.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="new-max">Max players</Label>
                      <Input id="new-max" inputMode="numeric" value={newPlayers} onChange={(e) => setNewPlayers(e.target.value)} />
                    </div>
                    <label className="flex items-end gap-2 pb-2 text-sm">
                      <input type="checkbox" checked={newCommunity} onChange={(e) => setNewCommunity(e.target.checked)} />
                      Community list
                    </label>
                  </div>
                  <Button
                    onClick={() => {
                      if (!newName.trim()) {
                        toast.error("Name the world");
                        return;
                      }
                      const result = createServer({
                        name: newName.trim(),
                        description: newDesc,
                        installPath: newPath,
                        worldMode: newWorld,
                        worldId: newWorldId,
                        maxPlayers: Number(newPlayers) || 32,
                        community: newCommunity,
                      });
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success(`${newName.trim()} is ready. Start it when you want the second island live.`);
                      setCreateOpen(false);
                      setNewName("");
                      setNewDesc("");
                    }}
                  >
                    Create
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Import existing server
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {fleet.length} world{fleet.length === 1 ? "" : "s"} · {live} running
        </p>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tunnels">Tunnels</Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {fleet.map((inst) => (
          <button
            key={inst.id}
            type="button"
            onClick={() => selectServer(inst.id)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm",
              inst.id === server.id ? "border-primary bg-card" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
            )}
          >
            <span className={cn("size-2 rounded-full", inst.running ? "bg-ok" : "bg-muted-foreground/40")} />
            {inst.name}
          </button>
        ))}
      </div>

      <section className="mb-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("size-2 rounded-full", frameworks.ue4ss.serverVersion ? "bg-ok" : "bg-muted-foreground/50")} />
            <p className="text-sm">
              {frameworks.ue4ss.serverVersion ? "Server UE4SS is installed" : "Server UE4SS is not installed"}
            </p>
            {frameworks.ue4ss.serverVersion ? <Badge variant="outline">{frameworks.ue4ss.serverVersion}</Badge> : null}
            <Badge variant="outline">PALWORLD BUILD</Badge>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/settings" className="text-muted-foreground hover:text-foreground">
              Config
            </Link>
            <Link to="/worlds" search={{ tab: "list" }} className="text-muted-foreground hover:text-foreground">
              Worlds
            </Link>
            <Link to="/worlds" search={{ tab: "backups" }} className="text-muted-foreground hover:text-foreground">
              Backups
            </Link>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => void navigate({ search: { tab: "instance" } })}
            >
              Server
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <span className={cn("size-2 rounded-full", frameworks.palschema.serverVersion ? "bg-ok" : "bg-muted-foreground/50")} />
          <p className="text-sm">
            {frameworks.palschema.serverVersion ? "Pal Schema is installed" : "Pal Schema is not installed"}
            <span className="ml-2 text-muted-foreground">
              {mods.filter((m) => m.kind === "palschema").length} schema mods loaded
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
          <span className="size-2 rounded-full bg-ok" />
          <p className="text-sm">
            Official mod system is on
            <span className="ml-2 text-muted-foreground">
              {mods.filter((m) => m.kind === "pak").length
                ? `${mods.filter((m) => m.kind === "pak").length} packages`
                : "no packages listed"}
            </span>
          </p>
        </div>
      </section>

      <div className="mb-5 flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {(
          [
            ["settings", "Settings"],
            ["ops", "Ops"],
            ["players", "Players"],
            ["guilds", "Guilds"],
            ["instance", "Instance"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => void navigate({ search: { tab: id } })}
            className={cn(
              "h-9 rounded-sm px-3 text-sm font-medium",
              tab === id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" ? <IniEditorPanel /> : null}
      {tab === "ops" ? <ServerOpsPanel /> : null}
      {tab === "guilds" ? <GuildPanel /> : null}
      {tab === "players" ? (
        <PlayersTab
          server={server}
          kick={kick}
          banPlayer={banPlayer}
          settings={settings}
        />
      ) : null}
      {tab === "instance" ? (
        <>
      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        {fleet.map((inst) => {
          const bound = worlds.find((w) => w.id === inst.worldId);
          const selected = inst.id === server.id;
          return (
            <article
              key={inst.id}
              className={cn(
                "rounded-xl border bg-card p-5",
                selected ? "border-primary" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <button type="button" className="min-w-0 text-left" onClick={() => selectServer(inst.id)}>
                  <p className="truncate font-medium">{inst.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{inst.description || "No description"}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    UDP {inst.port} · query {inst.queryPort} · REST {inst.restPort}
                    {bound ? ` · ${bound.name}` : ""}
                  </p>
                </button>
                <StatusPips inst={inst} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {inst.running ? (
                  <Button size="sm" variant="outline" onClick={() => stopServer(inst.id)}>
                    Stop
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => boot(inst.id)}>
                    Start
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const err = restartServer(inst.id);
                    if (err) toast.error(err);
                    else toast.success("Restarted");
                  }}
                >
                  Restart
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const r = cloneServer(inst.id);
                    if (r.error) toast.error(r.error);
                    else toast.success("Cloned");
                  }}
                >
                  Clone
                </Button>
                {fleet.length > 1 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const err = removeServer(inst.id);
                      if (err) toast.error(err);
                      else toast.message("Removed");
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Selected" value={server.running ? (server.listenAt ? formatUptime(server.startedAt) : "Binding UDP") : "Stopped"} hint={server.name} />
        <Info label="Version" value={server.version} hint={`Build ${server.build}`} />
        <Info
          label="Players"
          value={`${server.players.filter((p) => p.online).length}/${server.maxPlayers}`}
          hint={server.community ? "Community list" : "Private"}
        />
        <Info
          label="Join"
          value={server.tunnel.status === "online" ? joinIp(server) : String(server.port)}
          hint={server.tunnel.status === "online" ? joinHost(server) : `Query ${server.queryPort} · REST ${server.restPort}`}
        />
      </div>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium">{server.name}</h2>
            <p className="text-sm text-muted-foreground">{server.description}</p>
            {server.installPath || server.importedFrom ? (
              <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{server.installPath || server.importedFrom}</p>
            ) : null}
            {world ? <p className="mt-1 text-xs text-muted-foreground">World · {world.name}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/optimize">Edit arguments</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tunnels">Tunnel</Link>
            </Button>
          </div>
        </div>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={server.community}
            onChange={(e) => patchServer(server.id, { community: e.target.checked })}
          />
          Publish to the community list
        </label>
        <p className="mb-4 break-all font-mono text-xs text-muted-foreground">{cmd}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              writeDenFiles(server.id);
              toast.success("Wrote PalWorldSettings.ini, Engine.ini, SAV, args, and banlist onto the PalServer folder.");
            }}
          >
            Write files to disk
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void restSave(server, settings);
              saveWorldLive(server.id);
              toast.success("Save-world sent over REST /v1/api/save");
            }}
          >
            Save world
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={server.autostart}
              onChange={(e) => patchServer(server.id, { autostart: e.target.checked })}
            />
            Start with Palnest
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={server.layout === "shared"}
              onChange={(e) => patchServer(server.id, { layout: e.target.checked ? "shared" : "copy" })}
            />
            Shared PalServer tree
          </label>
        </div>
      </section>

      <div className="mb-6">
        <JoinCard
          server={server}
          onJoinGame={() => {
            if (!paths.client.trim()) {
              toast.error("Set the Palworld game folder in Settings first.");
              return;
            }
            void launchPalworld(paths.client, server, ops?.linuxHost);
            toast.success("Launching Palworld with -connect=");
          }}
        />
      </div>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Live ops</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          REST /v1/api on port {server.restPort}. Palnest.exe hits the running box; this preview logs the same actions.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input value={broadcast} onChange={(e) => setBroadcast(e.target.value)} placeholder="Broadcast to the island" />
          <Button
            onClick={() => {
              if (!broadcast.trim()) return;
              void restAnnounce(server, settings, broadcast.trim());
              announce(broadcast.trim(), server.name);
              toast.success("Broadcast sent");
              setBroadcast("");
            }}
          >
            Announce
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              downloadText(linuxScriptDownload(server, args, paths), "start-palnest.sh", "text/x-shellscript");
              toast.success("Downloaded PalServer.sh wrapper");
            }}
          >
            Linux PalServer.sh
          </Button>
          <p className="self-center text-xs text-muted-foreground">
            {server.pid ? `Host pid ${server.pid}` : "No process attached yet"}
            {server.writtenAt ? ` · files written` : ""}
          </p>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Ban / allow list</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Written to banlist.txt next to Saved. Allow list is optional — leave empty to let anyone in.
        </p>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Input value={banName} onChange={(e) => setBanName(e.target.value)} placeholder="Name" />
          <Input value={banSteam} onChange={(e) => setBanSteam(e.target.value)} placeholder="SteamID64" />
          <Input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason" />
        </div>
        <Button
          size="sm"
          className="mb-4"
          onClick={() => {
            if (!banSteam.trim()) {
              toast.error("SteamID is required");
              return;
            }
            addBan({ steamId: banSteam.trim(), name: banName.trim(), reason: banReason.trim() || "Banned" });
            setBanName("");
            setBanSteam("");
            setBanReason("");
          }}
        >
          Ban
        </Button>
        <ul className="mb-4 divide-y divide-border">
          {(bans ?? []).map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="font-medium">{b.name || b.steamId}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{b.steamId}</span>
                <span className="ml-2 text-muted-foreground">{b.reason}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void restUnban(server, settings, b.steamId);
                  removeBan(b.id);
                  toast.success(`Unbanned ${b.name || b.steamId}`);
                }}
              >
                Unban
              </Button>
            </li>
          ))}
          {(bans ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No bans.</p> : null}
        </ul>
        <Label htmlFor="allow">Allow list (SteamID64, one per line)</Label>
        <Textarea id="allow" className="mt-2 font-mono text-xs" value={allowText} onChange={(e) => setAllowText(e.target.value)} />
        <Button
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() => {
            const ids = allowText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            setAllow(ids);
            toast.success(ids.length ? `${ids.length} allowed` : "Allow list cleared");
          }}
        >
          Save allow list
        </Button>
        <label className="mt-3 block">
          <span className="text-xs text-muted-foreground">Import banlist.txt</span>
          <Textarea
            className="mt-1 font-mono text-xs"
            placeholder="76561198…"
            onBlur={(e) => {
              if (!e.target.value.trim()) return;
              const n = importBanlist(e.target.value);
              toast.success(`Imported ${n} Steam IDs`);
              e.target.value = "";
            }}
          />
        </label>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">SteamCMD latest</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Check api.steamcmd.net for Palworld dedicated 2394010 after 1.0.5. Palnest pins known manifests for rollback.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={steamBusy}
            onClick={() => {
              setSteamBusy(true);
              void fetchSteamDedicatedLatest(server.version)
                .then((hit) => {
                  setSteamLatest(hit);
                  toast.success(hit.newer ? `Newer dedicated: ${hit.version}` : "Already on the current dedicated line");
                })
                .finally(() => setSteamBusy(false));
            }}
          >
            {steamBusy ? "Checking…" : "Check for updates"}
          </Button>
        </div>
        {steamLatest ? (
          <p className="text-sm">
            <span className="font-medium">{steamLatest.newer ? "Update available" : "Up to date"}</span>
            <span className="ml-2 text-muted-foreground">{steamLatest.note}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            This world is on Palworld dedicated {server.version}. Check SteamCMD when Pocketpair ships a later build.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Update and rollback</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          SteamCMD-style hops on the Palworld 1.0 line, per world. Palnest snapshots the bound world first, then asks the checker
          to re-read mods for conflicts. Early Access 0.7.3 is rollback only.
        </p>
        <ul className="divide-y divide-border">
          {server.versions.map((v) => {
            const current = v.version === server.version;
            return (
              <li key={v.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium font-mono">{v.version}</p>
                    <Badge variant={v.channel === "experimental" ? "warn" : "outline"}>{v.channel}</Badge>
                    {current ? <Badge variant="ok">Current</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{v.notes}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatStamp(v.releasedAt)}</p>
                </div>
                <div className="flex gap-2">
                  {!current ? (
                    <Button
                      size="sm"
                      variant={v.channel === "experimental" ? "outline" : "secondary"}
                      onClick={() => {
                        const root = server.installPath || paths.server;
                        void steamcmdDedicated(root || "C:\\PalServers\\PalServer", v.version);
                        updateServer(v.version, server.id);
                        toast.success(`${server.name} moved to ${v.version} via SteamCMD ${DEPOT_PINS[v.version]?.depot ?? "2394010"}. Check mods.`);
                      }}
                    >
                      {newer.find((n) => n.version === v.version) ? "Update to this" : "Install"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!canRollback}
            onClick={() => {
              const prev = server.history.length >= 2 ? server.history[server.history.length - 2] : server.version;
              const root = server.installPath || paths.server;
              void steamcmdDedicated(root || "C:\\PalServers\\PalServer", prev);
              rollbackServer(server.id);
              toast.success(`Rolled back toward ${prev} via SteamCMD ${DEPOT_PINS[prev]?.depot ?? "2394010"}`);
            }}
          >
            Rollback to previous
          </Button>
          <p className="self-center text-xs text-muted-foreground">
            History: {server.history.join(" → ") || "none"}
          </p>
        </div>
      </section>
        </>
      ) : null}
    </div>
  );
}

function PlayersTab({
  server,
  kick,
  banPlayer,
  settings,
}: {
  server: ReturnType<typeof useAppStore.getState>["server"];
  kick: (playerId: string, serverId?: string) => void;
  banPlayer: (playerId: string, serverId?: string, reason?: string) => void;
  settings: ReturnType<typeof useAppStore.getState>["worldSettings"];
}) {
  const announce = useAppStore((s) => s.announce);
  const patchServer = useAppStore((s) => s.patchServer);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [motd, setMotd] = useState(server.joinMotd || "");
  const [rconCmd, setRconCmd] = useState("");
  const [rconOut, setRconOut] = useState("");
  const [rconBusy, setRconBusy] = useState(false);
  const online = server.players.filter((p) => p.online);
  const filtered = server.players.filter((p) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.guild.toLowerCase().includes(s) || p.playerId.toLowerCase().includes(s);
  });
  const rconOn = settings.find((s) => s.key === "RCONEnabled")?.value === "True";
  const motdDirty = motd !== (server.joinMotd || "");

  useEffect(() => {
    setMotd(server.joinMotd || "");
  }, [server.id, server.joinMotd]);

  async function runRcon(cmd: string) {
    const next = cmd.trim();
    if (!next) return;
    setRconBusy(true);
    try {
      const res = await sendRcon(server, settings, next);
      if (!res.ok) {
        setRconOut(res.error || "RCON failed");
        toast.error(res.error || "RCON failed");
      } else {
        setRconOut(res.body || "(ok)");
        toast.success(res.simulated ? "RCON previewed" : "RCON sent");
      }
    } finally {
      setRconBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-medium">Players</h2>
          <p className="text-sm text-muted-foreground">
            {online.length}/{server.maxPlayers} online. Kick drops them now. Ban hits REST and writes SteamID64 to banlist.txt.
          </p>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players" className="lg:max-w-xs" />
      </div>

      <div className="mb-4 rounded-lg border border-border bg-background p-4">
        <Label htmlFor="join-motd">Join MOTD</Label>
        <p className="mt-1 mb-2 text-sm text-muted-foreground">
          Broadcast when someone connects. Use {"{player}"} and {"{world}"}. Leave empty to skip.
        </p>
        <Textarea
          id="join-motd"
          value={motd}
          onChange={(e) => setMotd(e.target.value)}
          placeholder="Welcome {player} to {world}."
          className="min-h-20"
        />
        <SaveBar
          dirty={motdDirty}
          onSave={() => {
            const err = patchServer(server.id, { joinMotd: motd });
            if (err) toast.error(err);
            else toast.success("Saved join MOTD");
          }}
          onDiscard={() => setMotd(server.joinMotd || "")}
          hint="MOTD is not live until you save."
        />
      </div>

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!msg.trim()) return;
          void restAnnounce(server, settings, msg.trim());
          announce(msg.trim(), server.id);
          toast.success("Announcement sent");
          setMsg("");
        }}
      >
        <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Broadcast to the server" className="flex-1" />
        <Button type="submit" variant="outline">
          Announce
        </Button>
      </form>

      <div className="mb-4 rounded-lg border border-border bg-background p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">RCON</p>
            <p className="text-sm text-muted-foreground">
              TCP {server.rconPort}
              {rconOn ? "" : " · RCONEnabled is off — turn it on in Settings to talk to PalServer.exe"}
              . Use this when REST is down. Info, ShowPlayers, Save, Broadcast, KickPlayer.
            </p>
          </div>
          <Badge variant={rconOn ? "ok" : "outline"}>{rconOn ? "Enabled" : "Off in INI"}</Badge>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runRcon(rconCmd);
          }}
        >
          <Input
            value={rconCmd}
            onChange={(e) => setRconCmd(e.target.value)}
            placeholder="Broadcast Hello from Palnest"
            className="flex-1 font-mono text-sm"
          />
          <Button type="submit" disabled={rconBusy}>
            {rconBusy ? "Sending…" : "Send"}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Info", "ShowPlayers", "Save"].map((cmd) => (
            <Button key={cmd} size="sm" variant="outline" disabled={rconBusy} onClick={() => void runRcon(cmd)}>
              {cmd}
            </Button>
          ))}
        </div>
        {rconOut ? (
          <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{rconOut}</pre>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {server.players.length === 0 ? "No one is in this world." : "No players match that search."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="py-2 font-medium">Player</th>
                <th className="py-2 font-medium">Lvl</th>
                <th className="py-2 font-medium">Ping</th>
                <th className="py-2 font-medium">Where</th>
                <th className="py-2 font-medium">Guild</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.playerId} className="border-t border-border">
                  <td className="py-2">
                    <p>{p.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.playerId}</p>
                    {p.userId && p.userId !== p.playerId ? (
                      <p className="font-mono text-xs text-muted-foreground">{p.userId}</p>
                    ) : null}
                  </td>
                  <td className="py-2 font-mono tabular-nums">{p.level}</td>
                  <td className="py-2 font-mono tabular-nums">{p.ping}</td>
                  <td className="py-2 text-muted-foreground">{p.location}</td>
                  <td className="py-2 text-muted-foreground">{p.guild || "—"}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const id = p.userId || p.playerId;
                          void navigator.clipboard.writeText(id).then(
                            () => toast.success("Copied Steam / user id"),
                            () => toast.message(id),
                          );
                        }}
                      >
                        Copy ID
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!p.online}
                        onClick={() => {
                          void restKick(server, settings, p.playerId);
                          kick(p.playerId, server.id);
                          toast.message(`Kicked ${p.name}`);
                        }}
                      >
                        Kick
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          void restBan(server, settings, p.userId || p.playerId);
                          banPlayer(p.playerId, server.id, "Banned from Players tab");
                          toast.message(`Banned ${p.name}`);
                        }}
                      >
                        Ban
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Info({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-lg font-medium break-all">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground break-all">{hint}</p> : null}
    </div>
  );
}
