import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";
import { ShareButton } from "@/components/share/ShareButton";
import { getFaceCropStyle, parseFaceBox, type FaceBox } from "@/lib/face-crop";

// Public viewer for an Inverse Mode "menu" (the three recipes that share
// an inverse_session_id). Mirrors the /duel/$id and /last-meal/$id pattern
// — anyone with the URL can view via the public RLS policy added in
// the inverse_recipes_publicly_viewable_by_uuid migration. Owners get the
// Share pill; anonymous visitors get a "Conjure your own" CTA.

export const Route = createFileRoute("/inverse-set/$id")({
  head: ({ params }) => {
    const ogImage = `https://upofudganvjbdhxxpfti.supabase.co/functions/v1/inverse-og?session=${params.id}`;
    const pageUrl = `https://culinario-recipes.lovable.app/inverse-set/${params.id}`;
    return {
      meta: [
        { title: "An Inverse Menu — Culinario" },
        { name: "description", content: "Three dishes from a chef who never cooked them. Conjure your own at Culinario." },
        { property: "og:title", content: "An Inverse Menu — Culinario" },
        { property: "og:description", content: "Three dishes from a chef who never cooked them. Conjure your own at Culinario." },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: pageUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "An Inverse Menu — Culinario" },
        { name: "twitter:description", content: "Three dishes from a chef who never cooked them. Conjure your own at Culinario." },
        { name: "twitter:image", content: ogImage },
      ],
    };
  },
  component: InverseSetPage,
});

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};
const hairline: React.CSSProperties = { border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" };

type InverseRecipe = {
  id: string;
  user_id: string;
  title: string | null;
  cuisine: string | null;
  time_estimate_minutes: number | null;
  difficulty: string | null;
  body: any;
  inverse_celebrity: string | null;
  inverse_blurb: string | null;
  position: number | null;
  inverse_session_id: string | null;
};

type PersonaInfo = {
  celebrity_key: string;
  display_name: string | null;
  portrait_url: string | null;
  portrait_face_box: any;
  persona_blurb: string | null;
  disambiguator: string | null;
};

function celebrityKey(name: string | null): string {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function InverseSetPage() {
  const { id: sessionId } = Route.useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const isAnonymous = !authLoading && !session;

  const [recipes, setRecipes] = useState<InverseRecipe[] | null>(null);
  const [persona, setPersona] = useState<PersonaInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("recipes" as any)
        .select("id, user_id, title, cuisine, time_estimate_minutes, difficulty, body, inverse_celebrity, inverse_blurb, position, inverse_session_id")
        .eq("inverse_session_id", sessionId)
        .eq("is_inverse", true)
        .eq("from_duel", false)
        .order("position", { ascending: true })
        .limit(10);
      if (cancelled) return;
      if (error) { setErr(`${error.code ?? "?"}: ${error.message}`); return; }
      if (!data || data.length === 0) { setErr("This menu could not be found."); return; }
      const rows = data as unknown as InverseRecipe[];
      setRecipes(rows);

      // Pull persona details from celebrity_personas (publicly readable)
      const celebName = rows[0]?.inverse_celebrity ?? "";
      const key = celebrityKey(celebName);
      if (key) {
        const { data: p } = await supabase
          .from("celebrity_personas" as any)
          .select("celebrity_key, display_name, portrait_url, portrait_face_box, persona_blurb, disambiguator")
          .eq("celebrity_key", key)
          .maybeSingle();
        if (!cancelled && p) setPersona(p as unknown as PersonaInfo);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (authLoading || (recipes === null && !err)) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
        <AppHeader />
        <main className="culinario-page" style={{ paddingTop: 96 }}>
          <div style={eyebrow}>Loading the menu…</div>
        </main>
      </div>
    );
  }
  if (err || !recipes || recipes.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
        <AppHeader />
        <main className="culinario-page" style={{ paddingTop: 96 }}>
          <div style={{ ...eyebrow, color: "var(--saffron)" }}>{err ?? "Not found."}</div>
          <div style={{ marginTop: 20 }}>
            <Link to="/inverse" style={{ ...eyebrow, textDecoration: "none", color: "var(--saffron)" }}>
              ← Back to Inverse Mode
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const celebrity = recipes[0]?.inverse_celebrity ?? "Someone";
  const initial = (celebrity?.[0] ?? "?").toUpperCase();
  const faceBox: FaceBox = parseFaceBox(persona?.portrait_face_box);
  const portraitUrl = persona?.portrait_url ?? null;
  const blurb = persona?.persona_blurb ?? persona?.disambiguator ?? "Three dishes from a kitchen icon.";
  const isOwner = !!session?.user && recipes.every((r) => r.user_id === session.user.id);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 240 }}>
        {/* Top action row: back link + Share / Sign-up */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Link
            to="/inverse"
            style={{ background: "transparent", border: 0, padding: 0, textDecoration: "none", ...eyebrow }}
          >
            ← All personas
          </Link>
          {isOwner ? (
            <ShareButton
              kind="inverse_set"
              targetId={sessionId}
              targetLabel={`${celebrity}'s menu`}
              label="Share"
              variant="pill"
            />
          ) : isAnonymous ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/sign-up" })}
              style={{
                fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                textTransform: "uppercase", letterSpacing: "0.2em",
                color: "var(--saffron)", background: "transparent",
                border: "1px solid var(--saffron)",
                padding: "10px 18px", borderRadius: 9999, cursor: "pointer",
              }}
            >
              Conjure your own
            </button>
          ) : null}
        </div>

        {/* Identity row */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", marginTop: 32 }}>
          <div
            aria-hidden="true"
            className="invset-portrait"
            style={{
              width: 120, height: 120,
              ...(portraitUrl ? { backgroundImage: `url(${portraitUrl})`, ...getFaceCropStyle(faceBox, 120) } : {}),
            }}
          >
            {!portraitUrl && <span className="invset-portrait-initial">{initial}</span>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={eyebrow}>№ 007 — Inverse Mode</div>
            <h1 style={{
              fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
              fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.05,
              letterSpacing: "-0.02em", margin: "10px 0 0",
            }}>
              {celebrity}
            </h1>
          </div>
        </div>

        <p style={{
          marginTop: 24,
          fontFamily: "var(--font-body)", fontStyle: "italic",
          fontSize: 20, lineHeight: 1.5, color: "var(--fg)",
          maxWidth: 720, whiteSpace: "pre-wrap",
        }}>
          {blurb}
        </p>

        <hr style={hairline} />
        <div style={eyebrow}>Three dishes for {celebrity}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 24 }}>
          {recipes.map((r) => {
            const body = (r.body && typeof r.body === "object" && !Array.isArray(r.body)) ? r.body : {};
            const recipeBlurb = r.inverse_blurb ?? body.inverse_blurb ?? body.rationale ?? null;
            return (
              <Link
                key={r.id}
                to="/recipes/$id"
                params={{ id: r.id }}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 24 }}>
                  <div style={eyebrow}>
                    {(r.cuisine ?? "").toUpperCase()} · {r.time_estimate_minutes ?? "—"} MIN · {(r.difficulty ?? "").toUpperCase()}
                  </div>
                  <h2 style={{
                    fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
                    fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.1,
                    margin: "12px 0 12px", color: "var(--fg)",
                  }}>
                    {r.title}
                  </h2>
                  {recipeBlurb && (
                    <p style={{
                      fontFamily: "var(--font-body)", fontStyle: "italic",
                      fontSize: 17, lineHeight: 1.55, color: "var(--fg-muted)",
                      margin: 0, maxWidth: 640,
                    }}>
                      "{recipeBlurb}"
                    </p>
                  )}
                  <div style={{
                    marginTop: 12,
                    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
                    textTransform: "uppercase", color: "var(--saffron)",
                  }}>
                    Open recipe ↗
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {isAnonymous && (
          <div style={{ marginTop: 64, textAlign: "center" }}>
            <Link
              to="/sign-up"
              style={{
                fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                textTransform: "uppercase", letterSpacing: "0.2em",
                color: "var(--saffron)", background: "transparent",
                border: "1px solid var(--saffron)",
                padding: "14px 24px", borderRadius: 9999, textDecoration: "none",
              }}
            >
              Conjure your own menu ↗
            </Link>
          </div>
        )}

        <style>{`
          .invset-portrait {
            border-radius: 50%; flex-shrink: 0;
            background-color: color-mix(in oklab, var(--saffron) 18%, var(--surface-elev));
            background-position: center 22%; background-size: cover; background-repeat: no-repeat;
            border: 2px solid color-mix(in oklab, var(--saffron) 65%, transparent);
            box-shadow:
              0 0 0 4px color-mix(in oklab, var(--saffron) 14%, transparent),
              0 8px 24px -8px color-mix(in oklab, var(--saffron) 55%, transparent);
            display: flex; align-items: center; justify-content: center;
          }
          .invset-portrait-initial {
            font-family: var(--font-display); font-style: italic; font-weight: 600;
            font-size: 48px; color: var(--saffron);
          }
        `}</style>
      </main>
    </div>
  );
}
