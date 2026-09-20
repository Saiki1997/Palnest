import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";

export function GuildPanel() {
  const server = useAppStore((s) => s.server);
  const worlds = useAppStore((s) => s.worlds);
  const worldSaves = useAppStore((s) => s.worldSaves);
  const upsertSaveGuild = useAppStore((s) => s.upsertSaveGuild);
  const removeSaveGuild = useAppStore((s) => s.removeSaveGuild);
  const addGuildMember = useAppStore((s) => s.addGuildMember);
  const removeGuildMember = useAppStore((s) => s.removeGuildMember);
  const writeDenFiles = useAppStore((s) => s.writeDenFiles);
  const [newName, setNewName] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});

  const world = worlds.find((w) => w.id === server.worldId) ?? worlds.find((w) => w.active);
  const save = world ? worldSaves[world.id] : undefined;
  const players = save?.players ?? [];
  const guilds = save?.guilds ?? [];

  const membersOf = useMemo(() => {
    const map = new Map<string, typeof players>();
    for (const g of guilds) {
      const ids = new Set(g.memberIds ?? []);
      map.set(
        g.id,
        players.filter((p) => ids.has(p.id) || p.guild === g.name),
      );
    }
    return map;
  }, [guilds, players]);

  if (!world) {
    return <p className="text-sm text-muted-foreground">Create a world first.</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New guild name" className="max-w-xs" />
        <Button
          onClick={() => {
            const name = newName.trim();
            if (!name) {
              toast.error("Name the guild");
              return;
            }
            upsertSaveGuild(world.id, { id: `g-${name.toLowerCase().replace(/\s+/g, "-")}`, name, owner: "—", members: 0, memberIds: [], bases: 0 });
            writeDenFiles();
            setNewName("");
            toast.success(`${name} created`);
          }}
        >
          Add guild
        </Button>
      </div>
      {guilds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No guilds in this world yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {guilds.map((g) => {
            const members = membersOf.get(g.id) ?? [];
            const outsiders = players.filter((p) => p.guild !== g.name);
            return (
              <article key={g.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{g.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Owner {g.owner} · {members.length} member{members.length === 1 ? "" : "s"} · {g.bases} base{g.bases === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      for (const m of members) removeGuildMember(world.id, g.id, m.id);
                      removeSaveGuild(world.id, g.id);
                      writeDenFiles();
                      toast.message(`${g.name} deleted`);
                    }}
                  >
                    Delete guild
                  </Button>
                </div>
                <ul className="mt-3 divide-y divide-border">
                  {members.length === 0 ? (
                    <li className="py-2 text-sm text-muted-foreground">No members.</li>
                  ) : (
                    members.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="text-sm">
                          {p.name} <span className="text-muted-foreground">Lv {p.level}</span>
                          {p.online ? (
                            <Badge variant="ok" className="ml-2">
                              Online
                            </Badge>
                          ) : null}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => { removeGuildMember(world.id, g.id, p.id); writeDenFiles(); toast.message(`Removed ${p.name}`); }}>
                          Remove member
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    className="h-9 rounded-sm border border-border bg-background px-2 text-sm"
                    value={pick[g.id] ?? ""}
                    onChange={(e) => setPick((prev) => ({ ...prev, [g.id]: e.target.value }))}
                  >
                    <option value="">Add a player…</option>
                    {outsiders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.guild ? `(${p.guild})` : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const pid = pick[g.id];
                      if (!pid) {
                        toast.error("Pick a player");
                        return;
                      }
                      addGuildMember(world.id, g.id, pid);
                      writeDenFiles();
                      toast.success("Member added");
                    }}
                  >
                    Add member
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
