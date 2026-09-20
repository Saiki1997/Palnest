import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { joinHost, joinIp } from "@/lib/tunnels";
import type { ServerState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

async function copy(value: string, ok: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(ok);
  } catch {
    toast.message(value);
  }
}

export function JoinCard({
  server,
  compact,
  onJoinGame,
  showStatusLink = true,
}: {
  server: ServerState;
  compact?: boolean;
  onJoinGame?: () => void;
  showStatusLink?: boolean;
}) {
  const host = joinHost(server);
  const ip = joinIp(server);
  const tunneled = server.tunnel.status === "online";
  const connect = `-connect=${ip}`;

  return (
    <section className={cn("rounded-xl border border-border bg-card p-5", compact && "p-4")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">Join {server.name}</h2>
          <Badge variant={tunneled ? "ok" : "outline"}>{tunneled ? server.tunnel.provider : "LAN"}</Badge>
        </div>
        <p className="mt-2 break-all font-mono text-sm">{host}</p>
        {ip !== host ? <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{ip}</p> : null}
        <p className="mt-2 text-sm text-muted-foreground">
          {server.running && !server.listenAt
            ? `PalServer is still binding UDP ${server.port}. Older builds listen after world load — PortWarp waits so it does not miss the world.`
            : "Friends paste the host in Direct Connect. Palworld.exe can also launch with -connect."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void copy(host, "Join host copied")}>
            Copy host
          </Button>
          <Button size="sm" variant="outline" onClick={() => void copy(ip, "IP:port copied")}>
            Copy IP:port
          </Button>
          <Button size="sm" variant="outline" onClick={() => void copy(connect, "Launch flag copied")}>
            Copy -connect
          </Button>
          {onJoinGame ? (
            <Button size="sm" variant="secondary" onClick={onJoinGame}>
              Join in Palworld
            </Button>
          ) : null}
          {showStatusLink ? (
            <Button size="sm" variant="ghost" asChild>
              <Link to="/status">Public status</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
