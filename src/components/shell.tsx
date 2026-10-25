import { useMemo, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  Cable,
  Compass,
  Globe2,
  LayoutGrid,
  Menu,
  Monitor,
  Moon,
  Play,
  Plus,
  Puzzle,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/mark";
import { CreateDenDialog } from "@/components/create-den-dialog";
import { MonitorTicker } from "@/components/monitor-ticker";
import { RuntimeBridge } from "@/components/runtime-bridge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/lib/store";
import { runChecker } from "@/lib/checker";
import { isDesktopApp } from "@/lib/desktop";
import { fleetOf, runningCount } from "@/lib/fleet";
import { t } from "@/lib/i18n";
import { setTheme, useThemeChoice, type ThemeChoice } from "@/lib/theme";
import { APP_NAME, APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import type { AppMode, ServerState } from "@/lib/types";

type NavItem = { to: string; key: string; icon: typeof LayoutGrid; modes: AppMode[] };

const ALL: AppMode[] = ["client", "server", "both"];
const DEDICATED: AppMode[] = ["server", "both"];

const MANAGE: NavItem[] = [
  { to: "/server", key: "server", icon: Server, modes: DEDICATED },
  { to: "/worlds", key: "worlds", icon: Globe2, modes: DEDICATED },
  { to: "/mods", key: "mods", icon: Boxes, modes: ALL },
  { to: "/discover", key: "discover", icon: Compass, modes: ALL },
  { to: "/frameworks", key: "frameworks", icon: Puzzle, modes: ALL },
  { to: "/tunnels", key: "tunnels", icon: Cable, modes: DEDICATED },
];

const DIAGNOSE: NavItem[] = [
  { to: "/optimize", key: "optimize", icon: SlidersHorizontal, modes: ALL },
  { to: "/logs", key: "logs", icon: ScrollText, modes: ALL },
  { to: "/checker", key: "checker", icon: ShieldCheck, modes: ALL },
];

const HOME: NavItem = { to: "/", key: "home", icon: LayoutGrid, modes: ALL };
const SETTINGS: NavItem = { to: "/settings", key: "settings", icon: Settings, modes: ALL };

const MOBILE: Record<"client" | "dedicated", string[]> = {
  client: ["/", "/mods", "/discover", "/frameworks", "/settings"],
  dedicated: ["/", "/server", "/worlds", "/mods", "/settings"],
};

function useActive(to: string) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
}

function NavLink({ item, label, badge, onClick }: { item: NavItem; label: string; badge?: number; onClick?: () => void }) {
  const active = useActive(item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to as "/"}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span className="rounded bg-danger/15 px-1.5 text-[11px] font-semibold leading-4 text-danger tabular-nums">{badge}</span>
      ) : null}
    </Link>
  );
}

function StatusDot({ inst }: { inst: Pick<ServerState, "running" | "listenAt"> }) {
  const binding = inst.running && !inst.listenAt;
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        !inst.running ? "bg-muted-foreground/40" : binding ? "animate-pulse bg-warn" : "bg-ok",
      )}
      aria-label={!inst.running ? "Stopped" : binding ? "Starting" : "Running"}
    />
  );
}

function ThemeSwitch() {
  const choice = useThemeChoice();
  const options: { id: ThemeChoice; icon: typeof Sun; label: string }[] = [
    { id: "system", icon: Monitor, label: "Match Windows" },
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-md bg-muted p-0.5">
      {options.map(({ id, icon: Icon, label }) => (
        <Tooltip key={id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              role="radio"
              aria-checked={choice === id}
              aria-label={label}
              onClick={() => setTheme(id)}
              className={cn(
                "flex size-6 items-center justify-center rounded transition-colors",
                choice === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function SideNav({ onNavigate, onNew, errors }: { onNavigate?: () => void; onNew?: () => void; errors: number }) {
  const mode = useAppStore((s) => s.mode);
  const locale = useAppStore((s) => s.ops?.locale ?? "en");
  const instances = useAppStore((s) => s.instances);
  const server = useAppStore((s) => s.server);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const selectServer = useAppStore((s) => s.selectServer);
  const fleet = fleetOf({ instances, server });
  const dedicated = mode !== "client";
  const manage = useMemo(() => MANAGE.filter((n) => n.modes.includes(mode)), [mode]);
  const diagnose = useMemo(() => DIAGNOSE.filter((n) => n.modes.includes(mode)), [mode]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Link to="/" onClick={onNavigate} className="mb-4 flex items-center gap-2.5 px-1.5 py-1">
        <BrandMark className="size-7 rounded-lg" />
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-semibold">{APP_NAME}</span>
          <span className="block text-[11px] text-muted-foreground">Palworld server manager</span>
        </span>
      </Link>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <nav className="space-y-0.5">
          <NavLink item={HOME} label={t(locale, HOME.key)} onClick={onNavigate} />
        </nav>

        {dedicated ? (
          <section>
            <div className="mb-1 flex items-center justify-between pr-1 pl-2.5">
              <p className="eyebrow">Servers</p>
              {onNew ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={onNew}
                      aria-label={t(locale, "newServer")}
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t(locale, "newServer")}</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            <ul className="space-y-0.5">
              {fleet.map((inst) => {
                const active = inst.id === (activeServerId || server.id);
                return (
                  <li key={inst.id}>
                    <button
                      type="button"
                      onClick={() => {
                        selectServer(inst.id);
                        onNavigate?.();
                      }}
                      className={cn(
                        "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium transition-colors",
                        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <StatusDot inst={inst} />
                      <span className="min-w-0 flex-1 truncate">{inst.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{inst.port}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section>
          <p className="eyebrow mb-1 pl-2.5">Manage</p>
          <nav className="space-y-0.5">
            {manage.map((item) => (
              <NavLink key={item.to} item={item} label={t(locale, item.key)} onClick={onNavigate} />
            ))}
          </nav>
        </section>

        <section>
          <p className="eyebrow mb-1 pl-2.5">Tune &amp; diagnose</p>
          <nav className="space-y-0.5">
            {diagnose.map((item) => (
              <NavLink
                key={item.to}
                item={item}
                label={t(locale, item.key)}
                badge={item.to === "/checker" ? errors : undefined}
                onClick={onNavigate}
              />
            ))}
          </nav>
        </section>
      </div>

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <NavLink item={SETTINGS} label={t(locale, SETTINGS.key)} onClick={onNavigate} />
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="font-mono text-[11px] text-muted-foreground">v{APP_VERSION}</span>
          <ThemeSwitch />
        </div>
      </div>
    </div>
  );
}

/** Start/stop for the selected server, always one click away in the top bar. */
function ActiveServerControl() {
  const instances = useAppStore((s) => s.instances);
  const server = useAppStore((s) => s.server);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const startServer = useAppStore((s) => s.startServer);
  const stopServer = useAppStore((s) => s.stopServer);
  const inst = fleetOf({ instances, server }).find((i) => i.id === (activeServerId || server.id));
  if (!inst) return null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link to="/server" search={{ tab: "ops" }} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-[13px] hover:bg-muted">
        <StatusDot inst={inst} />
        <span className="truncate font-medium">{inst.name}</span>
        <span className="hidden text-muted-foreground sm:inline">
          {!inst.running ? "Stopped" : inst.listenAt ? "Running" : "Starting"}
        </span>
      </Link>
      {inst.running ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            stopServer(inst.id);
            toast.message(`${inst.name} stopped`);
          }}
        >
          <Square className="fill-current" />
          Stop
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => {
            const err = startServer(inst.id);
            if (err) toast.error(err);
            else toast.success(`${inst.name} starting`);
          }}
        >
          <Play className="fill-current" />
          Start
        </Button>
      )}
    </div>
  );
}

export function Shell() {
  const mode = useAppStore((s) => s.mode);
  const server = useAppStore((s) => s.server);
  const instances = useAppStore((s) => s.instances);
  const mods = useAppStore((s) => s.mods);
  const frameworks = useAppStore((s) => s.frameworks);
  const locale = useAppStore((s) => s.ops?.locale ?? "en");
  const findings = useMemo(
    () => runChecker({ mods, mode, gameVersion: server.version, frameworks }),
    [mods, mode, server.version, frameworks],
  );
  const errors = findings.filter((f) => f.severity === "error").length;
  const [sheet, setSheet] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const dedicated = mode !== "client";
  const fleet = fleetOf({ instances, server });
  const live = runningCount(fleet);
  const preview = !isDesktopApp();
  const mobileItems = [HOME, ...MANAGE, ...DIAGNOSE, SETTINGS]
    .filter((i) => MOBILE[dedicated ? "dedicated" : "client"].includes(i.to))
    .filter((i) => i.modes.includes(mode));
  const openNew = dedicated ? () => setCreateOpen(true) : undefined;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <RuntimeBridge />
      <MonitorTicker />
      <CreateDenDialog open={createOpen} onOpenChange={setCreateOpen} />
      <div className="flex h-dvh">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-3 lg:flex">
          <SideNav onNew={openNew} errors={errors} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {preview ? (
            <div className="flex items-center justify-center gap-2 border-b border-warn/30 bg-warn/10 px-4 py-1.5 text-center text-xs text-warn">
              Browser preview with demo data. Install the Windows app to manage real servers.
              <Link to="/settings" className="font-medium underline underline-offset-2">
                Get Palnest
              </Link>
            </div>
          ) : null}
          <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-5">
            <Sheet open={sheet} onOpenChange={setSheet}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 overflow-y-auto">
                <SideNav
                  errors={errors}
                  onNavigate={() => setSheet(false)}
                  onNew={
                    openNew
                      ? () => {
                          setSheet(false);
                          openNew();
                        }
                      : undefined
                  }
                />
              </SheetContent>
            </Sheet>
            {dedicated ? <ActiveServerControl /> : <span className="text-[13px] font-medium">Client mode</span>}
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              {dedicated ? (
                <span className="hidden items-center gap-1.5 sm:flex">
                  <span className={cn("size-1.5 rounded-full", live ? "bg-ok" : "bg-muted-foreground/50")} />
                  {live} of {fleet.length} running
                </span>
              ) : null}
              <Link
                to="/checker"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 font-medium hover:bg-muted",
                  errors ? "text-danger" : "text-ok",
                )}
              >
                <ShieldCheck className="size-3.5" />
                {errors ? `${errors} to fix` : "Healthy"}
              </Link>
            </div>
          </header>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-1.5">
          {mobileItems.map((item) => (
            <MobileLink key={item.to} item={item} label={t(locale, item.key)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function MobileLink({ item, label }: { item: NavItem; label: string }) {
  const active = useActive(item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to as "/"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md py-1 text-[10px] font-medium",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
