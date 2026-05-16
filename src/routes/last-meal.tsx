import { createFileRoute, Outlet } from "@tanstack/react-router";

// Outlet wrapper for the /last-meal/* route tree.
//   /last-meal       → last-meal.index.tsx (entry + archive)
//   /last-meal/$id   → last-meal.$id.tsx   (permalink viewer)
//
// Mirrors the /inverse pattern. Without this wrapper, TanStack treats
// last-meal.tsx as the parent layout for last-meal.$id and the detail
// route never mounts because no <Outlet /> is rendered.
export const Route = createFileRoute("/last-meal")({
  component: () => <Outlet />,
});
