import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/monitor")({
  component: function MonitorRedirect() {
    return <Navigate to="/" />;
  },
});
