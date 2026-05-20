import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/teacher/")({
  component: () => <Navigate to="/teacher/dashboard" replace />,
});
