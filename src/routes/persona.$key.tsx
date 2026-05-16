import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth-context";
import { getFaceCropStyle, parseFaceBox, type FaceBox } from "@/lib/face-crop";

export const Route = createFileRoute("/persona/$key")({
  head: ({ params }) => {
    const ogImage = `https://upofudganvjbdhxxpfti.supabase.co/functions/v1/persona-og?key=${encodeURIComponent(params.key)}`;
    const pageUrl = `https://culinario-recipes.lovable.app/persona/${params.key}`;
    return {
      meta: [
        { title: "Cook as this person — Culinario" },
        { name: "description", content: "An imagined chef persona. Cook the dishes they would have cooked." },
        { property: "og:title", content: "Cook as this person — Culinario" },
        { property: "og:description", content: "An imagined chef persona. Cook the dishes they would have cooked." },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: pageUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Cook as this person — Culinario" },
        { name: "twitter:description", content: "An imagined chef persona. Cook the dishes they would have cooked." },
        { name: "twitter:image", content: ogImage },
      ],
    };
  },
  component: PersonaPage,
});

type Persona = {
  celebrity_key: string;
  display_name: string;
  persona_blurb: string | null;
  portrait_url: string | null;
  portrait_face_box: any;
  is_fictional: boolean | null;
  disambiguator: string | null;
};

const PALETTE = {
  bg: "var(--bg)",
  fg: "var(--fg)",
  fgMuted: "var(--fg-muted)",
  fgLow: "var(--fg-low)",
  hairline: "var(--hairline)",
  saffron: "var(--saffron)",
};

function PersonaPage() {
  const { key } = Route.useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("celebrity_personas")
        .select("celebrity_key, display_name, persona_blurb, portrait_url, portrait_face_box, is_fictional, disambiguator")
        .eq("celebrity_key", key)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }
      setPersona(data as Persona | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [key]);

  const onCook = () => {
    if (!persona) return;
    if (!session) {
      navigate({ to: "/sign-up" });
      return;
    }
    navigate({ to: "/inverse/new", search: { celebrity: persona.display_name } as any });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: PALETTE.bg, color: PALETTE.fgMuted, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22 }}>
        Conjuring the persona…
      </div>
    );
  }
  if (err || !persona) {
    return (
      <div style={{ minHeight: "100vh", background: PALETTE.bg, color: PALETTE.fg, padding: 64, fontFamily: "var(--font-body)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 32, marginBottom: 16 }}>
          We couldn't find that persona.
        </div>
        <Link to="/" style={{ color: PALETTE.saffron, textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          ← Culinario
        </Link>
      </div>
    );
  }

  const portrait = persona.portrait_url;
  const faceBox: FaceBox = parseFaceBox(persona.portrait_face_box);
  const blurb = persona.persona_blurb?.trim();
  const initial = (persona.display_name?.[0] ?? "?").toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: PALETTE.bg, color: PALETTE.fg }}>
      <main className="culinario-page" style={{ paddingTop: 80, paddingBottom: 96 }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
          textTransform: "uppercase", color: PALETTE.fgMuted, textAlign: "center",
        }}>
          № 007 — Inverse Persona
        </div>

        {/* Portrait */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
          <div
            aria-label={persona.display_name}
            style={{
              width: 220, height: 220, borderRadius: "50%",
              ...(portrait
                ? { backgroundImage: `url(${portrait})`, ...getFaceCropStyle(faceBox, 220) }
                : { background: "color-mix(in oklab, var(--saffron) 18%, var(--surface-elev))" }
              ),
              border: "2px solid color-mix(in oklab, var(--saffron) 65%, transparent)",
              boxShadow: "0 0 0 6px color-mix(in oklab, var(--saffron) 14%, transparent), 0 24px 64px -16px color-mix(in oklab, var(--saffron) 50%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: PALETTE.saffron, fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600,
              fontSize: 72, overflow: "hidden",
            }}
          >
            {!portrait && initial}
          </div>
        </div>

        {/* Name */}
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
          fontSize: "clamp(48px, 8vw, 80px)", lineHeight: 1.05,
          letterSpacing: "-0.02em", margin: "32px 0 12px", color: PALETTE.fg,
          textAlign: "center",
        }}>
          {persona.display_name}
        </h1>

        {persona.disambiguator && (
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", color: PALETTE.fgLow, textAlign: "center",
          }}>
            {persona.disambiguator}
          </div>
        )}

        {/* Blurb */}
        {blurb && (
          <p style={{
            margin: "40px auto 0", maxWidth: 640,
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 22, lineHeight: 1.45, color: PALETTE.fg, textAlign: "center",
          }}>
            {blurb}
          </p>
        )}

        <hr style={{ border: 0, height: 1, background: PALETTE.hairline, margin: "56px auto", maxWidth: 320 }} />

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <button
            type="button"
            onClick={onCook}
            style={{
              fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13,
              textTransform: "uppercase", letterSpacing: "0.22em",
              color: PALETTE.saffron, background: "transparent",
              border: "1px solid var(--saffron)",
              padding: "16px 32px", borderRadius: 9999, cursor: "pointer",
              minHeight: 52,
            }}
          >
            {session ? `Cook as ${persona.display_name} ↗` : "Sign up to cook as them ↗"}
          </button>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em",
            textTransform: "uppercase", color: PALETTE.fgLow, textAlign: "center", maxWidth: 360,
          }}>
            {session
              ? "Three dishes in their voice, in your kitchen tonight."
              : "Free to try. Conjure any chef, artist, athlete, fictional character."}
          </div>
        </div>

        <div style={{ marginTop: 64, textAlign: "center" }}>
          <Link to="/" style={{
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
            textTransform: "uppercase", color: PALETTE.fgMuted, textDecoration: "none",
          }}>
            ← Culinario
          </Link>
        </div>
      </main>
    </div>
  );
}
