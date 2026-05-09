import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/duel")({
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
    </div>
  );
}
