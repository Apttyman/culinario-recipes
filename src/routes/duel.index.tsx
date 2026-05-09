import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/duel/")({
  head: () => ({
    meta: [
      { title: "Battling Chef Mode — Culinario" },
      { name: "description", content: "Stage a cooking duel between any two chefs — real, fictional, dead, alive." },
    ],
  }),
  component: DuelStartPage,
});

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};
const hairline: React.CSSProperties = { border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" };
const inputStyle: React.CSSProperties = {
  width: "100%", background: "transparent", color: "var(--fg)",
  border: 0, borderBottom: "1px solid var(--hairline)",
  fontFamily: "var(--font-display)", fontStyle: "italic",
  fontSize: "clamp(18px, 4vw, 26px)", padding: "8px 0", outline: "none",
  boxSizing: "border-box",
};

function DuelStartPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [chefA, setChefA] = useState("");
  const [chefB, setChefB] = useState("");
  const [challenge, setChallenge] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const phrases = [
    "Setting the table…",
    "Sharpening the knives…",
    "Polishing the silverware…",
    "Cueing the host…",
    "Lighting the burners…",
    "Drawing the curtain…",
  ];
  useEffect(() => {
    if (!busy) { setPhraseIdx(0); return; }
    const t = setInterval(() => setPhraseIdx((i) => (i + 1) % phrases.length), 1400);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
  }, [session, loading, navigate]);

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
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 240 }}>
        <div style={eyebrow}>№ 008 — Battling Chef Mode</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
          fontSize: "clamp(48px, 7vw, 80px)", lineHeight: 1.05,
          letterSpacing: "-0.02em", margin: "16px 0 12px",
        }}>
          Stage a duel.
        </h1>
        <p style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: 20, color: "var(--fg-muted)", margin: 0, maxWidth: 560,
        }}>
          Two chefs enter the kitchen — anyone, real or imagined. We host the show, plate both dishes,
          stage the trash talk, and crown a winner.
        </p>

        <hr style={hairline} />

        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>
          <div>
            <label style={eyebrow}>Chef A</label>
            <input
              autoFocus
              value={chefA} onChange={(e) => setChefA(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && chefB) start(); }}
              placeholder="e.g. Julia Child"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={eyebrow}>Chef B</label>
            <input
              value={chefB} onChange={(e) => setChefB(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && chefA) start(); }}
              placeholder="e.g. Anthony Bourdain"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={eyebrow}>Challenge (optional)</label>
            <input
              value={challenge} onChange={(e) => setChallenge(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") start(); }}
              placeholder="e.g. one chicken, one hour"
              style={inputStyle}
            />
          </div>
          <div>
            <button
              type="button"
              onClick={start}
              disabled={!chefA.trim() || !chefB.trim() || busy}
              style={{
                fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                textTransform: "uppercase", letterSpacing: "0.2em",
                color: !chefA.trim() || !chefB.trim() || busy ? "var(--fg-low)" : "var(--saffron)",
                background: "transparent",
                border: "1px solid",
                borderColor: !chefA.trim() || !chefB.trim() || busy ? "var(--hairline)" : "var(--saffron)",
                cursor: !chefA.trim() || !chefB.trim() || busy ? "not-allowed" : "pointer",
                padding: "14px 22px", minHeight: 48, borderRadius: 0,
              }}
            >
              {busy ? "Setting the table…" : "Start the duel ⚔"}
            </button>
          </div>
          {err && <div style={{ ...eyebrow, color: "var(--saffron)" }}>{err}</div>}
        </div>
      </main>
      {busy && <DuelOverlay chefA={chefA.trim()} chefB={chefB.trim()} phrase={phrases[phraseIdx]} />}
    </div>
  );
}

function DuelOverlay({ chefA, chefB, phrase }: { chefA: string; chefB: string; phrase: string }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "color-mix(in oklab, var(--bg) 55%, transparent)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        animation: "duel-fade-in 360ms ease-out both",
        overflow: "hidden",
        padding: 24,
      }}
    >
      <div className="duel-orb duel-orb-1" />
      <div className="duel-orb duel-orb-2" />
      <div className="duel-orb duel-orb-3" />

      <div
        style={{
          position: "relative",
          padding: "44px 56px",
          borderRadius: 28,
          border: "1px solid color-mix(in oklab, var(--fg) 14%, transparent)",
          background: "color-mix(in oklab, var(--bg) 35%, transparent)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.45), inset 0 1px 0 color-mix(in oklab, white 18%, transparent)",
          textAlign: "center",
          maxWidth: 560,
          animation: "duel-pop 520ms cubic-bezier(.2,.9,.3,1.2) both",
        }}
      >
        <div style={eyebrow}>№ 008 — Battling Chef Mode</div>
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 18, flexWrap: "wrap",
            margin: "14px 0 22px",
            fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 300,
            fontSize: "clamp(28px, 4.5vw, 44px)", lineHeight: 1.1,
          }}
        >
          <span
            style={{
              background: "linear-gradient(110deg, var(--fg) 30%, var(--saffron) 50%, var(--fg) 70%)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text", backgroundClip: "text",
              color: "transparent",
              animation: "duel-shimmer 2.4s linear infinite",
            }}
          >
            {chefA || "Chef A"}
          </span>
          <span style={{ color: "var(--saffron)", fontSize: "0.7em", letterSpacing: "0.06em" }}>vs</span>
          <span
            style={{
              background: "linear-gradient(110deg, var(--fg) 30%, var(--saffron) 50%, var(--fg) 70%)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text", backgroundClip: "text",
              color: "transparent",
              animation: "duel-shimmer 2.4s linear infinite",
              animationDelay: "1.2s",
            }}
          >
            {chefB || "Chef B"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 18 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="duel-plate" style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </div>

        <div
          key={phrase}
          style={{
            ...eyebrow, color: "var(--fg-muted)",
            animation: "duel-fade-in 380ms ease-out both",
          }}
        >
          {phrase}
        </div>
      </div>

      <style>{`
        @keyframes duel-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes duel-pop {
          0%   { opacity: 0; transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes duel-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes duel-float-a {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(40px,-30px) scale(1.08); }
        }
        @keyframes duel-float-b {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(-50px,40px) scale(1.12); }
        }
        @keyframes duel-float-c {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(30px,50px) scale(0.95); }
        }
        .duel-orb {
          position: absolute; border-radius: 9999px; filter: blur(40px);
          opacity: 0.55; pointer-events: none;
        }
        .duel-orb-1 {
          width: 360px; height: 360px; top: -80px; left: -60px;
          background: radial-gradient(circle at 30% 30%, #e63946, transparent 60%);
          animation: duel-float-a 9s ease-in-out infinite;
        }
        .duel-orb-2 {
          width: 420px; height: 420px; bottom: -120px; right: -80px;
          background: radial-gradient(circle at 50% 50%, var(--saffron), transparent 60%);
          animation: duel-float-b 11s ease-in-out infinite;
        }
        .duel-orb-3 {
          width: 300px; height: 300px; top: 40%; left: 55%;
          background: radial-gradient(circle at 50% 50%, #39ff14, transparent 60%);
          animation: duel-float-c 13s ease-in-out infinite;
        }
        @keyframes duel-bounce {
          0%,80%,100% { transform: translateY(0); opacity: 0.4; }
          40%         { transform: translateY(-10px); opacity: 1; }
        }
        .duel-plate {
          width: 12px; height: 12px; border-radius: 9999px;
          background: var(--saffron);
          box-shadow: 0 0 14px color-mix(in oklab, var(--saffron) 70%, transparent);
          animation: duel-bounce 1.2s ease-in-out infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}
