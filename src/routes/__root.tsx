import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { THEME_BOOT_SCRIPT, useResolvedTheme } from "@/lib/theme";
import appCss from "../styles.css?url";

import { APP_EDITION, APP_LINE } from "@/lib/version";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_EDITION },
      { name: "theme-color", content: "#0b0d10" },
      {
        name: "description",
        content: `${APP_LINE}. Client, dedicated PalServer, UE4SS, PalSchema, and PAKs in one world.`,
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <TooltipProvider delayDuration={200}>
          <Outlet />
          <ThemedToaster />
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  ),
});

function ThemedToaster() {
  const theme = useResolvedTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "bg-card text-foreground border border-border shadow-[var(--shadow-pop)]",
        },
      }}
    />
  );
}
