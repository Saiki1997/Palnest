import { toast } from "sonner";
import { PathField } from "@/components/path-field";
import { ScanPreview } from "@/components/scan-preview";
import { describeScan, scanListing, type ScanFile, type ScanResult } from "@/lib/scan";

export function toastScanResult(result: ScanResult, stats: { added: number; updated: number }) {
  const label = describeScan(result, stats);
  if (result.mods.some((m) => m.broken)) toast.message(label);
  else toast.success(label);
}

export function FolderScan({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  result,
  onScanned,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  result: ScanResult | null;
  onScanned: (root: string, files: ScanFile[], result: ScanResult) => void;
}) {
  return (
    <div className="grid gap-3">
      <PathField
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        hint={hint}
        onScan={(root, files) => onScanned(root, files, scanListing(root, files))}
      />
      <ScanPreview result={result} />
    </div>
  );
}