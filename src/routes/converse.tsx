import { createFileRoute, Outlet } from "@tanstack/react-router";

// Outlet wrapper for the /converse/* route tree.
//   /converse        → converse.index.tsx (entry + archive)
//   /converse/$id    → converse.$id.tsx   (the conversation view)
//
// Mirrors the /inverse and /last-meal pattern. Without this wrapper, TanStack
// treats converse.tsx as the parent layout for converse.$id and the detail
// route never mounts because no <Outlet /> is rendered.
export const Route = createFileRoute("/converse")({
  component: () => <Outlet />,
});
