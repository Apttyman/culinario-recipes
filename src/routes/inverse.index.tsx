import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";
import { ShareButton } from "@/components/share/ShareButton";
import { getFaceCropStyle, parseFaceBox, type FaceBox } from "@/lib/face-crop";

export const Route = createFileRoute("/inverse/")({
  validateSearch: (s: Record<string, unknown>) => ({
    open: typeof s.open === "string" ? s.open : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Inverse Mode — Culinario" },
      { name: "description", content: "Every persona you've cooked as — replayable." },
    ],
  }),
  component: InverseListPage,
});

type PersonaSummary = {
  celebrity: string;
  blurb: string | null;
  recipes: any[];
  lastAt: string | null;
};

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};
const hairline: React.CSSProperties = { border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" };

function celebrityKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "_");
}


function InverseListPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/inverse/" });
  const [personas, setPersonas] = useState<PersonaSummary[] | null>(null);
  const [portraitMap, setPortraitMap] = useState<Record<string, string | null>>({});
  const [faceBoxMap, setFaceBoxMap] = useState<Record<string, FaceBox>>({});
  const [bioMap, setBioMap] = useState<Record<string, string | null>>({});
  const [active, setActive] = useState<PersonaSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      const { data: rows, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(250);
      if (cancelled) return;
      if (error) { setErr(error.message); return; }
      const buckets = new Map<string, PersonaSummary>();
      for (const r of (rows ?? []) as any[]) {
        const body = (r.body && typeof r.body === "object" && !Array.isArray(r.body)) ? r.body : {};
        const celeb: string | null = r.inverse_celebrity ?? body.inverse_celebrity ?? r.chef_inspiration ?? null;
        if (!celeb) continue;
        const isInverseRow =
          !!r.inverse_celebrity || !!body.inverse_celebrity || !!body.inverse_blurb ||
          !!body.cameo || !!r.chef_inspiration;
        if (!isInverseRow) continue;
        const blurb = r.inverse_blurb ?? body.inverse_blurb ?? body.rationale ?? null;
        const key = celeb.trim();
        const existing = buckets.get(key);
        const enriched = { ...r, body: { ...body, inverse_blurb: blurb } };
        if (!existing) {
          buckets.set(key, { celebrity: key, blurb, recipes: [enriched], lastAt: r.created_at });
        } else {
          // Rows are sorted newest-first; cap each persona at the 3 most recent dishes
          // so re-runs or stragglers from older generations don't show 4+.
          if (existing.recipes.length < 3) existing.recipes.push(enriched);
          if (!existing.blurb && blurb) existing.blurb = blurb;
        }
      }
      const list = Array.from(buckets.values());
      setPersonas(list);

      // Portraits live in celebrity_personas — same source duels uses.
      const keys = list.map((p) => celebrityKey(p.celebrity));
      console.log("[inverse] looking up celebrity_keys", keys, "for celebrities", list.map((p) => p.celebrity));
      const { data: personaRows, error: pErr } = await supabase
        .from("celebrity_personas" as any)
        .select("celebrity_key, portrait_url, portrait_face_box")
        .in("celebrity_key", keys);
      console.log("[inverse] celebrity_personas rows", personaRows, "error", pErr);
      if (cancelled) return;
      const portraitByKey = new Map<string, string | null>();
      const faceByKey = new Map<string, FaceBox>();
      for (const row of (personaRows ?? []) as any[]) {
        portraitByKey.set(row.celebrity_key, row.portrait_url ?? null);
        faceByKey.set(row.celebrity_key, parseFaceBox(row.portrait_face_box));
      }
      const nextPortraits: Record<string, string | null> = {};
      const nextFaces: Record<string, FaceBox> = {};
      for (const p of list) {
        const k = celebrityKey(p.celebrity);
        const url = portraitByKey.get(k) ?? null;
        console.log(`[inverse] portrait for "${p.celebrity}" key="${k}" -> ${url}`);
        nextPortraits[p.celebrity] = url;
        nextFaces[p.celebrity] = faceByKey.get(k) ?? null;
      }
      setPortraitMap(nextPortraits);
      setFaceBoxMap(nextFaces);
      setBioMap({});
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Auto-open persona via ?open=name (after conjuring on /inverse/new).
  useEffect(() => {
    if (!search.open || !personas) return;
    const match = personas.find((p) => p.celebrity.toLowerCase() === search.open!.toLowerCase());
    if (match) {
      setActive(match);
      navigate({ to: "/inverse", search: {} as any, replace: true });
    }
  }, [search.open, personas, navigate]);

  if (active) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
        <AppHeader />
        <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 240 }}>
          <PersonaResultsView
            persona={active}
            portrait={portraitMap[active.celebrity] ?? null}
            faceBox={faceBoxMap[active.celebrity] ?? null}
            bio={bioMap[active.celebrity] ?? null}
            onBack={() => setActive(null)}
          />
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 120, position: "relative" }}>
        <div className="inv-list-orb inv-list-orb-a" />
        <div className="inv-list-orb inv-list-orb-b" />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={eyebrow}>№ 007 — Inverse Mode Archive</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
            fontSize: "clamp(48px, 7vw, 80px)", lineHeight: 1.05,
            letterSpacing: "-0.02em", margin: "16px 0 12px",
          }}>
            Every persona, replayable.
          </h1>
          <p style={{
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 18, color: "var(--fg-muted)", margin: 0, maxWidth: 560,
          }}>
            Tap any chef to revisit the three dishes they chose for you.
          </p>

          <div style={{ marginTop: 28 }}>
            <Link
              to="/inverse/new"
              style={{
                display: "inline-block",
                fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                textTransform: "uppercase", letterSpacing: "0.2em",
                color: "var(--saffron)", textDecoration: "none",
                border: "1px solid var(--saffron)", padding: "12px 22px",
                borderRadius: 9999,
              }}
            >
              Conjure a new persona ↗
            </Link>
          </div>

          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16 }}>
            {err && <div style={{ ...eyebrow, color: "var(--saffron)" }}>{err}</div>}
            {!err && personas === null && <div style={eyebrow}>Loading the archive…</div>}
            {!err && personas && personas.length === 0 && (
              <div style={{
                padding: "44px 28px", textAlign: "center",
                border: "1px dashed var(--hairline)", borderRadius: 24,
              }}>
                <div style={{
                  fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 24,
                  color: "var(--fg-muted)",
                }}>No personas yet.</div>
              </div>
            )}
            {personas?.map((p) => (
              <PersonaRow
                key={p.celebrity}
                persona={p}
                portrait={portraitMap[p.celebrity] ?? null}
                bio={bioMap[p.celebrity] ?? null}
                onClick={() => setActive(p)}
              />
            ))}
          </div>
        </div>

        <style>{`
          .inv-list-orb { position: absolute; border-radius: 9999px; filter: blur(80px); opacity: 0.3; pointer-events: none; z-index: 0; }
          .inv-list-orb-a { width: 460px; height: 460px; top: -120px; left: -100px; background: radial-gradient(circle, color-mix(in oklab, var(--saffron) 70%, transparent), transparent 65%); }
          .inv-list-orb-b { width: 520px; height: 520px; top: 30%; right: -160px; background: radial-gradient(circle, color-mix(in oklab, var(--saffron) 50%, magenta), transparent 65%); }
        `}</style>
      </main>
    </div>
  );
}

function StatusBadges({ recipe }: { recipe: any }) {
  const cooked = !!recipe.cooked_at;
  const rating: number | null = typeof recipe.rating === "number" ? recipe.rating : null;
  const saved = !cooked && rating == null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {cooked && (
        <span className="inv-badge" title="Cooked">
          <span aria-hidden>✓</span> Cooked
        </span>
      )}
      {rating != null && (
        <span className="inv-badge inv-badge-rated" title={`Rated ${rating}/5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              style={{
                width: 8, height: 8,
                background: n <= rating ? "var(--saffron)" : "transparent",
                border: "1px solid var(--saffron)", display: "inline-block",
              }}
            />
          ))}
        </span>
      )}
      {saved && (
        <span className="inv-badge inv-badge-saved" title="Saved, not yet cooked">
          ★ Saved
        </span>
      )}
      <style>{`
        .inv-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--saffron);
          border: 1px solid color-mix(in oklab, var(--saffron) 60%, transparent);
          padding: 4px 10px; border-radius: 9999px;
          background: color-mix(in oklab, var(--saffron) 8%, transparent);
        }
        .inv-badge-saved { color: var(--fg-muted); border-color: var(--hairline); background: transparent; }
      `}</style>
    </div>
  );
}

function PersonaResultsView({
  persona, portrait, bio, onBack,
}: { persona: PersonaSummary; portrait: string | null; bio: string | null; onBack: () => void }) {
  const initial = (persona.celebrity[0] ?? "?").toUpperCase();
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "transparent", border: 0, padding: 0, cursor: "pointer",
          ...eyebrow, marginBottom: 28,
        }}
      >
        ← All personas
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div
          aria-hidden="true"
          className="persona-portrait"
          style={{ width: 120, height: 120, backgroundImage: portrait ? `url(${portrait})` : undefined }}
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
            {persona.celebrity}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={eyebrow}>Three dishes for {persona.celebrity}</div>
        <ShareButton
          kind="inverse_set"
          targetId={persona.recipes[0]?.inverse_session_id ?? null}
          targetLabel={`${persona.celebrity}'s menu`}
          variant="ghost"
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 24 }}>
        {persona.recipes.map((r: any) => (
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
              <div style={{ marginBottom: 12 }}>
                <StatusBadges recipe={r} />
              </div>
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

      <style>{`
        .persona-portrait {
          border-radius: 50%;
          background-color: color-mix(in oklab, var(--saffron) 18%, var(--surface-elev));
          background-position: center 22%; background-size: cover; background-repeat: no-repeat;
          border: 2px solid color-mix(in oklab, var(--saffron) 65%, transparent);
          box-shadow:
            0 0 0 4px color-mix(in oklab, var(--saffron) 14%, transparent),
            0 8px 24px -8px color-mix(in oklab, var(--saffron) 55%, transparent);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .persona-initial {
          font-family: var(--font-display); font-style: italic; font-weight: 600;
          color: var(--saffron);
        }
      `}</style>
    </div>
  );
}

function PersonaRow({
  persona, portrait, bio, onClick,
}: { persona: PersonaSummary; portrait: string | null; bio: string | null; onClick: () => void }) {
  const initial = (persona.celebrity[0] ?? "?").toUpperCase();
  const blurb = bio ?? persona.blurb ?? "Three dishes, in their voice.";
  const cookedCount = persona.recipes.filter((r) => r.cooked_at).length;
  const ratedCount = persona.recipes.filter((r) => r.rating != null).length;
  return (
    <button type="button" onClick={onClick} className="persona-row">
      <div
        aria-hidden="true"
        className="persona-portrait"
        style={{ backgroundImage: portrait ? `url(${portrait})` : undefined }}
      >
        {!portrait && <span className="persona-initial">{initial}</span>}
      </div>
      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500,
            fontSize: 26, lineHeight: 1.1, color: "var(--fg)",
          }}>
            {persona.celebrity}
          </div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "var(--fg-muted)",
          }}>
            {persona.recipes.length} {persona.recipes.length === 1 ? "dish" : "dishes"}
            {cookedCount > 0 && <> · {cookedCount} cooked</>}
            {ratedCount > 0 && <> · {ratedCount} rated</>}
          </div>
        </div>
        <div style={{
          marginTop: 10,
          fontFamily: "var(--font-body)", fontStyle: "italic",
          fontSize: 15, lineHeight: 1.55, color: "var(--fg-muted)",
          whiteSpace: "pre-wrap",
        }}>
          {blurb}
        </div>
      </div>
      <div className="persona-cta" aria-hidden="true">
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "var(--saffron)", whiteSpace: "nowrap",
        }}>
          Revisit menu&nbsp;↗
        </span>
      </div>
      <style>{`
        .persona-row {
          position: relative;
          display: flex; align-items: flex-start; gap: 18px;
          padding: 18px 22px;
          border-radius: 24px;
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
        .persona-cta {
          align-self: center; padding-left: 12px; flex-shrink: 0;
          opacity: 0.65;
          transition: opacity 240ms ease, transform 240ms ease;
        }
        .persona-row:hover .persona-cta { opacity: 1; transform: translateX(4px); }
        @media (max-width: 640px) { .persona-cta { display: none; } }
      `}</style>
    </button>
  );
}
