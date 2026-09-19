import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { denGuide, guideProgress, guideShouldShow, type GuideSnapshot, type GuideStep } from "@/lib/guide";
import { cn } from "@/lib/utils";

export function SetupStep({
  n,
  title,
  body,
  done,
  children,
}: {
  n: number;
  title: string;
  body?: string;
  done?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
      <div
        className={cn(
          "mt-0.5 flex size-8 items-center justify-center rounded-full border text-sm font-medium tabular-nums",
          done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
        )}
        aria-hidden
      >
        {done ? <Check className="size-4" /> : n}
      </div>
      <div className="min-w-0">
        <h2 className="font-medium tracking-tight">{title}</h2>
        {body ? <p className="mt-1 text-sm text-muted-foreground">{body}</p> : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </section>
  );
}

function snapshotFromStore(s: GuideSnapshot): GuideStep[] {
  return denGuide(s);
}

export function DenChecklist({
  state,
  dismissed,
  onDismiss,
  compact,
}: {
  state: GuideSnapshot;
  dismissed: boolean;
  onDismiss: () => void;
  compact?: boolean;
}) {
  const steps = snapshotFromStore(state);
  if (!guideShouldShow(steps, dismissed)) return null;
  const progress = guideProgress(steps);
  const next = steps.find((s) => !s.done);

  if (compact) {
    return (
      <section className="dash-glass mb-4 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Desktop client setup</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {progress.done}/{progress.total} required
            {next ? ` · next: ${next.title}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {next?.href ? (
            <Button asChild size="sm">
              <Link to={next.href as "/"}>Continue</Link>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Hide
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-medium tracking-tight">Desktop client setup</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {progress.done}/{progress.total} required steps. Optional items can wait.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Hide
        </Button>
      </div>
      <Progress value={progress.pct} className="mb-5" />
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                step.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {step.done ? <Check className="size-3.5" /> : step.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {step.title}
                {step.optional ? <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span> : null}
              </p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
            {step.href && !step.done ? (
              <Button asChild size="sm" variant={next?.id === step.id ? "default" : "outline"} className="shrink-0">
                <Link to={step.href as "/"}>{next?.id === step.id ? "Do this" : "Open"}</Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function UpcomingSteps({ mode }: { mode: GuideSnapshot["mode"] }) {
  const steps = denGuide({
    onboarded: true,
    mode,
    paths: { client: "", server: "" },
    keys: { nexus: "", steam: "", curseforge: "" },
    frameworks: {
      ue4ss: { clientVersion: null, serverVersion: null },
      palschema: { clientVersion: null, serverVersion: null },
    },
    mods: [],
    checkerRan: false,
  }).filter((s) => s.id !== "mode");

  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.id} className="flex gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-medium tabular-nums text-muted-foreground">
            {step.n}
          </span>
          <div>
            <p className="text-sm font-medium">
              {step.title}
              {step.optional ? <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span> : null}
            </p>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
