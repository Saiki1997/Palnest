import { useState } from "react";
import { Download, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  isDesktopApp,
  WINDOWS_APP_FILENAME,
  WINDOWS_APP_HREF,
  WINDOWS_RELEASES_HREF,
  WINDOWS_SETUP_FILENAME,
  WINDOWS_SETUP_HREF,
} from "@/lib/desktop";
import { savePackage, shouldUseNativeDownload } from "@/lib/desktop-download";
import { APP_LINE, APP_VERSION } from "@/lib/version";

export function DesktopGet({ compact }: { compact?: boolean }) {
  if (isDesktopApp()) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <MonitorSmartphone className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-medium">Windows app</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You are in Palnest.exe. The X button quits Palnest completely. palnest:// links open mods and join hosts. PalServer is spawned from this window.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="mb-1 flex items-center gap-2">
            <MonitorSmartphone className="size-4 text-primary" />
            <h2 className="font-medium">{compact ? "Windows app" : `Get ${APP_LINE} for Windows`}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {`Installer wizard (${WINDOWS_SETUP_FILENAME}) lets you pick the folder, a desktop shortcut, and a Start menu shortcut. Portable zip (${WINDOWS_APP_FILENAME}) extracts and runs Palnest.exe with no registry install. Version ${APP_VERSION}. If a button does nothing, use Open in a new tab — this preview pane often blocks in-page saves.`}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 lg:max-w-xs lg:items-stretch">
          <PackButton href={WINDOWS_SETUP_HREF} filename={WINDOWS_SETUP_FILENAME} label="Windows installer" primary />
          <PackButton href={WINDOWS_APP_HREF} filename={WINDOWS_APP_FILENAME} label="Portable zip" />
          <a
            href={WINDOWS_RELEASES_HREF}
            target="_blank"
            rel="noreferrer"
            className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            GitHub releases
          </a>
        </div>
      </div>
    </section>
  );
}

function PackButton({
  href,
  filename,
  label,
  primary,
}: {
  href: string;
  filename: string;
  label: string;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [ratio, setRatio] = useState(0);
  const remote = href.startsWith("http");

  return (
    <div className="min-w-0">
      <Button className="w-full" variant={primary ? "default" : "outline"} disabled={busy} asChild>
        <a
          href={href}
          download={remote ? undefined : filename}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (remote || shouldUseNativeDownload()) return;
            e.preventDefault();
            setBusy(true);
            setRatio(0);
            void savePackage(href, filename, setRatio)
              .then((how) => {
                if (how === "cancelled") return;
                toast.success(`Saved ${filename}`);
              })
              .catch((err) => {
                toast.error(err instanceof Error ? err.message : "Could not save from this window. Try Open in a new tab.");
                window.open(href, "_blank", "noopener,noreferrer");
              })
              .finally(() => {
                setBusy(false);
                setRatio(0);
              });
          }}
        >
          <Download />
          {busy ? `Saving ${Math.round(ratio * 100)}%` : label}
        </a>
      </Button>
      {busy ? <Progress value={Math.round(ratio * 100)} className="mt-2" /> : null}
    </div>
  );
}
