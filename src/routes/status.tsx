import { createFileRoute, Link } from "@tanstack/react-router";
import { HydrateGate } from "@/components/hydrate";
import { JoinCard } from "@/components/join-card";
import { BrandMark, Wordmark } from "@/components/mark";
import { Badge } from "@/components/ui/badge";
import { fleetOf, runningCount } from "@/lib/fleet";
import { useAppStore } from "@/lib/store";
import { formatUptime } from "@/lib/utils";

export const Route = createFileRoute("/status")({ component: StatusRoute });

function StatusRoute() {
  return (
    <HydrateGate>
      <StatusPage />
    </HydrateGate>
  );
}

function StatusPage() {
  const onboarded = useAppStore((s) => s.onboarded);
  const server = useAppStore((s) => s.server);
  const instances = useAppStore((s) => s.instances);
  const worlds = useAppStore((s) => s.worlds);
  const fleet = fleetOf({ instances, server });
  const live = runningCount(fleet);
  const world = worlds.find((w) => w.id === server.worldId) ?? worlds.find((w) => w.active);
  const online = server.players.filter((p) => p.online);

  return (
    <div className="min-h-dvh bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark className="size-8" />
            <Wordmark withVersion />
          </Link>
          <Badge variant={live ? "ok" : "outline"}>{live ? "Live" : "Idle"}</Badge>
        </header>

        {!onboarded ? (
          <section className="rounded-xl border border-border bg-card p-8">
            <h1 className="text-2xl font-semibold">No world published</h1>
            <p className="mt-2 text-sm text-muted-foreground">Open Palnest, finish setup, then share this page with players.</p>
          </section>
        ) : (
          <>
            <section className="mb-6 rounded-xl border border-border bg-card p-6">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Public status</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{server.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{server.description || "A Palworld 1.0 world."}</p>
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">State</dt>
                  <dd className="mt-1 font-medium">{server.running ? formatUptime(server.startedAt) : "Stopped"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="mt-1 font-mono">{server.version}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Players</dt>
                  <dd className="mt-1 font-mono tabular-nums">
                    {online.length}/{server.maxPlayers}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">World</dt>
                  <dd className="mt-1 truncate">{world?.name ?? "—"}</dd>
                </div>
              </dl>
            </section>

            <JoinCard server={server} showStatusLink={false} />

            <section className="mt-6 rounded-xl border border-border bg-card p-5">
              <h2 className="font-medium">Who is on the island</h2>
              {online.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nobody connected right now.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {online.map((p) => (
                    <li key={p.playerId} className="flex items-center justify-between py-3 text-sm">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground">
                        Lv {p.level}
                        {p.guild ? ` · ${p.guild}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
