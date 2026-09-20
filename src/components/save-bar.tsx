import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SaveBar({
  dirty,
  onSave,
  onDiscard,
  saveLabel = "Save changes",
  hint,
  className,
}: {
  dirty: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
  hint?: string;
  className?: string;
}) {
  if (!dirty) return null;
  return (
    <div
      className={cn(
        "sticky bottom-3 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card/95 px-4 py-3 shadow-lg backdrop-blur",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{hint ?? "Unsaved changes. Nothing is written until you save."}</p>
      <div className="flex flex-wrap gap-2">
        {onDiscard ? (
          <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
            Discard
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
