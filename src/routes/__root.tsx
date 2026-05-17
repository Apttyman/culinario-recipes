import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { ChatSuppressionProvider } from "@/lib/chat-suppression";
import { ChatWidget } from "@/components/chat/ChatWidget";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  // Surface the actual error text on the page itself — the previous generic
  // "Something went wrong on our end" message hides every clue and forces
  // users to open dev tools on mobile (which isn't realistic). Showing the
  // message + first lines of the stack makes any production failure
  // diagnosable from the screen.
  const message = error?.message ?? String(error ?? "Unknown error");
  const stack = (error?.stack ?? "").split("\n").slice(0, 6).join("\n");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The error is below. Take a screenshot or copy it so we can fix it.
        </p>
        <pre
          style={{
            marginTop: 18,
            padding: "14px 16px",
            background: "var(--surface-elev, #1a1a1a)",
            border: "1px solid var(--hairline, #2a2a24)",
            borderRadius: 8,
            color: "var(--saffron, #d97a1b)",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 12,
            lineHeight: 1.5,
            textAlign: "left",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowX: "auto",
            maxHeight: 320,
            overflowY: "auto",
            userSelect: "text",
            WebkitUserSelect: "text",
          }}
        >
          {message}
          {stack ? `\n\n${stack}` : ""}
        </pre>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                navigator.clipboard?.writeText(`${message}\n\n${stack}`);
              } catch {/* ignore */}
            }}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Copy error
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Culinario" },
      { name: "description", content: "A cooking app that treats every meal as theatre. Conjure a chef. Stage a duel. Cook what they would have cooked." },
      { name: "author", content: "Culinario" },
      { property: "og:title", content: "Culinario — Cooking as theatre" },
      { property: "og:description", content: "Conjure a chef. Stage a duel. Cook what they would have cooked. A cooking app that treats every meal as theatre." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Culinario" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Culinario — Cooking as theatre" },
      { name: "twitter:description", content: "Conjure a chef. Stage a duel. Cook what they would have cooked." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7bec2f39-fb07-4a90-a83c-d7a66d417eeb/id-preview-d15c20ba--4c8fe348-6945-4de5-a506-86129859ef8e.lovable.app-1778330944359.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7bec2f39-fb07-4a90-a83c-d7a66d417eeb/id-preview-d15c20ba--4c8fe348-6945-4de5-a506-86129859ef8e.lovable.app-1778330944359.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bangers&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChatSuppressionProvider>
          <Outlet />
          <ChatWidget />
        </ChatSuppressionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
