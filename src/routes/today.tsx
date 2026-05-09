import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";
import { DiscussModal } from "@/components/DiscussModal";
import { DailyQuestionCard } from "@/components/DailyQuestionCard";

export const Route = createFileRoute("/today")({
  head: () => ({ meta: [{ title: "Today — Culinario" }] }),
  component: Today,
});

function Today() {
  const { session, loading, profile } = useAuth();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<any[]>([]);
  const [portrait, setPortrait] = useState<any | null>(null);
  const [ratedCount, setRatedCount] = useState<number>(0);
  const [discussObs, setDiscussObs] = useState<{ text: string; field?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
    else if (profile && !profile.onboarding_complete) navigate({ to: "/onboarding" });
  }, [session, loading, profile, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    const uid = session.user.id;
    supabase.from("recipes").select("id,title,cuisine,time_estimate_minutes,cooked_at,rating")
      .eq("user_id", uid).order("created_at", { ascending: false }).limit(3)
      .then(({ data }) => setRecent(data ?? []));
  }, [session]);

  const loadPortrait = () => {
    if (!session?.user) return;
    const uid = session.user.id;
    supabase.from("taste_portraits").select("*").eq("user_id", uid).maybeSingle()
      .then(({ data }) => setPortrait(data));
    supabase.from("recipes").select("id", { count: "exact", head: true }).eq("user_id", uid).not("rating", "is", null)
      .then(({ count }) => setRatedCount(count ?? 0));
  };
  useEffect(() => { loadPortrait(); }, [session]);

  const observations: any[] = (portrait?.notable_observations ?? [])
    .filter((o: any) => o && !o.dismissed)
    .sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 3);

  const dismissObs = async (obsText: string) => {
    if (!portrait || !session?.user) return;
    const updated = (portrait.notable_observations ?? []).map((o: any) =>
      o.observation === obsText ? { ...o, dismissed: true } : o
    );
    await supabase.from("taste_portraits").update({ notable_observations: updated }).eq("user_id", session.user.id);
    setPortrait({ ...portrait, notable_observations: updated });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const displayName = profile?.display_name?.trim() || "Your";

  const labelStyle = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: "var(--fg-muted)",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader current="Today" />
      <main
        className="culinario-page"
        style={{
          paddingTop: 96,
          paddingBottom: 64,
        }}
      >
        <h1
          className="culinario-display-h1"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 300,
            fontStyle: "italic",
            fontSize: "clamp(48px, 7vw, 84px)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            margin: 0,
            color: "var(--fg)",
          }}
        >
          {displayName}'s kitchen.
        </h1>
        <div
          style={{
            marginTop: 24,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
          }}
        >
          № 001 — Today
        </div>

        <hr style={{ border: 0, height: 1, background: "var(--hairline)", margin: "40px 0" }} />

        {session?.user && <DailyQuestionCard userId={session.user.id} />}

        <button
          onClick={() => navigate({ to: "/capture" })}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 24, width: "100%", height: 280,
            border: "1px solid var(--hairline)", background: "transparent",
            color: "var(--fg)", cursor: "pointer", padding: 24,
          }}
        >
          <span style={{
            fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
            fontSize: 48, lineHeight: 1, color: "var(--fg)",
          }}>Begin a session.</span>
          <span style={{
            fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
            textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--saffron)",
            display: "inline-flex", alignItems: "center", gap: 10,
          }}>
            Begin
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="2" y1="10" x2="10" y2="2" />
              <polyline points="4,2 10,2 10,8" />
            </svg>
          </span>
        </button>

        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <button
            onClick={() => navigate({ to: "/inverse" })}
            className="culinario-glass-btn culinario-glass-btn--inverse"
            style={{
              position: "relative",
              padding: "22px 24px",
              minHeight: 96,
              borderRadius: 18,
              border: "1px solid color-mix(in oklab, var(--fg) 12%, transparent)",
              background: "color-mix(in oklab, var(--surface-elev) 55%, transparent)",
              backdropFilter: "blur(22px) saturate(160%)",
              WebkitBackdropFilter: "blur(22px) saturate(160%)",
              boxShadow: "0 14px 40px -18px color-mix(in oklab, var(--saffron) 50%, transparent), inset 0 1px 0 color-mix(in oklab, white 14%, transparent)",
              cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between",
              gap: 10, textAlign: "left", overflow: "hidden",
            }}
          >
            <span className="culinario-glass-eyebrow">Inverse Mode</span>
            <span className="culinario-glass-title">Cook as someone else.</span>
            <span className="culinario-glass-cta">Enter ↗</span>
          </button>

          <button
            onClick={() => navigate({ to: "/duel/" })}
            className="culinario-glass-btn culinario-glass-btn--duel"
            style={{
              position: "relative",
              padding: "22px 24px",
              minHeight: 96,
              borderRadius: 18,
              border: "1px solid color-mix(in oklab, var(--fg) 12%, transparent)",
              background: "color-mix(in oklab, var(--surface-elev) 55%, transparent)",
              backdropFilter: "blur(22px) saturate(160%)",
              WebkitBackdropFilter: "blur(22px) saturate(160%)",
              boxShadow: "0 14px 40px -18px color-mix(in oklab, var(--saffron) 50%, transparent), inset 0 1px 0 color-mix(in oklab, white 14%, transparent)",
              cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between",
              gap: 10, textAlign: "left", overflow: "hidden",
            }}
          >
            <span className="culinario-glass-eyebrow">Battling Chef Mode</span>
            <span className="culinario-glass-title">Pit two chefs. Pick a winner.</span>
            <span className="culinario-glass-cta">Enter ↗</span>
          </button>
        </div>
        <style>{`
          @keyframes culinario-glass-sweep {
            0%   { transform: translateX(-120%); }
            100% { transform: translateX(120%); }
          }
          .culinario-glass-btn {
            transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease;
          }
          .culinario-glass-btn::after {
            content: "";
            position: absolute; inset: -1px;
            border-radius: inherit;
            pointer-events: none;
            background: radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--saffron) 22%, transparent), transparent 55%),
                        radial-gradient(120% 80% at 100% 100%, color-mix(in oklab, var(--saffron) 14%, transparent), transparent 55%);
            opacity: 0.7;
          }
          .culinario-glass-btn--duel::after {
            background: radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--saffron) 24%, transparent), transparent 55%),
                        radial-gradient(120% 80% at 0% 100%, color-mix(in oklab, var(--fg) 10%, transparent), transparent 55%);
          }
          .culinario-glass-btn::before {
            content: "";
            position: absolute; inset: 0;
            background: linear-gradient(110deg,
              transparent 35%,
              color-mix(in oklab, white 22%, transparent) 50%,
              transparent 65%);
            transform: translateX(-120%);
            pointer-events: none;
            border-radius: inherit;
          }
          .culinario-glass-btn:hover {
            transform: translateY(-2px);
            border-color: color-mix(in oklab, var(--saffron) 55%, transparent) !important;
            box-shadow: 0 22px 50px -18px color-mix(in oklab, var(--saffron) 70%, transparent), inset 0 1px 0 color-mix(in oklab, white 22%, transparent) !important;
          }
          .culinario-glass-btn:hover::before {
            animation: culinario-glass-sweep 1100ms ease forwards;
          }
          .culinario-glass-eyebrow {
            position: relative; z-index: 1;
            font-family: var(--font-mono); font-size: 10; letter-spacing: 0.22em;
            text-transform: uppercase; color: var(--fg-muted);
            font-size: 10px;
          }
          .culinario-glass-title {
            position: relative; z-index: 1;
            font-family: var(--font-display); font-style: italic; font-weight: 300;
            font-size: 22px; line-height: 1.1; color: var(--fg);
          }
          .culinario-glass-cta {
            position: relative; z-index: 1;
            font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em;
            text-transform: uppercase; color: var(--saffron);
          }
          @media (max-width: 640px) {
            .culinario-glass-btn { min-height: 88px; padding: 18px 18px; }
            .culinario-glass-title { font-size: 19px; }
          }
        `}</style>

        {/* WE'VE NOTICED */}
        <div style={{ marginTop: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 24 }}>
            <h2 style={{
              margin: 0, fontFamily: "var(--font-display)", fontWeight: 500,
              fontVariantCaps: "small-caps", textTransform: "uppercase",
              letterSpacing: "0.15em", fontSize: 16, color: "var(--fg)",
            }}>We've noticed</h2>
            {ratedCount >= 3 && ratedCount < 10 && (
              <span style={{ ...labelStyle, color: "var(--fg-low)" }}>Early read</span>
            )}
          </div>
          {ratedCount < 3 ? (
            <div>
              <div style={{
                fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
                fontSize: 24, color: "var(--fg-muted)",
              }}>Not enough yet to read your mind.</div>
              <div style={{ ...labelStyle, marginTop: 8 }}>
                Cook a few recipes and rate them. Patterns emerge after about three.
              </div>
            </div>
          ) : observations.length === 0 ? (
            <div style={{ ...labelStyle }}>Nothing surprising yet — keep cooking.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {observations.map((o, i) => (
                <div key={i} style={{ border: "1px solid var(--hairline)", padding: 24 }}>
                  <div style={{
                    fontFamily: "var(--font-display)", fontWeight: 400, fontStyle: "italic",
                    fontSize: 22, color: "var(--fg)", lineHeight: 1.3,
                  }}>{o.observation}</div>
                  <div style={{
                    marginTop: 12, display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: 12, flexWrap: "wrap",
                  }}>
                    <div style={{ ...labelStyle, fontSize: 11, color: "var(--fg-low)" }}>
                      Based on {(o.supporting_recipes ?? []).length} recipes
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <button
                        onClick={() => setDiscussObs({ text: o.observation, field: "notable_observations" })}
                        style={{
                          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
                          textTransform: "uppercase", color: "var(--saffron)",
                          background: "transparent", border: 0, cursor: "pointer", padding: 0,
                        }}
                      >Tell us more</button>
                      <button
                        onClick={() => dismissObs(o.observation)}
                        style={{
                          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
                          textTransform: "uppercase", color: "var(--fg-low)",
                          background: "transparent", border: 0, cursor: "pointer", padding: 0,
                        }}
                      >Dismiss</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...labelStyle, marginTop: 64, marginBottom: 16 }}>Recent</div>
        {recent.length === 0 ? (
          <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-muted)", margin: 0 }}>
            No recipes yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recent.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate({ to: "/recipes/$id", params: { id: r.id } })}
                style={{
                  textAlign: "left", background: "transparent", color: "var(--fg)",
                  borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)",
                  borderLeft: 0, borderRight: 0,
                  padding: 16, marginTop: -1, cursor: "pointer",
                }}
              >
                <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, fontSize: 22 }}>{r.title}</div>
                <div style={{ ...labelStyle, marginTop: 4 }}>
                  {(r.cuisine ?? "").toUpperCase()}{r.time_estimate_minutes ? ` · ${r.time_estimate_minutes} MIN` : ""}
                </div>
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => navigate({ to: "/cookbook" })}
            style={{
              fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
              textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--saffron)",
              background: "transparent", border: 0, cursor: "pointer", padding: 0,
              display: "inline-flex", alignItems: "center", gap: 10,
            }}
          >
            View cookbook ↗
          </button>
        </div>
      </main>

      <DiscussModal
        open={!!discussObs}
        observationText={discussObs?.text ?? ""}
        appliedToField={discussObs?.field}
        onClose={() => setDiscussObs(null)}
        onSubmitted={() => { showToast("Updated. We're listening."); setTimeout(loadPortrait, 8000); }}
      />

      {toast && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          padding: "12px 24px", border: "1px solid var(--saffron-muted)",
          background: "var(--surface-elev)", color: "var(--saffron)",
          fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16,
          zIndex: 60,
        }}>{toast}</div>
      )}
    </div>
  );
}
