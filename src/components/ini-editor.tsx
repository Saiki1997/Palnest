import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SaveBar } from "@/components/save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { editorGroup, EDITOR_GROUPS, groupedEditorSettings, isEdited } from "@/lib/ini";
import { useAppStore } from "@/lib/store";
import type { WorldSetting } from "@/lib/types";
import { cn } from "@/lib/utils";

export function IniEditorPanel({ compact }: { compact?: boolean }) {
  const settings = useAppStore((s) => s.worldSettings);
  const commitWorldSettings = useAppStore((s) => s.commitWorldSettings);
  const writeDenFiles = useAppStore((s) => s.writeDenFiles);
  const resetWorldSettings = useAppStore((s) => s.resetWorldSettings);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [q, setQ] = useState("");
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [group, setGroup] = useState<(typeof EDITOR_GROUPS)[number] | "all">("all");

  const working = useMemo(
    () => settings.map((s) => (draft && draft[s.key] !== undefined ? { ...s, value: draft[s.key] } : s)),
    [settings, draft],
  );
  const dirty = Boolean(draft && Object.keys(draft).length);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return working.filter((s) => {
      if (group !== "all" && editorGroup(s) !== group) return false;
      if (modifiedOnly && !isEdited(s)) return false;
      if (!needle) return true;
      return (
        s.label.toLowerCase().includes(needle) ||
        s.key.toLowerCase().includes(needle) ||
        s.hint.toLowerCase().includes(needle)
      );
    });
  }, [working, q, modifiedOnly, group]);

  const groups = groupedEditorSettings(visible);
  const edited = working.filter((s) => isEdited(s)).length;

  function change(key: string, value: string) {
    setDraft((prev) => ({ ...(prev ?? {}), [key]: value }));
  }

  function save() {
    if (!draft) return;
    commitWorldSettings(draft);
    writeDenFiles();
    setDraft(null);
    toast.success("Saved PalWorldSettings.ini and WorldOption.sav");
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter settings" className="lg:max-w-xs" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={modifiedOnly ? "secondary" : "outline"} onClick={() => setModifiedOnly((v) => !v)}>
            Modified only
          </Button>
          <Button type="button" size="sm" variant={showKeys ? "secondary" : "outline"} onClick={() => setShowKeys((v) => !v)}>
            Show keys
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {edited ? <Badge variant="outline">{edited} differ from defaults</Badge> : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              resetWorldSettings();
              setDraft(null);
              toast.message("Reset to Palworld defaults");
            }}
          >
            Reset defaults
          </Button>
          <Button type="button" size="sm" disabled={!dirty} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>

      <div className={cn("grid gap-4", compact ? "" : "lg:grid-cols-[200px_1fr]")}>
        {compact ? null : (
          <nav className="rounded-xl border border-border bg-card p-2 h-fit">
            <button
              type="button"
              onClick={() => setGroup("all")}
              className={cn(
                "flex w-full rounded-md px-3 py-2 text-left text-sm",
                group === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              All groups
            </button>
            {EDITOR_GROUPS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setGroup(name)}
                className={cn(
                  "flex w-full rounded-md px-3 py-2 text-left text-sm",
                  group === name ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {name}
              </button>
            ))}
          </nav>
        )}
        <div>
          {groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No settings match that filter.
            </p>
          ) : (
            groups.map(([name, rows]) => (
              <section key={name} className="mb-6 last:mb-0">
                <h3 className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">{name}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {rows.map((s) => (
                    <IniField key={s.key} setting={s} showKey={showKeys} onChange={change} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
      <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(null)} hint="PalWorldSettings.ini and WorldOption.sav stay unchanged until you save." />
    </div>
  );
}

function IniField({
  setting: s,
  showKey,
  onChange,
}: {
  setting: WorldSetting;
  showKey: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const n = Number(s.value);
  const hasRange = s.type === "number" && s.min != null && s.max != null && Number.isFinite(n);
  const suffix =
    s.key.includes("Rate") || s.key.includes("Speed")
      ? "x"
      : s.key.includes("Span") || s.key.includes("minutes")
        ? "m"
        : s.key.includes("Time") && s.format === "float"
          ? "h"
          : "";
  return (
    <label className="rounded-md border border-border bg-background p-3">
      <span className="flex items-center justify-between gap-2 text-sm font-medium">
        <span className="inline-flex items-center gap-2">
          {isEdited(s) ? <span className="size-1.5 rounded-full bg-warn" /> : null}
          {s.label}
        </span>
        {s.type === "bool" ? (
          <Switch checked={s.value === "True"} onCheckedChange={(v) => onChange(s.key, v ? "True" : "False")} />
        ) : null}
      </span>
      {showKey ? <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{s.key}</span> : null}
      <span className="mt-1 block text-xs text-muted-foreground">{s.hint}</span>
      {s.type === "bool" ? null : s.type === "enum" ? (
        <select
          className="mt-2 h-10 w-full rounded-sm border border-border bg-background px-2 text-sm"
          value={s.value}
          onChange={(e) => onChange(s.key, e.target.value)}
        >
          {s.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : s.type === "number" ? (
        <span className="mt-2 block">
          {hasRange ? (
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step ?? (s.format === "int" ? 1 : 0.1)}
              value={n}
              onChange={(e) => onChange(s.key, e.target.value)}
              className="mb-2 w-full accent-primary"
            />
          ) : null}
          <span className="flex items-center gap-2">
            <Input
              value={s.format === "float" ? String(Number.isFinite(n) ? n : s.value) : s.value}
              onChange={(e) => onChange(s.key, e.target.value)}
              className="h-9 font-mono"
            />
            {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
            {isEdited(s) ? (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onChange(s.key, s.defaultValue)}
              >
                Reset
              </button>
            ) : null}
          </span>
        </span>
      ) : (
        <Input className="mt-2 h-9" value={s.value} onChange={(e) => onChange(s.key, e.target.value)} />
      )}
    </label>
  );
}
