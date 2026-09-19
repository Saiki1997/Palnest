import { useState } from "react";
import { toast } from "sonner";
import { FolderScan, toastScanResult } from "@/components/folder-scan";
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
import { Textarea } from "@/components/ui/textarea";
import { parseOptionSettings } from "@/lib/ini";
import { describeScan, findSettingsIni, type ScanFile, type ScanResult } from "@/lib/scan";
import { fleetOf } from "@/lib/fleet";
import { useAppStore } from "@/lib/store";

export function ImportServerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importServer = useAppStore((s) => s.importServer);
  const paths = useAppStore((s) => s.paths);
  const instances = useAppStore((s) => s.instances);
  const server = useAppStore((s) => s.server);
  const fleet = fleetOf({ instances, server });
  const [path, setPath] = useState(paths.server);
  const [name, setName] = useState("");
  const [ini, setIni] = useState("");
  const [detect, setDetect] = useState(true);
  const [asNew, setAsNew] = useState(fleet.length > 0 && Boolean(server.installPath || server.imported));
  const [listing, setListing] = useState<ScanFile[]>([]);
  const [preview, setPreview] = useState<ScanResult | null>(null);

  function reset() {
    setPath(paths.server);
    setName("");
    setIni("");
    setDetect(true);
    setListing([]);
    setPreview(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import existing server</DialogTitle>
          <DialogDescription>
            Point Palnest at a PalServer folder you already run. Browse so it can list PalServer.exe, UE4SS, PalSchema, and PAK mods already on disk.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <FolderScan
            id="dash-imp-path"
            label="PalServer folder"
            value={path}
            onChange={(next) => {
              setPath(next);
              setListing([]);
              setPreview(null);
            }}
            placeholder="C:\PalServers\HollowIsle"
            hint="Browse the PalServer root (the folder that contains Pal), not a single .exe."
            result={detect ? preview : null}
            onScanned={(root, files, result) => {
              setPath(root);
              setListing(files);
              setPreview(result);
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
          <div className="grid gap-2">
            <Label htmlFor="dash-imp-name">Display name</Label>
            <Input id="dash-imp-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dash-imp-ini">PalWorldSettings.ini</Label>
            <Textarea
              id="dash-imp-ini"
              className="font-mono text-xs"
              value={ini}
              onChange={(e) => setIni(e.target.value)}
              placeholder="OptionSettings=(ServerName=...)"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={detect} onChange={(e) => setDetect(e.target.checked)} />
            Add detected mods to this world
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asNew} onChange={(e) => setAsNew(e.target.checked)} />
            Import as a new world (keep the current one)
          </label>
          <Button
            onClick={() => {
              if (!path.trim()) {
                toast.error("Path is required");
                return;
              }
              if (detect && !listing.length) {
                toast.message("Browse the PalServer folder so Palnest can see mods already installed.");
              }
              const stats = importServer({
                path: path.trim(),
                name: name.trim() || "Imported world",
                ini,
                detectMods: detect,
                listing: detect ? listing : undefined,
                asNew,
              });
              if (detect && preview && (stats.added || stats.updated)) {
                toastScanResult(preview, stats);
              } else if (detect && preview) {
                toast.success(describeScan(preview, stats));
              } else {
                toast.success(asNew ? "Imported as a new world" : "Server imported");
              }
              reset();
              onOpenChange(false);
            }}
          >
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
