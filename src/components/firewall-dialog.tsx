import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fleetOf } from "@/lib/fleet";
import { hostKind, hostUpnp } from "@/lib/host";
import { useAppStore } from "@/lib/store";
import type { ServerState } from "@/lib/types";

type PortRule = { label: string; port: number; proto: "UDP" | "TCP"; name: string };

function rulesFor(fleet: ServerState[]): PortRule[] {
  const seen = new Set<string>();
  const rules: PortRule[] = [];
  for (const inst of fleet) {
    const add = (label: string, port: number, proto: "UDP" | "TCP") => {
      const key = `${proto}:${port}`;
      if (!port || seen.has(key)) return;
      seen.add(key);
      rules.push({ label, port, proto, name: inst.name });
    };
    add("Game", inst.port, "UDP");
    add("Query", inst.queryPort, "UDP");
    add("REST", inst.restPort, "TCP");
    add("RCON", inst.rconPort, "TCP");
  }
  return rules;
}

function winCmd(rule: PortRule) {
  return `netsh advfirewall firewall add rule name="Palnest ${rule.label} ${rule.port}" dir=in action=allow protocol=${rule.proto} localport=${rule.port}`;
}

function ufwCmd(rule: PortRule) {
  return `ufw allow ${rule.port}/${rule.proto.toLowerCase()} comment 'Palnest ${rule.label}'`;
}

export function FirewallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const instances = useAppStore((s) => s.instances);
  const server = useAppStore((s) => s.server);
  const fleet = fleetOf({ instances, server });
  const rules = useMemo(() => rulesFor(fleet), [fleet]);
  const [busy, setBusy] = useState(false);
  const desktop = hostKind() === "desktop";

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  async function openUpnp() {
    setBusy(true);
    try {
      let ok = 0;
      for (const rule of rules.filter((r) => r.proto === "UDP")) {
        const res = await hostUpnp(rule.port, true);
        if (res.ok) ok += 1;
      }
      toast.success(
        desktop
          ? `UPnP requested for ${ok} UDP port${ok === 1 ? "" : "s"}.`
          : `Simulated UPnP map for ${ok} UDP port${ok === 1 ? "" : "s"}. Use the Windows app on the host to write real mappings.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure firewall</DialogTitle>
          <DialogDescription>
            Open game, Steam query, REST, and RCON ports for every configured PalServer node.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-2">
          {rules.map((rule) => (
            <li
              key={`${rule.proto}-${rule.port}`}
              className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">{rule.label}</span>
              <span className="font-mono tabular-nums">
                {rule.proto} {rule.port}
              </span>
            </li>
          ))}
        </ul>

        <Tabs defaultValue="windows">
          <TabsList>
            <TabsTrigger value="windows">Windows</TabsTrigger>
            <TabsTrigger value="linux">Linux</TabsTrigger>
          </TabsList>
          <TabsContent value="windows" className="mt-3">
            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">
              {rules.map(winCmd).join("\n")}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => copy(rules.map(winCmd).join("\n"))}
            >
              <Copy className="size-4" />
              Copy netsh
            </Button>
          </TabsContent>
          <TabsContent value="linux" className="mt-3">
            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">
              {rules.map(ufwCmd).join("\n")}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => copy(rules.map(ufwCmd).join("\n"))}
            >
              <Copy className="size-4" />
              Copy ufw
            </Button>
          </TabsContent>
        </Tabs>

        <Button onClick={openUpnp} disabled={busy}>
          <Shield className="size-4" />
          {busy ? "Opening…" : "Open UDP with UPnP"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
