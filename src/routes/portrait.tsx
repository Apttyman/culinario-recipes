import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";
import { DiscussModal } from "@/components/DiscussModal";
import { triggerPortraitSynthesis } from "@/lib/portrait";

export const Route = createFileRoute("/portrait")({
  head: () => ({ meta: [{ title: "Profile — Culinario" }] }),
  component: Portrait,
});

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};
const sectionHeader: React.CSSProperties = {
  fontFamily: "var(--font-display)", fontWeight: 500,
  fontVariantCaps: "small-caps", textTransform: "uppercase",
  letterSpacing: "0.15em", fontSize: 16, color: "var(--fg)", margin: "0 0 24px",
};
const subHeader: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", marginBottom: 12,
};
const hairline: React.CSSProperties = { border: 0, height: 1, background: "var(--hairline)", margin: "64px 0" };

function Chips({ items, color, tag }: { items: any[]; color: string; tag?: string }) {
  if (!items?.length) return <div style={{ ...eyebrow, color: "var(--fg-low)" }}>—</div>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color }}>
            {it.name}{tag ? ` · ${tag}` : ""}
          </div>
          <div style={{ ...eyebrow, fontSize: 10, marginTop: 2 }}>
            Confidence {(it.confidence ?? 0).toFixed(2)} · {it.evidence_count ?? 0} instances
          </div>
        </div>
      ))}
    </div>
  );
}

function Portrait() {
  const { session, loading, profile } = useAuth();
  const navigate = useNavigate();
  const [portrait, setPortrait] = useState<any | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [recipeTitles, setRecipeTitles] = useState<Record<string, string>>({});
  const [discussObs, setDiscussObs] = useState<{ text: string; field?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [resyncBusy, setResyncBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
    else if (profile && !profile.onboarding_complete) navigate({ to: "/onboarding" });
  }, [session, loading, profile, navigate]);

  const load = () => {
    if (!session?.user) return;
    const uid = session.user.id;
    supabase.from("taste_portraits").select("*").eq("user_id", uid).maybeSingle()
      .then(({ data }) => setPortrait(data));
    supabase.from("people").select("id,name").eq("user_id", uid).then(({ data }) => setPeople(data ?? []));
  };
  useEffect(load, [session]);

  // Resolve supporting_recipes UUIDs to titles (cached).
  useEffect(() => {
    if (!session?.user || !portrait) return;
    const obsList: any[] = portrait.notable_observations ?? [];
    const ids = Array.from(new Set(
      obsList.flatMap((o) => (o?.supporting_recipes ?? []) as string[])
    )).filter((id) => id && !(id in recipeTitles));
    if (ids.length === 0) return;
    supabase.from("recipes").select("id,title").in("id", ids).then(({ data }) => {
      if (!data) return;
      setRecipeTitles((prev) => {
        const next = { ...prev };
        for (const r of data as any[]) next[r.id] = r.title ?? r.id.slice(0, 8);
        return next;
      });
    });
  }, [portrait, session, recipeTitles]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  const setSurprise = async (v: number) => {
    if (!session?.user) return;
    setPortrait((p: any) => p ? { ...p, surprise_tolerance: v } : p);
    await supabase.from("taste_portraits").update({ surprise_tolerance: v }).eq("user_id", session.user.id);
  };

  const resync = async () => {
    setResyncBusy(true);
    try {
      await supabase.functions.invoke("synthesize-portrait", { body: {} });
      load();
      showToast("Resynthesized.");
    } finally { setResyncBusy(false); }
  };

  const sCount = portrait?.synthesis_count ?? 0;
  const subtitle = sCount < 5 ? "Still early. We'll know you better as you cook."
    : sCount < 20 ? "We're getting a sense of you. Some of this might be wrong — tell us when it is."
    : "We're getting closer to mind-reading territory.";

  const flavor = portrait?.flavor_preferences ?? { loves: [], dislikes: [], emerging: [] };
  const tech = portrait?.technique_preferences ?? { loves: [], dislikes: [], emerging: [] };
  const cuisine = portrait?.cuisine_patterns ?? {};
  const timeP = portrait?.time_patterns ?? {};
  const seasonal = portrait?.seasonal_patterns ?? {};
  const peoplePat = portrait?.people_patterns ?? {};
  const obs: any[] = portrait?.notable_observations ?? [];

  const peopleName = (key: string) => {
    const p = people.find((x) => x.id === key);
    return p?.name ?? key;
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader current="Profile" />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <div style={eyebrow}>№ 006 — Profile</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
          fontSize: "clamp(48px, 7vw, 80px)", lineHeight: 1.05,
          letterSpacing: "-0.02em", margin: "16px 0 12px", color: "var(--fg)",
        }}>What we've learned about how you cook.</h1>
        <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 16, color: "var(--fg-muted)", margin: 0 }}>{subtitle}</p>

        <hr style={hairline} />

        <h2 style={sectionHeader}>Flavor</h2>
        <div style={{ ...subHeader, color: "var(--saffron)" }}>Loves</div>
        <Chips items={flavor.loves ?? []} color="var(--fg)" />
        <div style={{ ...subHeader, color: "var(--fg-muted)", marginTop: 32 }}>Dislikes</div>
        <Chips items={flavor.dislikes ?? []} color="var(--fg-muted)" />
        <div style={{ ...subHeader, color: "var(--fg-low)", marginTop: 32 }}>Emerging</div>
        <Chips items={flavor.emerging ?? []} color="var(--fg-low)" tag="still uncertain" />

        <hr style={hairline} />

        <h2 style={sectionHeader}>Technique</h2>
        <div style={{ ...subHeader, color: "var(--saffron)" }}>Loves</div>
        <Chips items={tech.loves ?? []} color="var(--fg)" />
        <div style={{ ...subHeader, color: "var(--fg-muted)", marginTop: 32 }}>Dislikes</div>
        <Chips items={tech.dislikes ?? []} color="var(--fg-muted)" />
        <div style={{ ...subHeader, color: "var(--fg-low)", marginTop: 32 }}>Emerging</div>
        <Chips items={tech.emerging ?? []} color="var(--fg-low)" tag="still uncertain" />

        <hr style={hairline} />

        <h2 style={sectionHeader}>Cuisine patterns</h2>
        {Object.keys(cuisine).length === 0 ? (
          <div style={{ ...eyebrow, color: "var(--fg-low)" }}>—</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {Object.entries(cuisine).map(([name, v]: any) => (
              <div key={name} style={{
                display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 16,
                padding: "12px 0", borderBottom: "1px solid var(--hairline)", alignItems: "baseline",
              }}>
                <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18 }}>{name}</span>
                <span style={{ ...eyebrow }}>{(v.avg_rating ?? 0).toFixed(1)}★</span>
                <span style={{ ...eyebrow }}>{v.count ?? 0}</span>
                <span style={{
                  ...eyebrow,
                  color: v.trend === "rising" ? "var(--saffron)" : v.trend === "declining" ? "var(--fg-muted)" : "var(--fg-low)",
                }}>{v.trend === "rising" ? "↑" : v.trend === "declining" ? "↓" : "—"}</span>
              </div>
            ))}
          </div>
        )}

        <hr style={hairline} />

        <h2 style={sectionHeader}>Time & energy</h2>
        <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color: "var(--fg)", margin: 0 }}>
          {timeP.weekday_evenings ? `On weekdays, you cook in about ${timeP.weekday_evenings.avg_time_min} minutes (${timeP.weekday_evenings.dominant_difficulty}).` : "Weekday pattern not yet visible."}
          {" "}
          {timeP.weekends ? `On weekends, you spend around ${timeP.weekends.avg_time_min}.` : ""}
        </p>

        <hr style={hairline} />

        <h2 style={sectionHeader}>Seasonal</h2>
        <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color: "var(--fg)", margin: 0 }}>
          {seasonal.current_month_observations || "No seasonal pattern observed yet."}
        </p>

        <hr style={hairline} />

        <h2 style={sectionHeader}>People</h2>
        {Object.keys(peoplePat).length === 0 ? (
          <div style={{ ...eyebrow, color: "var(--fg-low)" }}>—</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {Object.entries(peoplePat).map(([k, v]: any) => (
              <div key={k}>
                <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, fontSize: 24 }}>{peopleName(k)}</div>
                <div style={{ marginTop: 8, fontFamily: "var(--font-body)", fontSize: 16, color: "var(--fg-muted)" }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        <hr style={hairline} />

        <h2 style={sectionHeader}>Notable</h2>
        {obs.length === 0 ? (
          <div style={{ ...eyebrow, color: "var(--fg-low)" }}>Nothing notable yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {obs.map((o, i) => (
              <div key={i} style={{
                border: "1px solid var(--hairline)", padding: 24,
                opacity: o.dismissed ? 0.5 : 1,
              }}>
                <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 20, color: "var(--fg)", lineHeight: 1.3 }}>
                  {o.observation}
                </div>
                <div style={{ ...eyebrow, marginTop: 12 }}>
                  Based on {(o.supporting_recipes ?? []).length} recipes · confidence {(o.confidence ?? 0).toFixed(2)}
                  {o.dismissed ? " · DISMISSED" : ""}
                </div>
                {!o.dismissed && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      onClick={() => setDiscussObs({ text: o.observation, field: "notable_observations" })}
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
                        textTransform: "uppercase", color: "var(--saffron)",
                        background: "transparent", border: 0, cursor: "pointer", padding: 0,
                      }}
                    >Tell us more</button>
                  </div>
                )}
                {(o.supporting_recipes ?? []).length > 0 && (
                  <ol style={{ margin: "12px 0 0", paddingLeft: 20, color: "var(--fg-muted)", fontFamily: "var(--font-body)", fontSize: 14, overflowWrap: "anywhere" }}>
                    {(o.supporting_recipes ?? []).slice(0, 8).map((rid: string) => (
                      <li key={rid}>
                        <a
                          href={`/recipes/${rid}`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                            color: "var(--saffron)",
                            textDecoration: "underline",
                            overflowWrap: "anywhere",
                          }}
                        >{recipeTitles[rid] ?? rid.slice(0, 8)}</a>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        )}

        <hr style={hairline} />

        <h2 style={sectionHeader}>Settings</h2>
        <div style={subHeader}>Surprise tolerance</div>
        <input
          type="range" min={0} max={100} step={5}
          value={portrait?.surprise_tolerance ?? 25}
          onChange={(e) => setSurprise(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--saffron)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, ...eyebrow, color: "var(--fg-low)" }}>
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
        <div style={{ marginTop: 8, ...eyebrow, color: "var(--saffron)" }}>{portrait?.surprise_tolerance ?? 25} / 100</div>

        <div style={{ marginTop: 32 }}>
          <button
            onClick={resync}
            disabled={resyncBusy}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
              textTransform: "uppercase", color: resyncBusy ? "var(--fg-low)" : "var(--saffron)",
              background: "transparent", border: 0, cursor: resyncBusy ? "not-allowed" : "pointer", padding: 0,
            }}
          >{resyncBusy ? "Resynthesizing…" : "Resynthesize now ↻"}</button>
        </div>
      </main>

      <DiscussModal
        open={!!discussObs}
        observationText={discussObs?.text ?? ""}
        appliedToField={discussObs?.field}
        onClose={() => setDiscussObs(null)}
        onSubmitted={() => { showToast("Updated. We're listening."); setTimeout(load, 8000); }}
      />

      {toast && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          padding: "12px 24px", border: "1px solid var(--saffron-muted)",
          background: "var(--surface-elev)", color: "var(--saffron)",
          fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16, zIndex: 60,
        }}>{toast}</div>
      )}
    </div>
  );
}