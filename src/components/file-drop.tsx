import { useState } from "react";
import { cn } from "@/lib/utils";

export function FileDrop({
  accept,
  label,
  hint,
  onFile,
  onFiles,
  multiple = false,
}: {
  accept: string;
  label: string;
  hint?: string;
  onFile?: (file: File) => void;
  onFiles?: (files: File[]) => void;
  multiple?: boolean;
}) {
  const [over, setOver] = useState(false);

  function emit(list: FileList | File[] | null | undefined) {
    const files = list ? [...list] : [];
    if (!files.length) return;
    if (onFiles) onFiles(files);
    else if (onFile) onFile(files[0]);
  }

  return (
    <label
      className={cn(
        "flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
        over ? "border-primary bg-muted" : "border-border bg-background hover:bg-muted/60",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        emit(e.dataTransfer.files);
      }}
    >
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="mt-1 max-w-md text-xs text-muted-foreground">{hint}</span> : null}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          emit(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}
