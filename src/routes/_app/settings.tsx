import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SaveBar } from "@/components/save-bar";
import { DesktopGet } from "@/components/desktop-get";
import { FolderScan, toastScanResult } from "@/components/folder-scan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ScanResult } from "@/lib/scan";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { AppMode } from "@/lib/types";
import { LOCALES } from "@/lib/i18n";
import { hostAutostart, hostDetectSteam, hostSetTray, postWebhook } from "@/lib/host";
import { mapUpnp } from "@/lib/runtime";
import type { Locale, Ue4ssChannel } from "@/lib/ops";
import { webhookPayload } from "@/lib/ops";
import { BACKUP_INTERVALS } from "@/lib/backup";
import { downloadText, readFileText } from "@/lib/download";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

const MODES: { id: AppMode; title: string; body: string }[] = [
  { id: "server", title: "Server only", body: "Hide the game client. Palworld.exe is optional." },
  { id: "client", title: "Client only", body: "Hide dedicated controls. No PalServer required." },
  { id: "both", title: "Client + server", body: "Mirror mods or keep them on one side." },
];

function SettingsPage() {
  const mode = useAppStore((s) => s.mode);
  const paths = useAppStore((s) => s.paths);
  const keys = useAppStore((s) => s.keys);
  const autoBackup = useAppStore((s) => s.autoBackup);
  const crashWatchdog = useAppStore((s) => s.crashWatchdog);
  const captureConsole = useAppStore((s) => s.captureConsole);
  const checkModUpdates = useAppStore((s) => s.checkModUpdates);
  const setMode = useAppStore((s) => s.setMode);
  const setPaths = useAppStore((s) => s.setPaths);
  const ingestDetected = useAppStore((s) => s.ingestDetected);
  const setKeys = useAppStore((s) => s.setKeys);
  const setFlags = useAppStore((s) => s.setFlags);
  const loadSample = useAppStore((s) => s.loadSample);
  const resetAll = useAppStore((s) => s.resetAll);
  const thresholds = useAppStore((s) => s.monitor.thresholds);
  const setMonitorThresholds = useAppStore((s) => s.setMonitorThresholds);
  const ops = useAppStore((s) => s.ops);
  const setOps = useAppStore((s) => s.setOps);
  const server = useAppStore((s) => s.server);
  const navigate = useNavigate();
  const [clientPreview, setClientPreview] = useState<ScanResult | null>(null);
  const [serverPreview, setServerPreview] = useState<ScanResult | null>(null);
  const [keysDraft, setKeysDraft] = useState<Partial<typeof keys> | null>(null);
  const shownKeys = { ...keys, ...keysDraft };

  function saveKeys() {
    if (!keysDraft) return;
    setKeys(keysDraft);
    setKeysDraft(null);
    toast.success("Saved store API keys");
  }

  return (
    <div>
      <PageHeader title="Settings" description="Mode, paths, and store API keys. Keys never leave this browser except to query the store you asked for." />

      <div className="mb-6">
        <DesktopGet />
      </div>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Mode</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Switch any time. Server-only worlds do not need a game folder. Client-only worlds hide dedicated pages.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                toast.success(`Mode: ${m.title}`);
              }}
              className={cn(
                "rounded-lg border p-4 text-left",
                mode === m.id ? "border-primary bg-background" : "border-border hover:bg-muted",
              )}
            >
              <p className="font-medium">{m.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Paths</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Browse the Palworld or PalServer folder. Palnest lists UE4SS, PalSchema, and PAK mods already installed and
          adds them to this world.
        </p>
        <div className="mt-4 grid gap-4">
          <FolderScan
            id="set-client"
            label="Palworld game"
            value={paths.client}
            onChange={(client) => {
              setPaths({ client });
              setClientPreview(null);
            }}
            placeholder="Optional when running server-only"
            hint="Steam copy. Browse the folder that contains Pal, not Palworld.exe."
            result={clientPreview}
            onScanned={(root, _files, result) => {
              setPaths({ client: root });
              setClientPreview(result);
              toastScanResult(result, ingestDetected("client", result));
            }}
          />
          <FolderScan
            id="set-server"
            label="Dedicated server"
            value={paths.server}
            onChange={(server) => {
              setPaths({ server });
              setServerPreview(null);
            }}
            placeholder="Optional when running client-only"
            hint="PalServer root. Same scan as Import existing."
            result={serverPreview}
            onScanned={(root, _files, result) => {
              setPaths({ server: root });
              setServerPreview(result);
              toastScanResult(result, ingestDetected("server", result));
            }}
          />
        </div>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            void hostDetectSteam().then((found) => {
              const next: { client?: string; server?: string } = {};
              if (found.client) next.client = found.client;
              if (found.server) next.server = found.server;
              if (next.client || next.server) setPaths(next);
              toast.success(
                found.client || found.server
                  ? `Steam libraries: ${found.client || "no Palworld"} · ${found.server || "no PalServer"}`
                  : "No Steam library found. Browse manually.",
              );
            });
          }}
        >
          Detect Steam folders
        </Button>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Store APIs</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Keys stay in this browser and are sent only to the store you asked Palnest to query. With a key, Discover loads live catalogs, descriptions, and the file list so you can pick which archive to install.
        </p>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="nexus">Nexus API key</Label>
            <Input
              id="nexus"
              type="password"
              autoComplete="off"
              value={shownKeys.nexus}
              onChange={(e) => setKeysDraft((d) => ({ ...(d ?? {}), nexus: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Latest-added, trending, updated Palworld mods, full descriptions, and every MAIN / OPTIONAL file.{" "}
              <a href="https://www.nexusmods.com/users/myaccount?tab=api" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Get a Nexus key
              </a>
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="steam">Steam Web API key</Label>
            <Input
              id="steam"
              type="password"
              autoComplete="off"
              value={shownKeys.steam}
              onChange={(e) => setKeysDraft((d) => ({ ...(d ?? {}), steam: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Workshop QueryFiles search, sort, and time filters. Item pages load without a key.{" "}
              <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Get a Steam key
              </a>
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cf">CurseForge API key</Label>
            <Input
              id="cf"
              type="password"
              autoComplete="off"
              value={shownKeys.curseforge}
              onChange={(e) => setKeysDraft((d) => ({ ...(d ?? {}), curseforge: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Palworld project search, descriptions, and file lists.{" "}
              <a href="https://console.curseforge.com/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Get a CurseForge key
              </a>
            </p>
          </div>
        </div>
        <SaveBar dirty={Boolean(keysDraft)} onSave={saveKeys} onDiscard={() => setKeysDraft(null)} hint="API keys stay in this browser until you save." />
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-medium">Behaviour</h2>
        <ul className="space-y-4">
          <Toggle
            label="Automatic world snapshots"
            hint="Every interval while the dedicated server is running. Pick 10 min / 1 h / 6 h / 12 h / 1 day below."
            checked={autoBackup}
            onChange={(v) => setFlags({ autoBackup: v })}
          />
          <Toggle
            label="Crash watchdog"
            hint="Restart PalServer if the process dies uncleanly."
            checked={crashWatchdog}
            onChange={(v) => setFlags({ crashWatchdog: v })}
          />
          <Toggle
            label="Capture server console"
            hint="Tail PalServer output into the journal."
            checked={captureConsole}
            onChange={(v) => setFlags({ captureConsole: v })}
          />
          <Toggle
            label="Check mod updates"
            hint="Compare installed versions to Nexus / Workshop / CurseForge."
            checked={checkModUpdates}
            onChange={(v) => setFlags({ checkModUpdates: v })}
          />
        </ul>
      </section>

      {mode !== "client" ? (
        <section className="mb-6 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Monitor thresholds</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Sustained alerts on the dashboard. A spike that recovers inside the sustain window is ignored.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="th-cpu">Sustained CPU %</Label>
              <Input
                id="th-cpu"
                type="number"
                value={thresholds.cpu}
                onChange={(e) => setMonitorThresholds({ cpu: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="th-ram">Host RAM %</Label>
              <Input
                id="th-ram"
                type="number"
                value={thresholds.memory}
                onChange={(e) => setMonitorThresholds({ memory: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="th-disk">Disk used %</Label>
              <Input
                id="th-disk"
                type="number"
                value={thresholds.disk}
                onChange={(e) => setMonitorThresholds({ disk: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="th-fps">Min sim FPS</Label>
              <Input
                id="th-fps"
                type="number"
                value={thresholds.fps}
                onChange={(e) => setMonitorThresholds({ fps: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="th-sus">Sustain seconds</Label>
              <Input
                id="th-sus"
                type="number"
                value={thresholds.sustainSec}
                onChange={(e) => setMonitorThresholds({ sustainSec: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Language</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">Chrome labels. World names stay as you typed them.</p>
        <div className="flex flex-wrap gap-2">
          {LOCALES.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => setOps({ locale: loc.id as Locale })}
              className={cn(
                "h-11 rounded-sm border px-4 text-sm",
                (ops?.locale ?? "en") === loc.id ? "border-primary bg-background" : "border-border hover:bg-muted",
              )}
            >
              {loc.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 font-medium">Host</h2>
        <ul className="space-y-4">
          <Toggle
            label="Start with Windows"
            hint="Palnest.exe registers as a login item. Chosen worlds with Start with Palnest boot after."
            checked={Boolean(ops?.autostart)}
            onChange={(v) => {
              setOps({ autostart: v });
              void hostAutostart(v);
            }}
          />
          <Toggle
            label="Minimize to tray"
            hint="The taskbar minimize button hides Palnest. The X button always quits and clears Task Manager."
            checked={Boolean(ops?.tray)}
            onChange={(v) => {
              setOps({ tray: v });
              void hostSetTray(v);
            }}
          />
          <Toggle
            label="Shared PalServer install"
            hint="One SteamCMD tree plus extra Saved folders. Off = a full copy per world (~10 GB)."
            checked={ops?.layout === "shared"}
            onChange={(v) => setOps({ layout: v ? "shared" : "copy" })}
          />
          <Toggle
            label="Start tunnels with worlds"
            hint="When Palnest boots with Windows, bring playit / PortWarp up too."
            checked={ops?.startTunnels !== false}
            onChange={(v) => setOps({ startTunnels: v })}
          />
          <Toggle
            label="UPnP fallback"
            hint="If you skip a tunnel, try opening UDP 8211 on the router."
            checked={Boolean(ops?.upnp)}
            onChange={(v) => {
              setOps({ upnp: v });
              void mapUpnp(server.port, v);
            }}
          />
          <Toggle
            label="Linux PalServer host"
            hint="Write PalServer.sh and LinuxServer INI paths instead of Win64."
            checked={Boolean(ops?.linuxHost)}
            onChange={(v) => setOps({ linuxHost: v })}
          />
        </ul>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="steamcmd">SteamCMD folder</Label>
            <Input
              id="steamcmd"
              value={ops?.steamcmd ?? ""}
              onChange={(e) => setOps({ steamcmd: e.target.value })}
              placeholder="C:\SteamCMD"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="webhook">Discord webhook</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="webhook"
                className="min-w-0 flex-1"
                value={ops?.webhook ?? ""}
                onChange={(e) => setOps({ webhook: e.target.value })}
                placeholder="https://discord.com/api/webhooks/…"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  const url = ops?.webhook?.trim();
                  if (!url) {
                    toast.error("Paste a Discord webhook first.");
                    return;
                  }
                  void postWebhook(url, webhookPayload("start", "Palnest test ping from this world.")).then((res) => {
                    if (res.ok) toast.success("Webhook delivered");
                    else toast.error("Webhook failed. Check the URL.");
                  });
                }}
              >
                Test ping
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Schedule</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Daily restart broadcasts first on a live box. Snapshots zip Pal\Saved and keep the newest copies. Both jobs have an on/off switch.
        </p>
        <ul className="mb-4 space-y-4">
          <Toggle
            label="Scheduled restart"
            hint="Cycle PalServer at the time below. Off keeps the clock but does not fire."
            checked={Boolean(ops?.scheduleRestartOn)}
            onChange={(v) => setOps({ scheduleRestartOn: v })}
          />
          <Toggle
            label="Scheduled backup"
            hint="Zip Pal\\Saved on the interval below. Off keeps the last snapshot."
            checked={ops?.scheduleBackupOn !== false}
            onChange={(v) => setOps({ scheduleBackupOn: v })}
          />
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="restart-at">Daily restart (HH:MM)</Label>
            <Input
              id="restart-at"
              value={ops?.scheduleRestart ?? ""}
              onChange={(e) => setOps({ scheduleRestart: e.target.value })}
              placeholder="06:00"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bak-keep">Keep last</Label>
            <Input
              id="bak-keep"
              type="number"
              value={ops?.backupKeep ?? 7}
              onChange={(e) => setOps({ backupKeep: Number(e.target.value) || 7 })}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Backup every</Label>
            <div className="flex flex-wrap gap-2">
              {BACKUP_INTERVALS.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setOps({ scheduleBackupMinutes: row.minutes, scheduleBackupHours: Math.round(row.minutes / 60) })}
                  className={cn(
                    "h-11 rounded-sm border px-3 text-sm",
                    (ops?.scheduleBackupMinutes ?? 360) === row.minutes
                      ? "border-primary bg-background"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {row.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="bak-path">Backup location</Label>
            <Input
              id="bak-path"
              value={ops?.backupPath ?? ""}
              onChange={(e) => setOps({ backupPath: e.target.value })}
              placeholder="C:\PalServers\Backups"
            />
            <p className="text-xs text-muted-foreground">
              Empty uses PalServer\PalnestBackups on that world. Palnest.exe writes the zip here.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">UE4SS channel</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">Stable is 2281fa31 for Palworld 1.0. Experimental includes GitHub prereleases.</p>
        <div className="flex flex-wrap gap-2">
          {(["stable", "experimental"] as Ue4ssChannel[]).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setOps({ ue4ssChannel: ch })}
              className={cn(
                "h-11 rounded-sm border px-4 text-sm capitalize",
                (ops?.ue4ssChannel ?? "stable") === ch ? "border-primary bg-background" : "border-border hover:bg-muted",
              )}
            >
              {ch}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">World data</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Stored in this browser. Export a Palnest.json to move worlds between PCs. Reset returns you to first-run setup.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const raw = localStorage.getItem("palnest-v14") || JSON.stringify({ state: {}, version: 0 });
              downloadText(raw, `palnest-${new Date().toISOString().slice(0, 10)}.json`);
              toast.success("Exported Palnest.json");
            }}
          >
            Export Palnest.json
          </Button>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              Import Palnest.json
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  void readFileText(file).then((text) => {
                    try {
                      const parsed = JSON.parse(text) as { state?: unknown };
                      const blob =
                        parsed && typeof parsed === "object" && parsed.state
                          ? text
                          : JSON.stringify({ state: parsed, version: 0 });
                      localStorage.setItem("palnest-v14", blob);
                      toast.success("Imported. Reloading…");
                      window.setTimeout(() => window.location.reload(), 400);
                    } catch {
                      toast.error("Not a Palnest.json file");
                    }
                  });
                }}
              />
            </label>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              loadSample();
              toast.success("Loaded Hollow Isle");
              void navigate({ to: "/" });
            }}
          >
            Load sample world
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              resetAll();
              toast("World cleared");
              void navigate({ to: "/setup" });
            }}
          >
            Reset Palnest
          </Button>
        </div>
      </section>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </li>
  );
}
