import { useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runChecker } from "@/lib/checker";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/_app/checker")({ component: CheckerPage });

function CheckerPage() {
  const mode = useAppStore((s) => s.mode);
  const server = useAppStore((s) => s.server);
  const mods = useAppStore((s) => s.mods);
  const frameworks = useAppStore((s) => s.frameworks);
  const applyFix = useAppStore((s) => s.applyFix);
  const log = useAppStore((s) => s.log);
  const markCheckerRan = useAppStore((s) => s.markCheckerRan);
  useEffect(() => {
    markCheckerRan();
  }, [markCheckerRan]);
  const findings = useMemo(
    () => runChecker({ mods, mode, gameVersion: server.version, frameworks }),
    [mods, mode, server.version, frameworks],
  );
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");
  const infos = findings.filter((f) => f.severity === "info");

  function fix(action: string, modId?: string, title?: string) {
    applyFix(action, modId);
    log({ level: "ok", source: "checker", message: `Applied ${action} for ${title ?? "finding"}.` });
    toast.success("Fix applied. Checker will refresh.");
  }

  return (
    <div>
      <PageHeader
        title="Mod checker"
        description="Conflict gate for PalServer start. Palworld mods rarely list a compatible game version, so Palnest looks for overlapping files, broken packs, and missing UE4SS or PalSchema — not version pins."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              log({
                level: "info",
                source: "checker",
                message: `Rescanned ${mods.length} mods for start conflicts. ${errors.length} errors, ${warns.length} warnings.`,
              });
              toast.success("Rescan complete");
            }}
          >
            Rescan now
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Score label="Conflicts / broken" value={errors.length} tone="danger" />
        <Score label="Server-side risks" value={warns.length} tone="warn" />
        <Score label="Notes" value={infos.length} tone="ok" />
      </div>

      {findings.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center">
          <p className="font-medium">No start conflicts</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No overlapping packs, missing files, or missing UE4SS / PalSchema. PalServer can start.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {findings.map((f) => (
            <li key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant={f.severity === "error" ? "danger" : f.severity === "warn" ? "warn" : "default"}>
                      {f.kind}
                    </Badge>
                    <h2 className="font-medium">{f.title}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{f.detail}</p>
                </div>
                <div className="flex gap-2">
                  {f.fixAction && f.fixLabel ? (
                    <Button size="sm" variant="outline" onClick={() => fix(f.fixAction!, f.modId, f.title)}>
                      {f.fixLabel}
                    </Button>
                  ) : null}
                  {f.fixAction === "install-ue4ss" || f.fixAction === "install-palschema" ? (
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/frameworks">Frameworks</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Score({ label, value, tone }: { label: string; value: number; tone: "danger" | "warn" | "ok" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-2 text-2xl font-medium tabular-nums ${tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ok"}`}>
        {value}
      </p>
    </div>
  );
}
