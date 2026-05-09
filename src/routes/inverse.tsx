import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/inverse")({
  head: () => ({
    meta: [
      { title: "Inverse Mode — Culinario" },
      { name: "description", content: "Pick anyone — real, fictional, dead, alive — and see the three recipes they would choose." },
    ],
  }),
  component: InversePage,
});

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};
const hairline: React.CSSProperties = { border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" };

function DuelDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [chefA, setChefA] = useState("");
  const [chefB, setChefB] = useState("");
  const [challenge, setChallenge] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const start = async () => {
    if (!chefA.trim() || !chefB.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-duel", {
        body: { chef_a: chefA.trim(), chef_b: chefB.trim(), challenge: challenge.trim() || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const duelId = (data as any)?.duel_id ?? (data as any)?.id;
      const recipeAId = (data as any)?.recipe_a_id;
      const recipeBId = (data as any)?.recipe_b_id;
      if (!duelId) throw new Error("No duel returned.");
      // Fire-and-forget image generation for both linked recipes
      [recipeAId, recipeBId].filter(Boolean).forEach((rid: string) => {
        supabase.functions.invoke("generate-inverse-image", { body: { recipe_id: rid } }).catch(() => {});
      });
      navigate({ to: "/duel/$id", params: { id: duelId } });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start the duel.");
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "color-mix(in oklab, var(--bg) 60%, transparent)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: "var(--bg)", color: "var(--fg)",
          border: "1px solid var(--hairline)", padding: 32,
          display: "flex", flexDirection: "column", gap: 18,
        }}
      >
        <div style={eyebrow}>№ 008 — Cooking Duel</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 300, fontSize: 32, margin: "4px 0 8px" }}>
          Stage a duel.
        </h2>
        <label style={eyebrow}>Chef A</label>
        <input
          autoFocus
          value={chefA} onChange={(e) => setChefA(e.target.value)}
          placeholder="e.g. Julia Child"
          style={inputStyle}
        />
        <label style={eyebrow}>Chef B</label>
        <input
          value={chefB} onChange={(e) => setChefB(e.target.value)}
          placeholder="e.g. Anthony Bourdain"
          style={inputStyle}
        />
        <label style={eyebrow}>Challenge (optional)</label>
        <input
          value={challenge} onChange={(e) => setChallenge(e.target.value)}
          placeholder="e.g. one chicken, one hour"
          style={inputStyle}
        />
        {err && <div style={{ ...eyebrow, color: "var(--saffron)" }}>{err}</div>}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button
            type="button" onClick={onClose}
            style={{ ...buttonStyle, color: "var(--fg-muted)", borderColor: "var(--hairline)" }}
          >
            Cancel
          </button>
          <button
            type="button" onClick={start}
            disabled={!chefA.trim() || !chefB.trim() || busy}
            style={{
              ...buttonStyle,
              color: !chefA.trim() || !chefB.trim() || busy ? "var(--fg-low)" : "var(--saffron)",
              borderColor: !chefA.trim() || !chefB.trim() || busy ? "var(--hairline)" : "var(--saffron)",
              cursor: !chefA.trim() || !chefB.trim() || busy ? "not-allowed" : "pointer",
              flex: 1,
            }}
          >
            {busy ? "Setting the table…" : "Start the duel ↗"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "transparent", color: "var(--fg)",
  border: 0, borderBottom: "1px solid var(--hairline)",
  fontFamily: "var(--font-display)", fontStyle: "italic",
  fontSize: 20, padding: "6px 0", outline: "none",
  boxSizing: "border-box",
};
const buttonStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
  textTransform: "uppercase", letterSpacing: "0.2em",
  background: "transparent", border: "1px solid", padding: "12px 18px",
  cursor: "pointer", borderRadius: 0,
};

function InversePage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [celebrity, setCelebrity] = useState("");
  const [conjuring, setConjuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ celebrity: string; recipes: any[] } | null>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const search = Route.useSearch();
  const [duelOpen, setDuelOpen] = useState(Boolean(search.duel));
  const phrases = useMemo(() => [
    "Lighting the candles…",
    "Borrowing their palate…",
    "Whispering to the pantry…",
    "Plating in their voice…",
    "Reducing the memory…",
    "Setting three places…",
  ], []);

  useEffect(() => {
    if (!conjuring) { setPhraseIdx(0); return; }
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % phrases.length), 1400);
    return () => clearInterval(id);
  }, [conjuring, phrases.length]);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
  }, [session, loading, navigate]);

  const conjure = async () => {
    const name = celebrity.trim();
    if (!name || conjuring) return;
    setConjuring(true);
    setError(null);
    setResults(null);
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
      const recipesFromFn: any[] = (data as any)?.recipes ?? ((data as any)?.recipe_ids ?? []).map((id: string) => ({ id }));
      const ids: string[] = recipesFromFn
        .map((r: any) => r?.id)
        .filter((id: any): id is string => typeof id === "string" && id.length > 0);
      if (!ids.length) throw new Error("No recipes returned.");
      const { data: rows } = await supabase
        .from("recipes")
        .select("id,title,cuisine,time_estimate_minutes,difficulty,body,chef_inspiration")
        .in("id", ids);
      const ordered = ids
        .map((id) => {
          const row: any = (rows ?? []).find((r: any) => r.id === id);
          const fn: any = recipesFromFn.find((r: any) => r.id === id);
          if (!row) return null;
          const baseBody = (row.body && typeof row.body === "object" && !Array.isArray(row.body)) ? row.body : {};
          return {
            ...row,
            body: {
              ...baseBody,
              inverse_blurb: baseBody.inverse_blurb ?? fn?.blurb ?? null,
              inverse_cameo: baseBody.inverse_cameo ?? fn?.cameo ?? null,
            },
          };
        })
        .filter(Boolean);
      setResults({ celebrity: name, recipes: ordered });
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
        <div style={eyebrow}>№ 007 — Inverse Mode</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
          fontSize: "clamp(48px, 7vw, 80px)", lineHeight: 1.05,
          letterSpacing: "-0.02em", margin: "16px 0 12px",
        }}>
          Cook as someone else.
        </h1>
        <p style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: 20, color: "var(--fg-muted)", margin: 0, maxWidth: 560,
        }}>
          Name anyone — a chef, an artist, a dead poet, your grandmother, a fictional detective.
          We'll imagine the three dishes they would choose, in their voice, with a memoir blurb on each.
        </p>

        <hr style={hairline} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={eyebrow}>The Person</label>
          <input
            type="text"
            value={celebrity}
            onChange={(e) => setCelebrity(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") conjure(); }}
            placeholder="e.g. Anthony Bourdain, Hannibal Lecter, my dad"
            disabled={conjuring}
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
                position: "relative",
                zIndex: 1,
              }}
            >
              {conjuring ? "Conjuring three dishes…" : results ? "Reconjure their menu ↗" : "Conjure their menu ↗"}
            </button>
          </div>
          {error && (
            <div style={{ ...eyebrow, color: "var(--saffron)" }}>{error}</div>
          )}
        </div>

        {results && (
          <>
            <hr style={hairline} />
            <div style={eyebrow}>Three dishes for {results.celebrity}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 24 }}>
              {results.recipes.map((r: any) => (
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
                    {r.body?.inverse_blurb && (
                      <p style={{
                        fontFamily: "var(--font-body)", fontStyle: "italic",
                        fontSize: 17, lineHeight: 1.55, color: "var(--fg-muted)",
                        margin: 0, maxWidth: 640,
                      }}>
                        "{r.body.inverse_blurb}"
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
              ))}
            </div>
          </>
        )}
      </main>

      {conjuring && <ConjuringOverlay name={celebrity.trim()} phrase={phrases[phraseIdx]} />}
      <DuelDialog open={duelOpen} onClose={() => setDuelOpen(false)} />
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
      {/* floating glass orbs */}
      <div className="inv-orb inv-orb-1" />
      <div className="inv-orb inv-orb-2" />
      <div className="inv-orb inv-orb-3" />

      <div
        style={{
          position: "relative",
          padding: "44px 56px",
          borderRadius: 28,
          border: "1px solid color-mix(in oklab, var(--fg) 14%, transparent)",
          background: "color-mix(in oklab, var(--bg) 35%, transparent)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.35), inset 0 1px 0 color-mix(in oklab, white 18%, transparent)",
          textAlign: "center",
          maxWidth: 520,
          animation: "inv-pop 520ms cubic-bezier(.2,.9,.3,1.2) both",
        }}
      >
        <div style={eyebrow}>№ 007 — Inverse Mode</div>
        <div
          style={{
            fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 300,
            fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.1,
            margin: "12px 0 18px",
            background: "linear-gradient(110deg, var(--fg) 30%, var(--saffron) 50%, var(--fg) 70%)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text", backgroundClip: "text",
            color: "transparent",
            animation: "inv-shimmer 2.4s linear infinite",
          }}
        >
          Conjuring {name || "their menu"}…
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 18 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inv-plate"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </div>

        <div
          key={phrase}
          style={{
            ...eyebrow, color: "var(--fg-muted)",
            animation: "inv-fade-in 380ms ease-out both",
          }}
        >
          {phrase}
        </div>
      </div>

      <style>{`
        @keyframes inv-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes inv-pop {
          0%   { opacity: 0; transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes inv-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes inv-float-a {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(40px,-30px) scale(1.08); }
        }
        @keyframes inv-float-b {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(-50px,40px) scale(1.12); }
        }
        @keyframes inv-float-c {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(30px,50px) scale(0.95); }
        }
        .inv-orb {
          position: absolute; border-radius: 9999px; filter: blur(40px);
          opacity: 0.55; pointer-events: none;
        }
        .inv-orb-1 {
          width: 360px; height: 360px; top: -80px; left: -60px;
          background: radial-gradient(circle at 30% 30%, var(--saffron), transparent 60%);
          animation: inv-float-a 9s ease-in-out infinite;
        }
        .inv-orb-2 {
          width: 420px; height: 420px; bottom: -120px; right: -80px;
          background: radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--saffron) 60%, magenta), transparent 60%);
          animation: inv-float-b 11s ease-in-out infinite;
        }
        .inv-orb-3 {
          width: 300px; height: 300px; top: 40%; left: 55%;
          background: radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--saffron) 40%, cyan), transparent 60%);
          animation: inv-float-c 13s ease-in-out infinite;
        }
        @keyframes inv-bounce {
          0%,80%,100% { transform: translateY(0); opacity: 0.4; }
          40%         { transform: translateY(-10px); opacity: 1; }
        }
        .inv-plate {
          width: 12px; height: 12px; border-radius: 9999px;
          background: var(--saffron);
          box-shadow: 0 0 14px color-mix(in oklab, var(--saffron) 70%, transparent);
          animation: inv-bounce 1.2s ease-in-out infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}