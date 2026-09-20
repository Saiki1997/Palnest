import { createFileRoute } from "@tanstack/react-router";
import { HydrateGate } from "@/components/hydrate";
import { Shell } from "@/components/shell";
import { SetupPage } from "@/routes/setup";
import { useAppStore } from "@/lib/store";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  return (
    <HydrateGate>
      <Gate />
    </HydrateGate>
  );
}

function Gate() {
  const onboarded = useAppStore((s) => s.onboarded);
  const hydrateReady = useAppStore((s) => s.hydrateReady);
  if (!hydrateReady) {
    return <div className="min-h-dvh bg-background" aria-busy="true" />;
  }
  if (onboarded) return <Shell />;
  return <SetupPage />;
}
