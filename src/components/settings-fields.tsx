import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { groupedSettings, isEdited } from "@/lib/ini";
import type { WorldSetting } from "@/lib/types";

const CROSSPLAY = ["Steam", "Xbox", "PS5", "Mac"];

export function SettingsFields({
  settings,
  onChange,
  query = "",
}: {
  settings: WorldSetting[];
  onChange: (key: string, value: string) => void;
  query?: string;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? settings.filter(
        (s) =>
          s.key.toLowerCase().includes(q) ||
          s.label.toLowerCase().includes(q) ||
          s.group.toLowerCase().includes(q) ||
          s.hint.toLowerCase().includes(q),
      )
    : settings;
  const groups = groupedSettings(filtered);

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No settings match that search.</p>;
  }

  return (
    <div>
      {groups.map(([group, rows]) => (
        <div key={group} className="mb-6 last:mb-0">
          <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((s) => (
              <SettingField key={s.key} setting={s} onChange={onChange} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingField({
  setting: s,
  onChange,
}: {
  setting: WorldSetting;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <label className="rounded-md border border-border bg-background p-3">
      <span className="flex items-center justify-between gap-2 text-sm font-medium">
        {s.label}
        {isEdited(s) ? <Badge variant="outline">edited</Badge> : null}
      </span>
      <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{s.key}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{s.hint}</span>
      {s.type === "bool" ? (
        <span className="mt-2 flex items-center gap-2">
          <Switch checked={s.value === "True"} onCheckedChange={(v) => onChange(s.key, v ? "True" : "False")} />
          <span className="text-xs text-muted-foreground">{s.value}</span>
        </span>
      ) : s.type === "enum" ? (
        <select
          className="mt-2 h-11 w-full rounded-sm border border-border bg-background px-2 text-sm"
          value={s.value}
          onChange={(e) => onChange(s.key, e.target.value)}
        >
          {s.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : s.type === "array" && s.options ? (
        <span className="mt-2 flex flex-wrap gap-2">
          {s.options.map((opt) => {
            const selected = s.value
              .split(",")
              .map((v) => v.trim())
              .includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const current = s.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                  const next = selected ? current.filter((v) => v !== opt) : [...current, opt];
                  const order = s.options ?? CROSSPLAY;
                  onChange(s.key, order.filter((o) => next.includes(o)).join(","));
                }}
                className={
                  selected
                    ? "h-9 rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground"
                    : "h-9 rounded-sm border border-border px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                }
              >
                {opt}
              </button>
            );
          })}
        </span>
      ) : (
        <Input
          className="mt-2"
          type={s.type === "number" ? "number" : "text"}
          step={s.step}
          min={s.min}
          max={s.max}
          value={s.value}
          onChange={(e) => onChange(s.key, e.target.value)}
        />
      )}
    </label>
  );
}
