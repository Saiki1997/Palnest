import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fetchPalSchemaReleases, fetchUe4ssReleases } from "@/lib/releases";
import { useAppStore } from "@/lib/store";
import { formatBytes, formatStamp, cn } from "@/lib/utils";
import type { InstallTarget, RemoteRelease } from "@/lib/types";

export const Route = createFileRoute("/_app/frameworks")({ component: FrameworksPage });

function FrameworksPage() {
  const mode = useAppStore((s) => s.mode);
  const frameworks = useAppStore((s) => s.frameworks);
  const installFramework = useAppStore((s) => s.installFramework);
  const ops = useAppStore((s) => s.ops);
  const setOps = useAppStore((s) => s.setOps);
  const [ue4ss, setUe4ss] = useState<RemoteRelease[]>([]);
  const [schema, setSchema] = useState<RemoteRelease[]>([]);
  const [ueNote, setUeNote] = useState("Checking GitHub…");
  const [schemaNote, setSchemaNote] = useState("Checking GitHub…");
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    void fetchUe4ssReleases().then((res) => {
      if (!live) return;
      setUe4ss(res.releases);
      setUeNote(res.ok ? "Latest from Okaetsu/RE-UE4SS" : res.error || "Cached Palworld build");
    });
    void fetchPalSchemaReleases().then((res) => {
      if (!live) return;
      setSchema(res.releases);
      setSchemaNote(res.ok ? "Latest from Okaetsu/PalSchema" : res.error || "Cached PalSchema");
    });
    return () => {
      live = false;
    };
  }, []);

  const channel = ops?.ue4ssChannel ?? "stable";
  const ueList = channel === "experimental" ? ue4ss : ue4ss.filter((r) => !r.prerelease);
  const latestUe =
    ueList.find(
      (r) =>
        /palworld/i.test(`${r.name} ${r.tag} ${r.body}`) ||
        r.assets.some((a) => /palworld/i.test(a.name)),
    ) || ueList[0];
  const latestSchema = schema[0];
  const palworldZip =
    latestUe?.assets.find((a) => /palworld/i.test(a.name) && !/dev/i.test(a.name)) || latestUe?.assets[0];

  function install(
    id: "ue4ss" | "palschema" | "reshade" | "optiscaler",
    side: InstallTarget,
    version: string,
    asset: string,
  ) {
    const key = `${id}-${side}`;
    setProgress((p) => ({ ...p, [key]: 8 }));
    let v = 8;
    const t = window.setInterval(() => {
      v = Math.min(100, v + 12 + Math.random() * 10);
      setProgress((p) => ({ ...p, [key]: v }));
      if (v >= 100) {
        window.clearInterval(t);
        installFramework(id, side, version, asset);
        toast.success(`${id === "ue4ss" ? "UE4SS" : id === "palschema" ? "PalSchema" : id} ${version} installed`);
      }
    }, 180);
  }

  const showClient = mode !== "server";
  const showServer = mode !== "client";
  const ue = frameworks.ue4ss;
  const ps = frameworks.palschema;

  return (
    <div>
      <PageHeader
        title="Frameworks"
        description="One click fetches the Palworld 1.0 UE4SS zip from GitHub. PalSchema, ReShade, and OptiScaler sit beside it."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["stable", "experimental"] as const).map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => setOps({ ue4ssChannel: ch })}
            className={cn(
              "h-11 rounded-sm border px-4 text-sm capitalize",
              channel === ch ? "border-primary bg-card" : "border-border hover:bg-muted",
            )}
          >
            {ch} UE4SS
          </button>
        ))}
      </div>
      <div className="grid gap-4">
        <article className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">UE4SS</h2>
                <Badge variant="primary">Required for Lua</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Palworld 1.0 needs the Palworld-forked UE4SS, not the generic 3.0.1 zip. Use Okaetsu/RE-UE4SS
                experimental-palworld (2281fa31 with PalSchema 0.6.71). Drop UE4SS-Palworld.zip into Pal/Binaries/Win64.
                Do not stack it with the Steam Workshop copy.
              </p>
              <p className="mt-3 text-sm">
                Latest: <span className="font-mono">{latestUe?.tag ?? ue.latestKnown ?? "—"}</span>
                {palworldZip ? ` · ${palworldZip.name} (${formatBytes(palworldZip.size / 1024)})` : null}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ueNote}
                {latestUe?.publishedAt ? ` · ${formatStamp(latestUe.publishedAt)}` : null}
              </p>
              {latestUe?.body ? (
                <p className="mt-3 line-clamp-4 text-sm text-muted-foreground whitespace-pre-wrap">{latestUe.body}</p>
              ) : null}
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-64">
              <p className="text-xs text-muted-foreground">
                Client {ue.clientVersion ?? "missing"} · Server {ue.serverVersion ?? "missing"}
              </p>
              {showClient ? (
                <InstallButton
                  label="Install on client"
                  progress={progress["ue4ss-client"]}
                  onClick={() =>
                    install("ue4ss", "client", latestUe?.tag || "2281fa31", palworldZip?.name || "UE4SS-Palworld.zip")
                  }
                />
              ) : null}
              {showServer ? (
                <InstallButton
                  label="Install on server"
                  progress={progress["ue4ss-server"]}
                  onClick={() =>
                    install("ue4ss", "server", latestUe?.tag || "2281fa31", palworldZip?.name || "UE4SS-Palworld.zip")
                  }
                />
              ) : null}
              {showClient && showServer ? (
                <InstallButton
                  label="Install on both"
                  progress={progress["ue4ss-both"]}
                  onClick={() =>
                    install("ue4ss", "both", latestUe?.tag || "2281fa31", palworldZip?.name || "UE4SS-Palworld.zip")
                  }
                />
              ) : null}
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">PalSchema</h2>
                <Badge variant="outline">JSON packs</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Lives under ue4ss/Mods/PalSchema. Palworld 1.0 packs go in its mods folder, not loose in ~mods. PalSchema
                0.6.71 must sit on UE4SS 2281fa31.
              </p>
              <p className="mt-3 text-sm">
                Latest: <span className="font-mono">{latestSchema?.tag ?? ps.latestKnown ?? "—"}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{schemaNote}</p>
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-64">
              <p className="text-xs text-muted-foreground">
                Client {ps.clientVersion ?? "missing"} · Server {ps.serverVersion ?? "missing"}
              </p>
              {showClient ? (
                <InstallButton
                  label="Install on client"
                  progress={progress["palschema-client"]}
                  onClick={() =>
                    install("palschema", "client", latestSchema?.tag || "0.6.71", "PalSchema.zip")
                  }
                />
              ) : null}
              {showServer ? (
                <InstallButton
                  label="Install on server"
                  progress={progress["palschema-server"]}
                  onClick={() =>
                    install("palschema", "server", latestSchema?.tag || "0.6.71", "PalSchema.zip")
                  }
                />
              ) : null}
            </div>
          </div>
        </article>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold tracking-tight">ReShade</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Client visual stack. Never install on the dedicated box.
            </p>
            <p className="mt-3 text-sm">Client {frameworks.reshade.clientVersion ?? "not installed"}</p>
            {showClient ? (
              <div className="mt-4">
                <InstallButton
                  label="Install ReShade 6.5.1"
                  progress={progress["reshade-client"]}
                  onClick={() => install("reshade", "client", "6.5.1", "ReShade_Setup.exe")}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Hidden in server-only mode.</p>
            )}
          </article>
          <article className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold tracking-tight">OptiScaler</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Upscaling for the game client. Conflicts with some ReShade injectors — Palnest will warn.
            </p>
            <p className="mt-3 text-sm">Client {frameworks.optiscaler.clientVersion ?? "not installed"}</p>
            {showClient ? (
              <div className="mt-4">
                <InstallButton
                  label="Install OptiScaler"
                  progress={progress["optiscaler-client"]}
                  onClick={() => install("optiscaler", "client", "0.7.9", "OptiScaler.zip")}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Hidden in server-only mode.</p>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}

function InstallButton({
  label,
  progress,
  onClick,
}: {
  label: string;
  progress?: number;
  onClick: () => void;
}) {
  const running = progress !== undefined && progress < 100;
  return (
    <div>
      <Button className="w-full" variant="outline" disabled={running} onClick={onClick}>
        {running ? "Fetching zip…" : label}
      </Button>
      {progress !== undefined && progress < 100 ? <Progress className="mt-2" value={progress} /> : null}
    </div>
  );
}
