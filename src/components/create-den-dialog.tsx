import { useState } from "react";
import { toast } from "sonner";
import { PathField } from "@/components/path-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestedInstallPath } from "@/lib/fleet";
import { useAppStore } from "@/lib/store";

export function CreateDenDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createServer = useAppStore((s) => s.createServer);
  const paths = useAppStore((s) => s.paths);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [players, setPlayers] = useState("32");

  function reset() {
    setName("");
    setPath("");
    setPlayers("32");
  }

  function submit() {
    const created = createServer({
      name: name.trim() || "New den",
      installPath: path.trim() || suggestedInstallPath(paths.server, name.trim() || "New den"),
      worldMode: "new",
      maxPlayers: Number(players) || 32,
    });
    if (created.error) {
      toast.error(created.error);
      return;
    }
    toast.success(`${name.trim() || "New den"} created`);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New dedicated server</DialogTitle>
          <DialogDescription>
            Palnest assigns the next free port block so two PalServers can run on one machine.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="dash-den-name">Name</Label>
            <Input
              id="dash-den-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!path) setPath(suggestedInstallPath(paths.server, e.target.value || "New den"));
              }}
              placeholder="Ashfall"
            />
          </div>
          <PathField
            id="dash-den-path"
            label="PalServer folder"
            value={path}
            onChange={setPath}
            placeholder={suggestedInstallPath(paths.server, name || "Ashfall")}
          />
          <div className="grid gap-2">
            <Label htmlFor="dash-den-slots">Max players</Label>
            <Input id="dash-den-slots" value={players} onChange={(e) => setPlayers(e.target.value)} />
          </div>
          <Button onClick={submit}>Create den</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
