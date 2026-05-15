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

type PersonaSummary = {
  celebrity: string;
  blurb: string | null;
  recipes: any[];
  lastAt: string | null;
};

// Best-effort persona portrait + biographical extract fetch via Wikipedia REST.
// Mirrors the "celeb image" lookup used by duel mode (Wikipedia thumbnail),
// and also pulls the article's `extract` field for a biographical blurb.
const infoCache = new Map<string, { portrait: string | null; bio: string | null }>();
async function fetchPersonaInfo(name: string): Promise<{ portrait: string | null; bio: string | null }> {
  if (infoCache.has(name)) return infoCache.get(name)!;
  const empty = { portrait: null, bio: null };
  try {
    const slug = encodeURIComponent(name.trim().replace(/\s+/g, "_"));
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) { infoCache.set(name, empty); return empty; }
    const j = await r.json();
    const portrait: string | null = j?.thumbnail?.source ?? j?.originalimage?.source ?? null;
    const bio: string | null = (typeof j?.extract === "string" && j.extract.trim().length > 0) ? j.extract.trim() : null;
    const info = { portrait, bio };
    infoCache.set(name, info);
    return info;
  } catch {
    infoCache.set(name, empty);
    return empty;
  }
}

function InversePage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [celebrity, setCelebrity] = useState("");
  const [conjuring, setConjuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ celebrity: string; recipes: any[] } | null>(null);
  const [personas, setPersonas] = useState<PersonaSummary[] | null>(null);
  const [portraitMap, setPortraitMap] = useState<Record<string, string | null>>({});
  const [bioMap, setBioMap] = useState<Record<string, string | null>>({});
  const [loadingPersona, setLoadingPersona] = useState<string | null>(null);
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
    if (!conjuring) { setPhraseIdx(0); return; }
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % phrases.length), 1400);
    return () => clearInterval(id);
  }, [conjuring, phrases.length]);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
  }, [session, loading, navigate]);

  // Load past inverse personas (grouped by celebrity from the recipes table).
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(250);
      if (cancelled) return;
      const buckets = new Map<string, PersonaSummary>();
      for (const r of (rows ?? []) as any[]) {
        const body = (r.body && typeof r.body === "object" && !Array.isArray(r.body)) ? r.body : {};
        const celeb: string | null = r.inverse_celebrity ?? body.inverse_celebrity ?? r.chef_inspiration ?? null;
        if (!celeb) continue;
        const blurb = r.inverse_blurb ?? body.inverse_blurb ?? body.rationale ?? null;
        if (!r.inverse_celebrity && !body.inverse_celebrity && !r.inverse_blurb && !body.inverse_blurb) continue;
        const key = celeb.trim();
        const existing = buckets.get(key);
        const enriched = { ...r, body: { ...body, inverse_blurb: blurb } };
        if (!existing) {
          buckets.set(key, { celebrity: key, blurb: enriched.body.inverse_blurb, recipes: [enriched], lastAt: r.created_at });
        } else if (existing.recipes.length < 3) {
          existing.recipes.push(enriched);
        }
      }
      const list = Array.from(buckets.values());
      setPersonas(list);
      // Fan out portrait + bio fetches.
      list.forEach(async (p) => {
        const info = await fetchPersonaInfo(p.celebrity);
        if (cancelled) return;
        setPortraitMap((m) => ({ ...m, [p.celebrity]: info.portrait }));
        setBioMap((m) => ({ ...m, [p.celebrity]: info.bio }));
      });
    })();
    return () => { cancelled = true; };
  }, [session]);

  const openPersona = (p: PersonaSummary) => {
    setLoadingPersona(p.celebrity);
    setResults({ celebrity: p.celebrity, recipes: p.recipes });
    setLoadingPersona(null);
    setTimeout(() => {
      const el = document.getElementById("inverse-results");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

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

  const activeCeleb = results?.celebrity ?? null;
  useEffect(() => {
    if (!activeCeleb) return;
    if (portraitMap[activeCeleb] !== undefined && bioMap[activeCeleb] !== undefined) return;
    let cancelled = false;
    (async () => {
      const info = await fetchPersonaInfo(activeCeleb);
      if (cancelled) return;
      setPortraitMap((m) => ({ ...m, [activeCeleb]: info.portrait }));
      setBioMap((m) => ({ ...m, [activeCeleb]: info.bio }));
    })();
    return () => { cancelled = true; };
  }, [activeCeleb, portraitMap, bioMap]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 240 }}>
        {results ? (
          <PersonaResultsView
            celebrity={results.celebrity}
            recipes={results.recipes}
            portrait={portraitMap[results.celebrity] ?? null}
            bio={bioMap[results.celebrity] ?? null}
            onBack={() => setResults(null)}
          />
        ) : (
          <>
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

            {personas && personas.length > 0 && (
              <>
                <hr style={hairline} />
                <div style={eyebrow}>Past personas — tap to revisit</div>
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                  {personas.map((p) => (
                    <PersonaRow
                      key={p.celebrity}
                      persona={p}
                      portrait={portraitMap[p.celebrity] ?? null}
                      bio={bioMap[p.celebrity] ?? null}
                      loading={loadingPersona === p.celebrity}
                      onClick={() => openPersona(p)}
                    />
                  ))}
                </div>
              </>
            )}

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

function PersonaResultsView({
  celebrity, recipes, portrait, bio, onBack,
}: {
  celebrity: string;
  recipes: any[];
  portrait: string | null;
  bio: string | null;
  onBack: () => void;
}) {
  const initial = (celebrity[0] ?? "?").toUpperCase();
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "transparent", border: 0, padding: 0, cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "var(--fg-muted)",
          marginBottom: 28,
        }}
      >
        ← All personas
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div
          aria-hidden="true"
          className="persona-portrait"
          style={{
            width: 120, height: 120,
            backgroundImage: portrait ? `url(${portrait})` : undefined,
          }}
        >
          {!portrait && <span className="persona-initial" style={{ fontSize: 48 }}>{initial}</span>}
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

      {bio && (
        <p style={{
          marginTop: 24,
          fontFamily: "var(--font-body)", fontStyle: "italic",
          fontSize: 17, lineHeight: 1.55, color: "var(--fg-muted)",
          maxWidth: 720, whiteSpace: "pre-wrap",
        }}>
          {bio}
        </p>
      )}

      <hr style={hairline} />
      <div style={eyebrow}>Three dishes for {celebrity}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 24 }}>
        {recipes.map((r: any) => (
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
    </div>
  );
}

function PersonaRow({ persona, portrait, loading, onClick }: { persona: PersonaSummary; portrait: string | null; loading: boolean; onClick: () => void }) {
  const initial = (persona.celebrity[0] ?? "?").toUpperCase();
  const blurb = persona.blurb ?? "Three dishes, in their voice.";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="persona-row"
    >
      <div
        aria-hidden="true"
        className="persona-portrait"
        style={{
          backgroundImage: portrait ? `url(${portrait})` : undefined,
        }}
      >
        {!portrait && <span className="persona-initial">{initial}</span>}
      </div>
      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <div style={{
          fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500,
          fontSize: 22, lineHeight: 1.15, color: "var(--fg)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {persona.celebrity}
        </div>
        <div style={{
          marginTop: 6,
          fontFamily: "var(--font-body)", fontStyle: "italic",
          fontSize: 14, lineHeight: 1.45, color: "var(--fg-muted)",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          "{blurb}"
        </div>
        <div style={{
          marginTop: 8,
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "var(--saffron)",
        }}>
          {persona.recipes.length} {persona.recipes.length === 1 ? "dish" : "dishes"} · revisit ↗
        </div>
      </div>
      <style>{`
        .persona-row {
          position: relative;
          display: flex; align-items: center; gap: 18px;
          padding: 16px 22px;
          border-radius: 9999px;
          border: 1px solid color-mix(in oklab, var(--fg) 12%, transparent);
          background: color-mix(in oklab, var(--surface-elev) 50%, transparent);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          box-shadow:
            0 14px 40px -18px color-mix(in oklab, var(--saffron) 40%, transparent),
            inset 0 1px 0 color-mix(in oklab, white 14%, transparent);
          cursor: pointer;
          color: var(--fg);
          transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease;
          overflow: hidden;
          width: 100%;
        }
        .persona-row:hover {
          transform: translateY(-2px);
          border-color: color-mix(in oklab, var(--saffron) 55%, transparent);
          box-shadow:
            0 22px 50px -18px color-mix(in oklab, var(--saffron) 65%, transparent),
            inset 0 1px 0 color-mix(in oklab, white 22%, transparent);
        }
        .persona-row:disabled { opacity: 0.6; cursor: progress; }
        .persona-portrait {
          width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
          background-color: color-mix(in oklab, var(--saffron) 18%, var(--surface-elev));
          background-position: center 22%; background-size: cover; background-repeat: no-repeat;
          border: 2px solid color-mix(in oklab, var(--saffron) 65%, transparent);
          box-shadow:
            0 0 0 4px color-mix(in oklab, var(--saffron) 14%, transparent),
            0 8px 24px -8px color-mix(in oklab, var(--saffron) 55%, transparent);
          display: flex; align-items: center; justify-content: center;
        }
        .persona-initial {
          font-family: var(--font-display); font-style: italic; font-weight: 600;
          font-size: 28px; color: var(--saffron);
        }
      `}</style>
    </button>
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