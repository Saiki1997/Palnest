import { useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { Gamepad2, Layers, Server } from "lucide-react";
import { toast } from "sonner";
import { BrandMark, Wordmark } from "@/components/mark";
import { DesktopGet } from "@/components/desktop-get";
import { FolderScan } from "@/components/folder-scan";
import { SetupStep, UpcomingSteps } from "@/components/setup-guide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HydrateGate } from "@/components/hydrate";
import { parseOptionSettings } from "@/lib/ini";
import { findSettingsIni, type ScanFile, type ScanResult } from "@/lib/scan";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { AppMode } from "@/lib/types";

export const Route = createFileRoute("/setup")({ component: SetupRoute });

function SetupRoute() {
  return (
    <HydrateGate>
      <SetupPage />
    </HydrateGate>
  );
}

const MODES: { id: AppMode; title: string; body: string; icon: typeof Server }[] = [
  {
    id: "server",
    title: "Server only",
    body: "Run a dedicated world. The Palworld game install is optional.",
    icon: Server,
  },
  {
    id: "client",
    title: "Client only",
    body: "Manage UE4SS, PalSchema, and PAKs for the game. No dedicated box.",
    icon: Gamepad2,
  },
  {
    id: "both",
    title: "Client + server",
    body: "One world for both installs. Mods can be mirrored or kept apart.",
    icon: Layers,
  },
];

export function SetupPage() {
  const onboarded = useAppStore((s) => s.onboarded);
  const completeSetup = useAppStore((s) => s.completeSetup);
  const loadSample = useAppStore((s) => s.loadSample);
  const navigate = useNavigate();
  const [mode, setMode] = useState<AppMode>("client");
  const [client, setClient] = useState("");
  const [server, setServer] = useState("");
  const [name, setName] = useState("");
  const [ini, setIni] = useState("");
  const [clientListing, setClientListing] = useState<ScanFile[]>([]);
  const [serverListing, setServerListing] = useState<ScanFile[]>([]);
  const [clientPreview, setClientPreview] = useState<ScanResult | null>(null);
  const [serverPreview, setServerPreview] = useState<ScanResult | null>(null);

  if (onboarded) return <Navigate to="/" />;

  const needsClient = mode !== "server";
  const needsServer = mode !== "client";
  const pathStep = 2;
  const importStep = needsServer ? 3 : 0;
  const nextStep = needsServer ? 4 : 3;
  const goStep = needsServer ? 5 : 4;

  function enter() {
    completeSetup(
      mode,
      { client: client.trim(), server: server.trim() },
      name || ini ? { name, ini } : undefined,
      {
        client: needsClient ? clientListing : undefined,
        server: needsServer ? serverListing : undefined,
      },
    );
    const found =
      (needsClient ? clientPreview?.mods.length ?? 0 : 0) + (needsServer ? serverPreview?.mods.length ?? 0 : 0);
    toast.success(found ? `World is ready · ${found} mods detected on disk` : "World is ready");
    void navigate({ to: "/" });
  }

  function sample() {
    loadSample();
    toast.success("Loaded Hollow Isle");
    void navigate({ to: "/" });
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <div className="mb-10 flex items-start gap-4">
          <BrandMark className="size-16 sm:size-20" />
          <div>
            <Wordmark className="text-lg sm:text-xl" withVersion />
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Set up the desktop client</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Click through the numbered steps. Client only is the Palworld game. Server only is PalServer. You can add
              Palnest.exe from the Windows zip when you want a real window and folder Browse.
            </p>
          </div>
        </div>

        <div className="space-y-10">
          <SetupStep n={1} title="How will you use Palnest?" body="This hides pages you do not need. You can change it later in Settings.">
            <div className="grid gap-3 sm:grid-cols-3">
              {MODES.map((m) => {
                const Icon = m.icon;
                const on = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors duration-150",
                      on ? "border-primary bg-card" : "border-border bg-surface hover:bg-card",
                    )}
                  >
                    <Icon className={cn("mb-3 size-5", on ? "text-primary" : "text-muted-foreground")} />
                    <p className="font-medium">{m.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
                  </button>
                );
              })}
            </div>
          </SetupStep>

          <SetupStep
            n={pathStep}
            title="Install paths"
            body="Leave blank to add later. Browse a folder to detect UE4SS, PalSchema, and PAK mods already installed."
          >
            <div className="grid gap-4 rounded-xl border border-border bg-card p-5">
              {needsClient ? (
                <FolderScan
                  id="client-path"
                  label="Palworld game (optional)"
                  value={client}
                  onChange={(next) => {
                    setClient(next);
                    setClientListing([]);
                    setClientPreview(null);
                  }}
                  placeholder="C:\Program Files (x86)\Steam\steamapps\common\Palworld"
                  hint="Browse the Steam copy so Palnest can list mods already in ue4ss/Mods and Paks/~mods."
                  result={clientPreview}
                  onScanned={(root, files, result) => {
                    setClient(root);
                    setClientListing(files);
                    setClientPreview(result);
                  }}
                />
              ) : null}
              {needsServer ? (
                <FolderScan
                  id="server-path"
                  label="Dedicated server (optional)"
                  value={server}
                  onChange={(next) => {
                    setServer(next);
                    setServerListing([]);
                    setServerPreview(null);
                  }}
                  placeholder="C:\PalServers\HollowIsle"
                  hint="Browse the PalServer root. Detected mods join the world when you enter."
                  result={serverPreview}
                  onScanned={(root, files, result) => {
                    setServer(root);
                    setServerListing(files);
                    setServerPreview(result);
                    const found = findSettingsIni(files);
                    if (found && !ini.trim()) {
                      setIni(found);
                      const parsed = parseOptionSettings(found);
                      if (!name.trim() && parsed.ServerName) {
                        setName(parsed.ServerName.replace(/^"|"$/g, ""));
                      }
                    }
                  }}
                />
              ) : null}
            </div>
          </SetupStep>

          {needsServer ? (
            <SetupStep
              n={importStep}
              title="Import an existing server"
              body="Point at a PalServer folder you already run. Browse the folder above to detect mods; paste PalWorldSettings.ini only if it was not found."
            >
              <div className="grid gap-4 rounded-xl border border-border bg-card p-5">
                <div className="grid gap-2">
                  <Label htmlFor="world-name">World name</Label>
                  <Input
                    id="world-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Hollow Isle"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ini">PalWorldSettings.ini (optional)</Label>
                  <Textarea
                    id="ini"
                    value={ini}
                    onChange={(e) => setIni(e.target.value)}
                    placeholder={'[/Script/Pal.PalGameWorldSettings]\nOptionSettings=(ServerName="Hollow Isle",ServerPlayerMaxNum=32)'}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </SetupStep>
          ) : null}

          <SetupStep
            n={nextStep}
            title="After you enter the world"
            body="The same list stays on Home until you finish or hide it."
          >
            <div className="rounded-xl border border-border bg-card p-5">
              <UpcomingSteps mode={mode} />
            </div>
          </SetupStep>

          <SetupStep n={goStep} title="Enter the world">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" onClick={enter}>
                Enter the world
              </Button>
              <Button size="lg" variant="outline" onClick={sample}>
                Load sample world
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Sample includes Hollow Isle, mixed mods, and a few broken packs to check.
            </p>
          </SetupStep>

          <DesktopGet />
        </div>
      </div>
    </div>
  );
}
