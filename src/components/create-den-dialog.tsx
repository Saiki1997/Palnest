import { useState } from "react";
import { toast } from "sonner";
import { PathField } from "@/components/path-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { suggestedInstallPath } from "@/lib/fleet";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type WorldMode = "new" | "clone" | "existing";

const WORLD_MODES: { id: WorldMode; label: string }[] = [
  { id: "new", label: "Fresh world" },
  { id: "clone", label: "Clone active" },
  { id: "existing", label: "Use existing" },
];

/** The single "new server" form, opened from the sidebar and the overview. */
export function CreateDenDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createServer = useAppStore((s) => s.createServer);
  const paths = useAppStore((s) => s.paths);
  const worlds = useAppStore((s) => s.worlds);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [path, setPath] = useState("");
  const [players, setPlayers] = useState("32");
  const [worldMode, setWorldMode] = useState<WorldMode>("new");
  const [worldId, setWorldId] = useState("");
  const [community, setCommunity] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setPath("");
    setPlayers("32");
    setWorldMode("new");
    setCommunity(false);
  }

  function submit() {
    const finalName = name.trim() || "New server";
    const created = createServer({
      name: finalName,
      description,
      installPath: path.trim() || suggestedInstallPath(paths.server, finalName),
      worldMode,
      worldId: worldId || worlds[0]?.id,
      maxPlayers: Number(players) || 32,
      community,
    });
    if (created.error) {
      toast.error(created.error);
      return;
    }
    toast.success(`${finalName} is ready. Start it whenever you want it live.`);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New dedicated server</DialogTitle>
          <DialogDescription>Palnest picks the next free block of ports so several PalServers can run on one PC.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="den-name">Name</Label>
              <Input
                id="den-name"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!path) setPath(suggestedInstallPath(paths.server, e.target.value || "New server"));
                }}
                placeholder="Ashfall"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="den-slots">Max players</Label>
              <Input id="den-slots" inputMode="numeric" value={players} onChange={(e) => setPlayers(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="den-desc">Description</Label>
            <Input id="den-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="PvE, no raids." />
          </div>
          <PathField
            id="den-path"
            label="PalServer folder"
            value={path}
            onChange={setPath}
            placeholder={suggestedInstallPath(paths.server, name || "Ashfall")}
            hint="A separate PalServer copy or SteamCMD install. Two running servers must not share a Saved folder."
          />
          <div className="grid gap-1.5">
            <Label>World</Label>
            <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-0.5">
              {WORLD_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={worldMode === m.id}
                  onClick={() => setWorldMode(m.id)}
                  className={cn(
                    "h-8 rounded-md text-[13px] font-medium transition-colors",
                    worldMode === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {worldMode === "existing" && worlds.length ? (
              <Select value={worldId || worlds[0]?.id} onValueChange={setWorldId}>
                <SelectTrigger aria-label="World">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {worlds.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <span>
              <span className="block text-[13px] font-medium">List in the community browser</span>
              <span className="block text-xs text-muted-foreground">Players can find it in Palworld's server list.</span>
            </span>
            <Switch checked={community} onCheckedChange={setCommunity} />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create server</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
