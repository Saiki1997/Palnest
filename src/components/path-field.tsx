import { useRef } from "react";
import { FolderOpen, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDesktopApp, pickFolder, scanInstall } from "@/lib/desktop";
import { filesToListing, type ScanFile } from "@/lib/scan";

function looksAbsolute(value: string) {
  return /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(value.trim());
}

export function PathField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  onScan,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  onScan?: (root: string, files: ScanFile[]) => void;
}) {
  const dirRef = useRef<HTMLInputElement>(null);
  const desktop = isDesktopApp();

  async function handleListing(root: string, files: ScanFile[]) {
    onChange(root);
    onScan?.(root, files);
  }

  async function scanRoot(root: string) {
    try {
      const files = await scanInstall(root);
      await handleListing(root, files);
      if (!files.length) toast.message("Folder is empty or unreadable.");
    } catch {
      toast.error("Could not scan that folder.");
    }
  }

  async function browse() {
    if (desktop) {
      const picked = await pickFolder();
      if (!picked) return;
      onChange(picked);
      if (!onScan) return;
      await scanRoot(picked);
      return;
    }
    dirRef.current?.click();
  }

  async function scanExisting() {
    const root = value.trim();
    if (!root) {
      toast.message("Pick a folder first.");
      return;
    }
    if (desktop) {
      await scanRoot(root);
      return;
    }
    dirRef.current?.click();
  }

  async function onDir(list: FileList | null) {
    const files = list ? [...list] : [];
    if (!files.length) return;
    const listing = await filesToListing(files);
    const folder = ((files[0] as File & { webkitRelativePath?: string }).webkitRelativePath || files[0].name).split(
      /[\\/]/,
    )[0];
    const root = looksAbsolute(value) ? value.trim() : folder;
    await handleListing(root, listing);
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="outline" className="shrink-0" onClick={() => void browse()}>
          <FolderOpen />
          Browse
        </Button>
        {onScan && desktop && value.trim() ? (
          <Button type="button" variant="secondary" className="shrink-0" onClick={() => void scanExisting()}>
            <ScanSearch />
            Scan
          </Button>
        ) : null}
        <input
          ref={dirRef}
          type="file"
          className="hidden"
          multiple
          // @ts-expect-error non-standard directory picker
          webkitdirectory=""
          directory=""
          onChange={(e) => {
            void onDir(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}