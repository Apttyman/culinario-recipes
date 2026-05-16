// /share/$token — landing route for emailed share links.
//
// Flow:
//   1. If the visitor is not signed in, ask them to sign in or sign up
//      (with a redirect param so they come right back here after auth).
//   2. Once signed in, call accept-share with the bearer token. The function
//      returns the share kind + target IDs.
//   3. Navigate the visitor to the appropriate permalink for the kind:
//        recipe       → /recipes/$id
//        inverse_set  → /inverse?open=<celebrity name>
//        duel         → /duel/$id
//        last_meal    → /last-meal/$id
//
// If the share is already-accepted (most common when a link is clicked
// twice), we still send the visitor to the destination — they can read
// the content via shared_recipe_links or public-by-uuid RLS.

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "A Share — Culinario" },
      { name: "description", content: "Someone sent you something from Culinario." },
    ],
  }),
  component: SharePage,
});

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};

type ShareDest = {
  kind: "recipe" | "inverse_set" | "duel" | "last_meal";
  recipe_id: string | null;
  inverse_session_id: string | null;
  duel_id: string | null;
  last_meal_id: string | null;
};

function SharePage() {
  const { token } = Route.useParams();
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<"idle" | "accepting" | "navigating" | "needs_auth" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);

  // Look up where to go after acceptance (or if already accepted).
  const navigateToDestination = async (dest: ShareDest) => {
    setPhase("navigating");
    if (dest.kind === "recipe" && dest.recipe_id) {
      navigate({ to: "/recipes/$id", params: { id: dest.recipe_id } });
      return;
    }
    if (dest.kind === "duel" && dest.duel_id) {
      navigate({ to: "/duel/$id", params: { id: dest.duel_id }, search: { act: 0 } });
      return;
    }
    if (dest.kind === "last_meal" && dest.last_meal_id) {
      navigate({ to: "/last-meal/$id", params: { id: dest.last_meal_id } });
      return;
    }
    if (dest.kind === "inverse_set" && dest.inverse_session_id) {
      // Look up the celebrity name so we can deep-link to /inverse?open=...
      const { data: rec } = await supabase
        .from("recipes")
        .select("inverse_celebrity")
        .eq("inverse_session_id", dest.inverse_session_id)
        .not("inverse_celebrity", "is", null)
        .limit(1)
        .maybeSingle();
      const celeb = (rec as any)?.inverse_celebrity;
      if (celeb) {
        navigate({ to: "/inverse", search: { open: celeb } as any });
      } else {
        navigate({ to: "/inverse" });
      }
      return;
    }
    // Unknown shape — bounce to today rather than spinning forever.
    navigate({ to: "/today" });
  };

  // Once authed, accept the share and route.
  useEffect(() => {
    if (authLoading) return;
    if (!session) { setPhase("needs_auth"); return; }
    if (phase !== "idle") return;

    let cancelled = false;
    (async () => {
      setPhase("accepting");
      try {
        const { data, error } = await supabase.functions.invoke("accept-share", {
          body: { share_token: token },
        });
        if (cancelled) return;

        if (error) {
          // Pull the JSON error body if Supabase wrapped it
          let msg = error.message ?? String(error);
          try {
            const ctx: any = (error as any).context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              if (body?.error) msg = body.error;
            }
          } catch {/* ignore */}

          // If the share was already accepted, that's not really an error —
          // look up the share details directly and navigate to the destination.
          if (/already accepted/i.test(msg)) {
            const { data: share } = await supabase
              .from("shares" as any)
              .select("kind, recipe_id, inverse_session_id, duel_id, last_meal_id")
              .eq("share_token", token)
              .maybeSingle();
            if (share) {
              setAlreadyAccepted(true);
              await navigateToDestination(share as ShareDest);
              return;
            }
          }
          setErr(msg);
          setPhase("error");
          return;
        }

        if ((data as any)?.error) throw new Error((data as any).error);
        await navigateToDestination(data as ShareDest);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Could not open this share.");
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
    // We only want this to run when auth resolves; token doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session?.user?.id]);

  const redirectPath = `/share/${token}`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader />
      <main className="culinario-page" style={{ paddingTop: 96, paddingBottom: 120 }}>
        <div style={eyebrow}>A share</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
          fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.05,
          letterSpacing: "-0.02em", margin: "12px 0 16px",
        }}>
          {phase === "needs_auth"
            ? "Sign in to open this."
            : phase === "error"
              ? "We couldn't open that share."
              : alreadyAccepted
                ? "Already in your cookbook."
                : "Setting the table…"}
        </h1>

        {phase === "needs_auth" && (
          <>
            <p style={{
              fontFamily: "var(--font-body)", fontStyle: "italic",
              fontSize: 18, lineHeight: 1.55, color: "var(--fg-muted)",
              maxWidth: 560, margin: "0 0 32px",
            }}>
              Someone sent you something from Culinario. Sign in or make an account and we'll
              add it to your cookbook.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                to="/sign-in"
                search={{ redirect: redirectPath } as any}
                style={{
                  fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                  textTransform: "uppercase", letterSpacing: "0.2em",
                  color: "var(--saffron)", background: "transparent",
                  border: "1px solid var(--saffron)",
                  padding: "14px 22px", borderRadius: 9999, textDecoration: "none",
                }}
              >
                Sign in ↗
              </Link>
              <Link
                to="/sign-up"
                search={{ redirect: redirectPath } as any}
                style={{
                  fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                  textTransform: "uppercase", letterSpacing: "0.2em",
                  color: "var(--fg-muted)", background: "transparent",
                  border: "1px solid var(--hairline)",
                  padding: "14px 22px", borderRadius: 9999, textDecoration: "none",
                }}
              >
                Make an account ↗
              </Link>
            </div>
          </>
        )}

        {phase === "accepting" && (
          <div style={{ ...eyebrow, color: "var(--saffron)" }}>
            Accepting the share…
          </div>
        )}

        {phase === "navigating" && (
          <div style={{ ...eyebrow, color: "var(--saffron)" }}>
            Opening it…
          </div>
        )}

        {phase === "error" && (
          <>
            <p style={{
              fontFamily: "var(--font-body)", fontStyle: "italic",
              fontSize: 18, lineHeight: 1.55, color: "var(--fg-muted)",
              maxWidth: 560, margin: "0 0 32px", whiteSpace: "pre-wrap",
            }}>
              {err ?? "This link may have expired, been declined, or been sent to a different account."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                to="/today"
                style={{
                  fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                  textTransform: "uppercase", letterSpacing: "0.2em",
                  color: "var(--saffron)", background: "transparent",
                  border: "1px solid var(--saffron)",
                  padding: "14px 22px", borderRadius: 9999, textDecoration: "none",
                }}
              >
                Go to Today ↗
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
