import { useMemo, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Boxes,
  Cable,
  Compass,
  LayoutGrid,
  Menu,
  Plus,
  Puzzle,
  ScrollText,
  Server,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Globe2,
} from "lucide-react";
import { BrandMark } from "@/components/mark";
import { CreateDenDialog } from "@/components/create-den-dialog";
import { MonitorTicker } from "@/components/monitor-ticker";
import { RuntimeBridge } from "@/components/runtime-bridge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAppStore } from "@/lib/store";
import { runChecker } from "@/lib/checker";
import { fleetOf, runningCount } from "@/lib/fleet";
import { t } from "@/lib/i18n";
import { APP_NAME, APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import type { AppMode } from "@/lib/types";

const PRIMARY = [
  { to: "/", key: "home", icon: LayoutGrid, modes: ["client", "server", "both"] as AppMode[] },
  { to: "/settings", key: "settings", icon: Settings, modes: ["client", "server", "both"] as AppMode[] },
];

const TOOLS = [
  { to: "/mods", key: "mods", icon: Boxes, modes: ["client", "server", "both"] as AppMode[] },
  { to: "/discover", key: "discover", icon: Compass, modes: ["client", "server", "both"] as AppMode[] },
  { to: "/frameworks", key: "frameworks", icon: Puzzle, modes: ["client", "server", "both"] as AppMode[] },
  { to: "/server", key: "server", icon: Server, modes: ["server", "both"] as AppMode[] },
  { to: "/tunnels", key: "tunnels", icon: Cable, modes: ["server", "both"] as AppMode[] },
  { to: "/monitor", key: "monitor", icon: Activity, modes: ["server", "both"] as AppMode[] },
  { to: "/worlds", key: "worlds", icon: Globe2, modes: ["server", "both"] as AppMode[] },
  { to: "/optimize", key: "optimize", icon: SlidersHorizontal, modes: ["client", "server", "both"] as AppMode[] },
  { to: "/checker", key: "checker", icon: ShieldAlert, modes: ["client", "server", "both"] as AppMode[] },
  { to: "/logs", key: "logs", icon: ScrollText, modes: ["client", "server", "both"] as AppMode[] },
];

const DISCORD = "https://discord.gg/palworld";

function DiscordMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M19.27 5.33A16.6 16.6 0 0 0 15.73 4a11 11 0 0 0-.53 1.07 15.3 15.3 0 0 0-6.4 0A11 11 0 0 0 8.27 4a16.5 16.5 0 0 0-3.55 1.34C2.18 9.05 1.47 12.67 1.82 16.23a16.7 16.7 0 0 0 5.06 2.55c.4-.55.76-1.13 1.07-1.74a10.8 10.8 0 0 1-1.69-.81c.14-.1.28-.21.41-.32 3.27 1.54 6.82 1.54 10.05 0 .14.11.28.22.41.32-.54.32-1.11.59-1.7.81.31.61.67 1.19 1.07 1.74a16.6 16.6 0 0 0 5.07-2.55c.42-4.14-.71-7.73-2.8-10.9ZM8.95 14.4c-.98 0-1.78-.9-1.78-2s.78-2.01 1.78-2.01 1.8.91 1.78 2-.8 2.01-1.78 2.01Zm6.1 0c-.98 0-1.78-.9-1.78-2s.78-2.01 1.78-2.01 1.8.91 1.78 2-.8 2.01-1.78 2.01Z"
      />
    </svg>
  );
}

function navFor(mode: AppMode, list: typeof PRIMARY) {
  return list.filter((n) => n.modes.includes(mode));
}

function NavLink({
  to,
  label,
  icon: Icon,
  collapsed,
  onClick,
}: {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to as "/"}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150",
        collapsed && "justify-center px-0",
        active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {collapsed ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </Link>
  );
}

function SideNav({
  onNavigate,
  onNew,
}: {
  onNavigate?: () => void;
  onNew?: () => void;
}) {
  const mode = useAppStore((s) => s.mode);
  const locale = useAppStore((s) => s.ops?.locale ?? "en");
  const instances = useAppStore((s) => s.instances);
  const server = useAppStore((s) => s.server);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const selectServer = useAppStore((s) => s.selectServer);
  const primary = useMemo(() => navFor(mode, PRIMARY), [mode]);
  const tools = useMemo(() => navFor(mode, TOOLS), [mode]);
  const fleet = fleetOf({ instances, server });
  const showServer = mode !== "client";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Link to="/" onClick={onNavigate} className="mb-5 flex items-center gap-2 px-2">
        <BrandMark className="size-9" />
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Server manager</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {primary
          .filter((item) => item.to === "/")
          .map((item) => (
            <NavLink key={item.to} to={item.to} label={t(locale, item.key)} icon={item.icon} onClick={onNavigate} />
          ))}
        {showServer && onNew ? (
          <button
            type="button"
            onClick={onNew}
            className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <Plus className="size-4 shrink-0" />
            {t(locale, "newServer")}
          </button>
        ) : null}
        {primary
          .filter((item) => item.to !== "/")
          .map((item) => (
            <NavLink key={item.to} to={item.to} label={t(locale, item.key)} icon={item.icon} onClick={onNavigate} />
          ))}
      </nav>

      {showServer ? (
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <p className="mb-2 px-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">Servers</p>
          <ul className="flex flex-col gap-1">
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
                      "flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium",
                      active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Server className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{inst.name}</span>
                    <span className={cn("size-2 shrink-0 rounded-full", inst.running ? "bg-ok" : "bg-muted-foreground/40")} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 px-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">Tools</p>
            <nav className="flex flex-col gap-0.5">
              {tools.map((item) => (
                <NavLink key={item.to} to={item.to} label={t(locale, item.key)} icon={item.icon} onClick={onNavigate} />
              ))}
            </nav>
          </div>
        </div>
      ) : (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <p className="mb-2 px-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">Tools</p>
          <nav className="flex flex-col gap-0.5">
            {tools.map((item) => (
              <NavLink key={item.to} to={item.to} label={t(locale, item.key)} icon={item.icon} onClick={onNavigate} />
            ))}
          </nav>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-3 flex items-center gap-2 px-3 text-xs text-muted-foreground">
          <span>
            {APP_NAME}
            <span className="ml-2 font-mono">v{APP_VERSION}</span>
          </span>
          <span className="size-2 rounded-full bg-ok" />
        </p>
        <a
          href={DISCORD}
          target="_blank"
          rel="noreferrer"
          className="mx-1 inline-flex h-9 w-[calc(100%-0.5rem)] items-center justify-center gap-1.5 rounded-sm bg-discord px-2 text-xs font-medium text-discord-foreground hover:opacity-90"
        >
          <DiscordMark className="size-3.5" />
          Discord
        </a>
      </div>
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const findings = useMemo(
    () => runChecker({ mods, mode, gameVersion: server.version, frameworks }),
    [mods, mode, server.version, frameworks],
  );
  const errors = findings.filter((f) => f.severity === "error").length;
  const [sheet, setSheet] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const showServer = mode !== "client";
  const fleet = fleetOf({ instances, server });
  const live = runningCount(fleet);
  const home = pathname === "/";
  const mobileItems = (showServer ? TOOLS : PRIMARY)
    .concat(PRIMARY)
    .filter((i, idx, all) => all.findIndex((x) => x.to === i.to) === idx)
    .filter((i) =>
      (mode === "client"
        ? ["/", "/mods", "/discover", "/frameworks", "/checker"]
        : ["/", "/mods", "/monitor", "/server", "/checker"]
      ).includes(i.to),
    )
    .filter((n) => n.modes.includes(mode))
    .slice(0, 5);

  return (
    <div className={cn("min-h-dvh text-foreground", home ? "dash-hero" : "bg-background")}>
      <RuntimeBridge />
      <MonitorTicker />
      <CreateDenDialog open={createOpen} onOpenChange={setCreateOpen} />
      <div className="flex min-h-dvh">
        <aside className="glass-panel hidden w-60 shrink-0 flex-col overflow-hidden border-r border-border p-4 lg:flex">
          <SideNav onNew={showServer ? () => setCreateOpen(true) : undefined} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              "flex h-14 shrink-0 items-center gap-3 border-b border-border/80 px-3 sm:px-5",
              home && "lg:hidden",
            )}
          >
            <Sheet open={sheet} onOpenChange={setSheet}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto pt-12">
                <SideNav onNavigate={() => setSheet(false)} onNew={showServer ? () => { setSheet(false); setCreateOpen(true); } : undefined} />
              </SheetContent>
            </Sheet>
            <span className="text-sm font-semibold tracking-tight lg:hidden">{APP_NAME}</span>
            <Badge variant="outline" className="hidden sm:inline-flex">
              v{APP_VERSION}
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              {errors > 0 ? (
                <Link to="/checker">
                  <Badge variant="danger">{errors} to fix</Badge>
                </Link>
              ) : (
                <Badge variant="ok">Healthy</Badge>
              )}
              {showServer ? (
                <span className="hidden items-center gap-2 text-sm sm:flex">
                  <span className={cn("size-2 rounded-full", live > 0 ? "bg-ok" : "bg-muted-foreground/50")} />
                  <span className="text-muted-foreground">{live} active</span>
                </span>
              ) : null}
            </div>
          </header>

          <main className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-8", home && "lg:pt-8")}>
            <Outlet />
          </main>
        </div>
      </div>

      {showServer ? (
        <Button
          size="icon"
          className="fixed right-5 bottom-20 z-30 hidden rounded-full shadow-border lg:flex lg:bottom-8"
          aria-label={t(locale, "newServer")}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-5" />
        </Button>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-sm lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-1">
          {mobileItems.map((item) => (
            <NavLink key={item.to} to={item.to} label={t(locale, item.key)} icon={item.icon} collapsed />
          ))}
        </div>
      </nav>
    </div>
  );
}
