import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/duel/$id")({
  head: () => ({ meta: [{ title: "Tonight's Duel — Culinario" }] }),
  component: DuelPage,
});

const PALETTE = {
  bg: "#0a0a0a",
  red: "#e63946",
  gold: "#f4c430",
  neon: "#39ff14",
  ink: "#f5f5f5",
  muted: "#9a9a9a",
};

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 700ms ease ${delay}ms, transform 700ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function Avatar({ src, alt, size = 96 }: { src?: string | null; alt: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: src ? `center/cover no-repeat url(${src})` : "#1a1a1a",
        border: `2px solid ${PALETTE.gold}`,
        boxShadow: `0 0 24px ${PALETTE.gold}55`,
        flexShrink: 0,
      }}
      aria-label={alt}
    />
  );
}

async function resolveImage(r: any): Promise<string | null> {
  if (!r) return null;
  if (r.inverse_image_url) return r.inverse_image_url;
  if (r.image_path) {
    const { data } = await supabase.storage.from("recipe-images").createSignedUrl(r.image_path, 3600);
    return data?.signedUrl ?? null;
  }
  return null;
}

function DuelPage() {
  const { id } = Route.useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [duel, setDuel] = useState<any>(null);
  const [recipeA, setRecipeA] = useState<any>(null);
  const [recipeB, setRecipeB] = useState<any>(null);
  const [imgA, setImgA] = useState<string | null>(null);
  const [imgB, setImgB] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: d, error: dErr, status } = await supabase.from("duels" as any).select("*").eq("id", id).maybeSingle();
      console.log("[duel] fetch", { id, status, error: dErr, data: d });
      if (cancelled) return;
      if (dErr) { setError(`${dErr.code ?? "?"}: ${dErr.message} ${dErr.details ?? ""} ${dErr.hint ?? ""}`); setLoading(false); return; }
      if (!d) { setError(`No duel row matched id ${id}. Check that the row exists and that RLS lets you read it.`); setLoading(false); return; }
      setDuel(d);
      const ids = [(d as any).recipe_a_id, (d as any).recipe_b_id].filter(Boolean);
      const { data: rs } = await supabase.from("recipes").select("*").in("id", ids);
      const a = (rs ?? []).find((r: any) => r.id === (d as any).recipe_a_id);
      const b = (rs ?? []).find((r: any) => r.id === (d as any).recipe_b_id);
      if (cancelled) return;
      setRecipeA(a); setRecipeB(b);
      const [ua, ub] = await Promise.all([resolveImage(a), resolveImage(b)]);
      if (cancelled) return;
      setImgA(ua); setImgB(ub);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Poll for image updates if recipes don't have images yet
  useEffect(() => {
    if (!recipeA && !recipeB) return;
    if ((recipeA?.inverse_image_url || recipeA?.image_path) && (recipeB?.inverse_image_url || recipeB?.image_path)) return;
    const t = setInterval(async () => {
      const ids = [recipeA?.id, recipeB?.id].filter(Boolean);
      if (!ids.length) return;
      const { data: rs } = await supabase.from("recipes").select("*").in("id", ids);
      const a: any = (rs ?? []).find((r: any) => r.id === recipeA?.id);
      const b: any = (rs ?? []).find((r: any) => r.id === recipeB?.id);
      if (a && (a.inverse_image_url !== recipeA?.inverse_image_url || a.image_path !== recipeA?.image_path)) {
        setRecipeA(a); resolveImage(a).then(setImgA);
      }
      if (b && (b.inverse_image_url !== recipeB?.inverse_image_url || b.image_path !== recipeB?.image_path)) {
        setRecipeB(b); resolveImage(b).then(setImgB);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [recipeA?.id, recipeB?.id, recipeA?.inverse_image_url, recipeB?.inverse_image_url]);

  if (!session) {
    return <div style={{ minHeight: "100vh", background: PALETTE.bg, color: PALETTE.ink, padding: 64 }}>Sign in to view duels.</div>;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: PALETTE.bg, color: PALETTE.gold, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 24 }}>
        Lighting the studio…
      </div>
    );
  }

  if (error || !duel) {
    return <div style={{ minHeight: "100vh", background: PALETTE.bg, color: PALETTE.red, padding: 64 }}>{error ?? "No duel found."}</div>;
  }

  const chefA = duel.chef_a ?? "Chef A";
  const chefB = duel.chef_b ?? "Chef B";
  const challenge = duel.challenge ?? "";
  const host = duel.host_name ?? "Your Host";
  const verdict = duel.verdict ?? "";
  const winnerSlug = (duel.winner_slug ?? "").toString().toLowerCase();
  const isAWinner = winnerSlug === "a" || winnerSlug === "chef_a" || winnerSlug === (duel.chef_a_slug ?? "").toLowerCase();
  const winnerName = isAWinner ? chefA : chefB;
  const adBreak = duel.ad_break ?? "";
  const trashTalk: Array<{ speaker: string; text: string; side?: "a" | "b" }> = (() => {
    const raw = duel.trash_talk;
    if (Array.isArray(raw)) {
      return raw.map((t: any, i: number) => ({
        speaker: t.speaker ?? (i % 2 === 0 ? chefA : chefB),
        text: t.text ?? t.line ?? String(t),
        side: (t.speaker === chefA ? "a" : t.speaker === chefB ? "b" : i % 2 === 0 ? "a" : "b") as "a" | "b",
      }));
    }
    return [];
  })();

  return (
    <div style={{ minHeight: "100vh", background: PALETTE.bg, color: PALETTE.ink, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @keyframes neon-flicker {
          0%, 100% { text-shadow: 0 0 6px ${PALETTE.neon}, 0 0 14px ${PALETTE.neon}, 0 0 30px ${PALETTE.neon}; }
          50% { text-shadow: 0 0 4px ${PALETTE.neon}, 0 0 8px ${PALETTE.neon}; }
        }
        @keyframes confetti-pop {
          0% { transform: scale(0.9); } 50% { transform: scale(1.05); } 100% { transform: scale(1); }
        }
      `}</style>

      {/* 1. Title card */}
      <FadeIn>
        <section style={{ padding: "80px 24px 60px", textAlign: "center", borderBottom: `1px solid ${PALETTE.red}33` }}>
          <h1 style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic", fontWeight: 900,
            fontSize: "clamp(48px, 10vw, 120px)",
            color: PALETTE.gold, letterSpacing: "0.04em",
            transform: "skew(-8deg)", margin: 0,
            textShadow: `0 6px 0 #000, 0 10px 30px ${PALETTE.gold}55`,
          }}>
            TONIGHT'S DUEL
          </h1>
          <div style={{
            marginTop: 36,
            fontFamily: "Georgia, serif", fontWeight: 800,
            fontSize: "clamp(36px, 7vw, 80px)",
            display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center", alignItems: "center",
          }}>
            <span style={{ color: PALETTE.ink, textShadow: `4px 4px 0 ${PALETTE.red}` }}>{chefA}</span>
            <span style={{ color: PALETTE.gold, fontStyle: "italic", fontSize: "0.7em" }}>VS</span>
            <span style={{ color: PALETTE.ink, textShadow: `4px 4px 0 ${PALETTE.red}` }}>{chefB}</span>
          </div>
          {challenge && (
            <p style={{ marginTop: 28, fontStyle: "italic", fontSize: 22, color: PALETTE.muted }}>
              Challenge: {challenge}
            </p>
          )}
        </section>
      </FadeIn>

      {/* 2. Host */}
      <FadeIn>
        <section style={{ padding: "20px 24px", textAlign: "center", color: PALETTE.muted, letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 13 }}>
          Hosted by <span style={{ color: PALETTE.gold, fontFamily: "Georgia, serif", fontStyle: "italic", textTransform: "none", letterSpacing: 0, fontSize: 18 }}>{host}</span>
        </section>
      </FadeIn>

      {/* 3. Walk-on */}
      <FadeIn>
        <section style={{ padding: "60px 24px", maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48 }}>
          {[
            { name: chefA, walk: duel.walk_on_a, img: imgA },
            { name: chefB, walk: duel.walk_on_b, img: imgB },
          ].map((c, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <Avatar src={c.img} alt={c.name} size={140} />
              <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 800, fontSize: 40, margin: "20px 0 16px", color: PALETTE.ink }}>{c.name}</h2>
              {c.walk && (
                <p style={{
                  fontStyle: "italic", fontSize: 17, lineHeight: 1.6, color: PALETTE.ink,
                  borderLeft: `4px solid ${PALETTE.red}`, paddingLeft: 18, textAlign: "left", maxWidth: 460,
                }}>
                  {c.walk}
                </p>
              )}
            </div>
          ))}
        </section>
      </FadeIn>

      {/* 4. Recipe cards */}
      <FadeIn>
        <section style={{ padding: "40px 24px 60px", maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
          {[
            { r: recipeA, img: imgA, chef: chefA },
            { r: recipeB, img: imgB, chef: chefB },
          ].map(({ r, img, chef }, i) => r ? (
            <Link
              key={i}
              to="/recipes/$id"
              params={{ id: r.id }}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article style={{
                background: "#141414", border: `1px solid ${PALETTE.gold}44`,
                borderRadius: 6, overflow: "hidden",
                transition: "transform 200ms ease, border-color 200ms ease",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = PALETTE.gold; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = `${PALETTE.gold}44`; }}
              >
                {img ? (
                  <div style={{ width: "100%", aspectRatio: "4/3", background: `center/cover no-repeat url(${img})` }} />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "4/3", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.muted, fontStyle: "italic", fontSize: 13 }}>
                    Plating the dish…
                  </div>
                )}
                <div style={{ padding: 24 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: PALETTE.gold }}>
                    {chef}'s entry
                  </div>
                  <h3 style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 28, margin: "10px 0 12px", color: PALETTE.ink }}>{r.title}</h3>
                  <div style={{ fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: PALETTE.muted, marginBottom: 14 }}>
                    {(r.cuisine ?? "").toUpperCase()} · {r.time_estimate_minutes ?? "—"} MIN · {(r.difficulty ?? "").toUpperCase()}
                  </div>
                  {r.body?.inverse_blurb && (
                    <p style={{ fontStyle: "italic", color: PALETTE.muted, fontSize: 15, lineHeight: 1.5, margin: 0 }}>
                      "{r.body.inverse_blurb}"
                    </p>
                  )}
                </div>
              </article>
            </Link>
          ) : null)}
        </section>
      </FadeIn>

      {/* 5. Trash talk */}
      {trashTalk.length > 0 && (
        <FadeIn>
          <section style={{ padding: "60px 24px", maxWidth: 900, margin: "0 auto" }}>
            <h2 style={{
              textAlign: "center", color: PALETTE.neon,
              fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 900,
              fontSize: "clamp(28px, 5vw, 48px)", letterSpacing: "0.08em",
              animation: "neon-flicker 2.4s infinite",
              margin: "0 0 48px",
            }}>
              ROUND ONE: TRASH TALK
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {trashTalk.map((t, i) => {
                const left = t.side === "a" || (!t.side && i % 2 === 0);
                const avatar = left ? imgA : imgB;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: left ? "row" : "row-reverse", alignItems: "flex-end", gap: 14 }}>
                    <Avatar src={avatar} alt={t.speaker} size={56} />
                    <div style={{ maxWidth: "70%" }}>
                      <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: PALETTE.gold, marginBottom: 6, textAlign: left ? "left" : "right" }}>
                        {t.speaker}
                      </div>
                      <div style={{
                        background: left ? "#1c1c1c" : PALETTE.red,
                        color: PALETTE.ink,
                        padding: "14px 20px",
                        borderRadius: left ? "18px 18px 18px 4px" : "18px 18px 4px 18px",
                        fontSize: 16, lineHeight: 1.5,
                      }}>
                        {t.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </FadeIn>
      )}

      {/* 6. Verdict */}
      <FadeIn>
        <section style={{ padding: "80px 24px", textAlign: "center", borderTop: `1px solid ${PALETTE.gold}33`, borderBottom: `1px solid ${PALETTE.gold}33` }}>
          <h2 style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "clamp(36px, 6vw, 64px)", color: PALETTE.gold, margin: "0 0 24px" }}>
            THE VERDICT
          </h2>
          {verdict && (
            <p style={{ maxWidth: 720, margin: "0 auto 40px", fontSize: 20, lineHeight: 1.6, fontStyle: "italic", color: PALETTE.ink }}>
              "{verdict}"
            </p>
          )}
          <div style={{
            fontFamily: "Georgia, serif", fontWeight: 900,
            fontSize: "clamp(40px, 8vw, 96px)",
            color: PALETTE.gold,
            textShadow: `0 0 40px ${PALETTE.gold}88, 4px 4px 0 ${PALETTE.red}`,
            animation: "confetti-pop 800ms ease",
          }}>
            🎉 WINNER: {winnerName} 🎉
          </div>
        </section>
      </FadeIn>

      {/* 7. Ad break */}
      {adBreak && (
        <FadeIn>
          <section style={{ padding: "60px 24px", textAlign: "center", background: "linear-gradient(135deg, #2a004a 0%, #4a0066 100%)" }}>
            <div style={{
              fontFamily: "'Comic Sans MS', cursive", fontWeight: 900,
              fontSize: "clamp(28px, 5vw, 48px)",
              color: "#fff200",
              textShadow: "3px 3px 0 #ff00aa, 6px 6px 0 #00ffff",
              transform: "rotate(-2deg)",
              margin: "0 0 24px",
            }}>
              ★ COMMERCIAL BREAK ★
            </div>
            <p style={{ maxWidth: 600, margin: "0 auto", fontSize: 18, color: "#fff", fontWeight: 600, lineHeight: 1.5 }}>
              {adBreak}
            </p>
            <p style={{ marginTop: 20, fontSize: 9, color: "#ddd", maxWidth: 500, margin: "20px auto 0", lineHeight: 1.4 }}>
              Side effects may include sudden cravings, spontaneous applause, mild euphoria, the urge to call your mother, and an inexplicable desire to deglaze things. Not available in all dimensions. Results not typical. Consult your sommelier before use.
            </p>
          </section>
        </FadeIn>
      )}

      {/* 8. CTA buttons */}
      <FadeIn>
        <section style={{ padding: "80px 24px 120px", display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center" }}>
          {recipeA && (
            <button
              onClick={() => navigate({ to: "/recipes/$id", params: { id: recipeA.id } })}
              style={{
                background: "transparent", color: PALETTE.gold,
                border: `2px solid ${PALETTE.gold}`,
                padding: "18px 32px", fontSize: 14, fontWeight: 700,
                letterSpacing: "0.2em", textTransform: "uppercase",
                cursor: "pointer", borderRadius: 0,
              }}
            >
              Cook {chefA}'s recipe ↗
            </button>
          )}
          {recipeB && (
            <button
              onClick={() => navigate({ to: "/recipes/$id", params: { id: recipeB.id } })}
              style={{
                background: PALETTE.red, color: PALETTE.ink,
                border: `2px solid ${PALETTE.red}`,
                padding: "18px 32px", fontSize: 14, fontWeight: 700,
                letterSpacing: "0.2em", textTransform: "uppercase",
                cursor: "pointer", borderRadius: 0,
              }}
            >
              Cook {chefB}'s recipe ↗
            </button>
          )}
        </section>
      </FadeIn>
    </div>
  );
}
