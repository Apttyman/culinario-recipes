import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";

type GeneratedRecipe = {
  id: string;
  title: string | null;
  cuisine: string | null;
  time_estimate_minutes: number | null;
  difficulty: string | null;
  body: any;
  inverse_blurb?: string | null;
};

export const Route = createFileRoute("/inverse/new")({
  head: () => ({
    meta: [
      { title: "Conjure a Persona — Inverse Mode" },
      { name: "description", content: "Pick anyone — real, fictional, dead, alive — and see the three recipes they would choose." },
    ],
  }),
  component: InverseNewPage,
});

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};

function InverseNewPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [celebrity, setCelebrity] = useState("");
  const [generatedCelebrity, setGeneratedCelebrity] = useState("");
  const [generatedPortrait, setGeneratedPortrait] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<GeneratedRecipe[] | null>(null);
  const [conjuring, setConjuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const phrases = useMemo(() => [
    "Lighting the candles…",
    "Borrowing their palate…",
    "Whispering to the pantry…",
    "Plating in their voice…",
    "Reducing the memory…",
    "Setting three places…",
  ], []);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!conjuring) { setPhraseIdx(0); return; }
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % phrases.length), 1400);
    return () => clearInterval(id);
  }, [conjuring, phrases.length]);

  const conjure = async () => {
    const name = celebrity.trim();
    if (!name || conjuring) return;
    setConjuring(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-inverse-recipes", {
        body: { celebrity: name },
      });
      if (fnErr) {
        let msg = fnErr.message ?? String(fnErr);
        try {
          const ctx: any = (fnErr as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const ids: string[] = (data as any)?.recipe_ids ?? [];
      if (ids.length !== 3) throw new Error(`Expected 3 new recipes, got ${ids.length}.`);
      const { data: rows, error: rowsErr } = await supabase
        .from("recipes" as any)
        .select("id,title,cuisine,time_estimate_minutes,difficulty,position,body,inverse_blurb")
        .in("id", ids)
        .order("position", { ascending: true });
      if (rowsErr) throw rowsErr;
      const byId = new Map(((rows ?? []) as any[]).map((row) => [row.id, row]));
      const orderedRows = ids.map((id) => byId.get(id)).filter(Boolean) as GeneratedRecipe[];
      if (orderedRows.length !== 3) throw new Error(`Loaded ${orderedRows.length} of 3 new recipes.`);
      setGeneratedCelebrity((data as any)?.celebrity ?? name);
      setRecipes(orderedRows);
      setCelebrity("");
    } catch (e: any) {
      setError(e?.message ?? "Something went sideways.");
    } finally {
      setConjuring(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 240 }}>
        <button
          type="button"
          onClick={() => recipes ? setRecipes(null) : navigate({ to: "/inverse" })}
          style={{
            background: "transparent", border: 0, padding: 0, cursor: "pointer",
            ...eyebrow, marginBottom: 28,
          }}
        >
          {recipes ? "← Conjure another" : "← All personas"}
        </button>

        {recipes ? (
          <NewRecipeResults celebrity={generatedCelebrity} recipes={recipes} />
        ) : (
          <>

        <div style={eyebrow}>№ 007 — Inverse Mode</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
          fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.05,
          letterSpacing: "-0.02em", margin: "12px 0 12px",
        }}>
          Cook as someone else.
        </h1>
        <p style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: 18, color: "var(--fg-muted)", margin: "0 0 40px", maxWidth: 560,
        }}>
          Name anyone — real, fictional, dead, alive — and we'll plate three dishes in their voice.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={eyebrow}>The Person</label>
          <input
            type="text"
            value={celebrity}
            onChange={(e) => setCelebrity(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") conjure(); }}
            placeholder="e.g. Anthony Bourdain, Hannibal Lecter, my dad"
            disabled={conjuring}
            autoFocus
            style={{
              width: "100%", background: "transparent", color: "var(--fg)",
              border: 0, borderBottom: "1px solid var(--hairline)",
              fontFamily: "var(--font-display)", fontStyle: "italic",
              fontSize: "clamp(18px, 5vw, 28px)", padding: "8px 0", outline: "none",
              minWidth: 0, maxWidth: "100%", boxSizing: "border-box",
            }}
          />
          <div>
            <button
              type="button"
              onClick={conjure}
              disabled={!celebrity.trim() || conjuring}
              style={{
                fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                textTransform: "uppercase", letterSpacing: "0.2em",
                color: !celebrity.trim() || conjuring ? "var(--fg-low)" : "var(--saffron)",
                background: "transparent",
                border: "1px solid",
                borderColor: !celebrity.trim() || conjuring ? "var(--hairline)" : "var(--saffron)",
                cursor: !celebrity.trim() || conjuring ? "not-allowed" : "pointer",
                padding: "14px 22px",
                minHeight: 48,
                borderRadius: 0,
              }}
            >
              {conjuring ? "Conjuring three dishes…" : "Conjure their menu ↗"}
            </button>
          </div>
          {error && (
            <div style={{ ...eyebrow, color: "var(--saffron)" }}>{error}</div>
          )}
        </div>
          </>
        )}
      </main>

      {conjuring && <ConjuringOverlay name={celebrity.trim()} phrase={phrases[phraseIdx]} />}
    </div>
  );
}

function NewRecipeResults({ celebrity, recipes }: { celebrity: string; recipes: GeneratedRecipe[] }) {
  return (
    <div>
      <div style={eyebrow}>№ 007 — Inverse Mode</div>
      <h1 style={{
        fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
        fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.05,
        letterSpacing: "-0.02em", margin: "12px 0 12px",
      }}>
        Three new dishes for {celebrity}.
      </h1>
      <p style={{
        fontFamily: "var(--font-display)", fontStyle: "italic",
        fontSize: 18, color: "var(--fg-muted)", margin: "0 0 32px", maxWidth: 560,
      }}>
        Freshly conjured — only this new batch.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {recipes.map((r) => {
          const body = (r.body && typeof r.body === "object" && !Array.isArray(r.body)) ? r.body : {};
          const blurb = r.inverse_blurb ?? body.inverse_blurb ?? body.rationale ?? null;
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
                {blurb && (
                  <p style={{
                    fontFamily: "var(--font-body)", fontStyle: "italic",
                    fontSize: 17, lineHeight: 1.55, color: "var(--fg-muted)",
                    margin: 0, maxWidth: 640,
                  }}>
                    "{blurb}"
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
    </div>
  );
}

function ConjuringOverlay({ name, phrase }: { name: string; phrase: string }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "color-mix(in oklab, var(--bg) 55%, transparent)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        animation: "inv-fade-in 360ms ease-out both",
        overflow: "hidden",
      }}
    >
      <div className="inv-orb inv-orb-1" />
      <div className="inv-orb inv-orb-2" />
      <div className="inv-orb inv-orb-3" />
      <div
        style={{
          position: "relative", padding: "44px 56px", borderRadius: 28,
          border: "1px solid color-mix(in oklab, var(--fg) 14%, transparent)",
          background: "color-mix(in oklab, var(--bg) 35%, transparent)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.35), inset 0 1px 0 color-mix(in oklab, white 18%, transparent)",
          textAlign: "center", maxWidth: 520,
          animation: "inv-pop 520ms cubic-bezier(.2,.9,.3,1.2) both",
        }}
      >
        <div style={eyebrow}>№ 007 — Inverse Mode</div>
        <div
          style={{
            fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 300,
            fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.1, margin: "12px 0 18px",
            background: "linear-gradient(110deg, var(--fg) 30%, var(--saffron) 50%, var(--fg) 70%)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text", backgroundClip: "text",
            color: "transparent", animation: "inv-shimmer 2.4s linear infinite",
          }}
        >
          Conjuring {name || "their menu"}…
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 18 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="inv-plate" style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </div>
        <div key={phrase} style={{ ...eyebrow, color: "var(--fg-muted)", animation: "inv-fade-in 380ms ease-out both" }}>
          {phrase}
        </div>
      </div>
      <style>{`
        @keyframes inv-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes inv-pop { 0% { opacity: 0; transform: scale(0.92); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes inv-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes inv-float-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.08); } }
        @keyframes inv-float-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,40px) scale(1.12); } }
        @keyframes inv-float-c { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,50px) scale(0.95); } }
        .inv-orb { position: absolute; border-radius: 9999px; filter: blur(40px); opacity: 0.55; pointer-events: none; }
        .inv-orb-1 { width: 360px; height: 360px; top: -80px; left: -60px; background: radial-gradient(circle at 30% 30%, var(--saffron), transparent 60%); animation: inv-float-a 9s ease-in-out infinite; }
        .inv-orb-2 { width: 420px; height: 420px; bottom: -120px; right: -80px; background: radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--saffron) 60%, magenta), transparent 60%); animation: inv-float-b 11s ease-in-out infinite; }
        .inv-orb-3 { width: 300px; height: 300px; top: 40%; left: 55%; background: radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--saffron) 40%, cyan), transparent 60%); animation: inv-float-c 13s ease-in-out infinite; }
        @keyframes inv-bounce { 0%,80%,100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-10px); opacity: 1; } }
        .inv-plate { width: 12px; height: 12px; border-radius: 9999px; background: var(--saffron); box-shadow: 0 0 14px color-mix(in oklab, var(--saffron) 70%, transparent); animation: inv-bounce 1.2s ease-in-out infinite; display: inline-block; }
      `}</style>
    </div>
  );
}
