import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";
import { ShareButton } from "@/components/share/ShareButton";
import { toCelebrityKey } from "@/lib/celebrity-key";

export const Route = createFileRoute("/duels")({
  head: () => ({
    meta: [
      { title: "Chef Duels — Culinario" },
      { name: "description", content: "Replay every chef battle you've ever staged." },
    ],
  }),
  component: DuelsListPage,
});

type DuelRow = {
  id: string;
  chef_a: string | null;
  chef_b: string | null;
  challenge: string | null;
  chef_a_portrait_url: string | null;
  chef_b_portrait_url: string | null;
  winner_slug: string | null;
  created_at: string | null;
};

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};

function ChefAvatar({ src, name, size = 72 }: { src: string | null; name: string; size?: number }) {
  const initial = (name?.[0] ?? "?").toUpperCase();
  return (
    <div
      aria-label={name}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: src
          ? `center/cover no-repeat url(${src})`
          : "color-mix(in oklab, var(--saffron) 18%, var(--surface-elev))",
        border: "2px solid color-mix(in oklab, var(--saffron) 65%, transparent)",
        boxShadow: "0 0 0 4px color-mix(in oklab, var(--saffron) 14%, transparent), 0 8px 24px -8px color-mix(in oklab, var(--saffron) 55%, transparent)",
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--saffron)",
        fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600,
        fontSize: size * 0.4,
      }}
    >
      {!src && initial}
    </div>
  );
}

function DuelsListPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [duels, setDuels] = useState<DuelRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [portraitByKey, setPortraitByKey] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (loading) return;
    if (!session) { navigate({ to: "/sign-in" }); return; }
    (async () => {
      const { data, error } = await supabase
        .from("duels" as any)
        .select("id, chef_a, chef_b, challenge, chef_a_portrait_url, chef_b_portrait_url, winner_slug, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) { setErr(error.message); return; }
      const rows = (data as any[]) ?? [];
      setDuels(rows as any);
      const keys = Array.from(new Set(
        rows.flatMap((d) => [toCelebrityKey(d.chef_a), toCelebrityKey(d.chef_b)]).filter(Boolean)
      )) as string[];
      if (keys.length > 0) {
        const { data: personas } = await supabase
          .from("celebrity_personas" as any)
          .select("celebrity_key, portrait_url")
          .in("celebrity_key", keys);
        const map: Record<string, string | null> = {};
        for (const p of (personas as any[]) ?? []) map[p.celebrity_key] = p.portrait_url ?? null;
        setPortraitByKey(map);
      }
    })();
  }, [session, loading, navigate]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader current="Duels" />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 120, position: "relative" }}>
        {/* Ambient orbs for funky glassmorphic vibe */}
        <div className="duels-orb duels-orb-a" />
        <div className="duels-orb duels-orb-b" />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={eyebrow}>№ 008 — Chef Duels Archive</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
            fontSize: "clamp(48px, 7vw, 80px)", lineHeight: 1.05,
            letterSpacing: "-0.02em", margin: "16px 0 12px",
          }}>
            Every battle, replayable.
          </h1>
          <p style={{
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 18, color: "var(--fg-muted)", margin: 0, maxWidth: 560,
          }}>
            Tap any duel to step back into the studio and watch it unfold again.
          </p>

          <div style={{ marginTop: 28 }}>
            <Link
              to="/duel/"
              style={{
                display: "inline-block",
                fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                textTransform: "uppercase", letterSpacing: "0.2em",
                color: "var(--saffron)", textDecoration: "none",
                border: "1px solid var(--saffron)", padding: "12px 22px",
                borderRadius: 9999,
              }}
            >
              Launch a new battle ⚔
            </Link>
          </div>

          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 20 }}>
            {err && <div style={{ ...eyebrow, color: "var(--saffron)" }}>{err}</div>}
            {!err && duels === null && (
              <div style={eyebrow}>Loading the archive…</div>
            )}
            {!err && duels && duels.length === 0 && (
              <div style={{
                padding: "44px 28px", textAlign: "center",
                border: "1px dashed var(--hairline)", borderRadius: 9999,
              }}>
                <div style={{
                  fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 24,
                  color: "var(--fg-muted)",
                }}>No duels yet.</div>
                <button
                  onClick={() => navigate({ to: "/duel/" })}
                  style={{
                    marginTop: 18,
                    fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                    textTransform: "uppercase", letterSpacing: "0.2em",
                    color: "var(--saffron)", background: "transparent",
                    border: "1px solid var(--saffron)", padding: "12px 22px",
                    borderRadius: 9999, cursor: "pointer",
                  }}
                >Stage your first duel ⚔</button>
              </div>
            )}

            {duels?.map((d) => (
              <div key={d.id} style={{ position: "relative" }}>
                <DuelRowCard
                  duel={d}
                  portraitA={portraitByKey[toCelebrityKey(d.chef_a)] ?? d.chef_a_portrait_url}
                  portraitB={portraitByKey[toCelebrityKey(d.chef_b)] ?? d.chef_b_portrait_url}
                  onClick={() => navigate({ to: "/duel/$id", params: { id: d.id } })}
                />
                <div
                  style={{ position: "absolute", top: 10, right: 18, zIndex: 2 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ShareButton
                    kind="duel"
                    targetId={d.id}
                    targetLabel={`${d.chef_a ?? "Chef A"} vs ${d.chef_b ?? "Chef B"}`}
                    label="Share ↗"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          .duels-orb { position: absolute; border-radius: 9999px; filter: blur(80px); opacity: 0.35; pointer-events: none; z-index: 0; }
          .duels-orb-a {
            width: 460px; height: 460px; top: -120px; left: -100px;
            background: radial-gradient(circle, color-mix(in oklab, var(--saffron) 70%, transparent), transparent 65%);
            animation: duels-float-a 14s ease-in-out infinite;
          }
          .duels-orb-b {
            width: 520px; height: 520px; top: 30%; right: -160px;
            background: radial-gradient(circle, #e63946aa, transparent 65%);
            animation: duels-float-b 18s ease-in-out infinite;
          }
          @keyframes duels-float-a {
            0%,100% { transform: translate(0,0) scale(1); }
            50%     { transform: translate(40px, 60px) scale(1.08); }
          }
          @keyframes duels-float-b {
            0%,100% { transform: translate(0,0) scale(1); }
            50%     { transform: translate(-50px, -40px) scale(1.1); }
          }
          .duel-row {
            position: relative;
            display: grid;
            grid-template-columns: auto 1fr auto 1fr auto;
            align-items: center;
            gap: 18px;
            padding: 18px 28px;
            border-radius: 9999px;
            border: 1px solid color-mix(in oklab, var(--fg) 12%, transparent);
            background: color-mix(in oklab, var(--surface-elev) 50%, transparent);
            backdrop-filter: blur(22px) saturate(160%);
            -webkit-backdrop-filter: blur(22px) saturate(160%);
            box-shadow:
              0 14px 40px -18px color-mix(in oklab, var(--saffron) 45%, transparent),
              inset 0 1px 0 color-mix(in oklab, white 14%, transparent);
            cursor: pointer;
            text-align: left;
            color: var(--fg);
            transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease;
            overflow: hidden;
          }
          .duel-row::before {
            content: "";
            position: absolute; inset: 0;
            background: linear-gradient(110deg, transparent 35%, color-mix(in oklab, white 20%, transparent) 50%, transparent 65%);
            transform: translateX(-120%);
            pointer-events: none;
            border-radius: inherit;
          }
          .duel-row:hover {
            transform: translateY(-2px);
            border-color: color-mix(in oklab, var(--saffron) 55%, transparent);
            box-shadow:
              0 22px 50px -18px color-mix(in oklab, var(--saffron) 70%, transparent),
              inset 0 1px 0 color-mix(in oklab, white 22%, transparent);
          }
          .duel-row:hover::before { animation: duel-row-sweep 1100ms ease forwards; }
          @keyframes duel-row-sweep {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(120%); }
          }
          .duel-vs {
            display: flex; flex-direction: column; align-items: center; gap: 6px;
            min-width: 92px;
          }
          .duel-vs-big {
            font-family: var(--font-display); font-style: italic; font-weight: 700;
            font-size: 38px; line-height: 1;
            color: var(--saffron);
            text-shadow: 0 2px 18px color-mix(in oklab, var(--saffron) 55%, transparent);
            letter-spacing: 0.04em;
          }
          .duel-vs-food {
            font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.22em;
            text-transform: uppercase; color: var(--fg-muted);
            text-align: center; max-width: 140px; line-height: 1.3;
          }
          .duel-name {
            font-family: var(--font-display); font-style: italic; font-weight: 500;
            font-size: 20px; line-height: 1.15; color: var(--fg);
            overflow: hidden; text-overflow: ellipsis;
          }
          .duel-name-b { text-align: right; }
          .duel-winner-tag {
            display: inline-block; margin-top: 4px;
            font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.2em;
            text-transform: uppercase; color: var(--saffron);
          }
          @media (max-width: 640px) {
            .duel-row {
              grid-template-columns: auto 1fr auto;
              grid-template-areas:
                "a vs b"
                "na food nb";
              padding: 16px 20px;
              border-radius: 36px;
              row-gap: 8px;
            }
            .duel-vs-big { font-size: 28px; }
            .duel-name { font-size: 16px; }
          }
        `}</style>
      </main>
    </div>
  );
}

function DuelRowCard({ duel, portraitA, portraitB, onClick }: {
  duel: DuelRow;
  portraitA: string | null;
  portraitB: string | null;
  onClick: () => void;
}) {
  const winnerSlug = (duel.winner_slug ?? "").toString().toLowerCase();
  const isAWinner = !!winnerSlug && (winnerSlug === "a" || winnerSlug === "chef_a");
  const isBWinner = winnerSlug && !isAWinner;
  return (
    <button className="duel-row" onClick={onClick} type="button">
      <ChefAvatar src={portraitA} name={duel.chef_a ?? "Chef A"} />
      <div>
        <div className="duel-name">{duel.chef_a ?? "Chef A"}</div>
        {isAWinner && <div className="duel-winner-tag">Winner ★</div>}
      </div>
      <div className="duel-vs">
        <div className="duel-vs-big">VS</div>
        {duel.challenge && <div className="duel-vs-food">{duel.challenge}</div>}
      </div>
      <div>
        <div className="duel-name duel-name-b">{duel.chef_b ?? "Chef B"}</div>
        {isBWinner && <div className="duel-winner-tag" style={{ display: "block", textAlign: "right" }}>Winner ★</div>}
      </div>
      <ChefAvatar src={portraitB} name={duel.chef_b ?? "Chef B"} />
    </button>
  );
}
