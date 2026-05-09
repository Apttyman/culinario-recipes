import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/cookbook")({
  head: () => ({ meta: [{ title: "Cookbook — Culinario" }] }),
  component: Cookbook,
});

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};
const labelMono: React.CSSProperties = { ...eyebrow };
const hairline: React.CSSProperties = { border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" };

type Filter = "all" | "cooked" | "rated" | "unrated" | string;

function Cookbook() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    supabase.from("recipes").select("*").eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRecipes(data ?? []));
  }, [session]);

  const stats = useMemo(() => {
    if (!recipes) return null;
    const cooked = recipes.filter((r) => r.cooked_at).length;
    const rated = recipes.filter((r) => r.rating != null);
    const avg = rated.length ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : "—";
    return { total: recipes.length, cooked, avg };
  }, [recipes]);

  const cuisines = useMemo(() => {
    if (!recipes) return [];
    return Array.from(new Set(recipes.filter((r) => r.cooked_at && r.cuisine).map((r) => r.cuisine)));
  }, [recipes]);

  const filtered = useMemo(() => {
    if (!recipes) return [];
    switch (filter) {
      case "all": return recipes;
      case "cooked": return recipes.filter((r) => r.cooked_at);
      case "rated": return recipes.filter((r) => r.rating != null);
      case "unrated": return recipes.filter((r) => r.rating == null);
      default: return recipes.filter((r) => r.cuisine === filter);
    }
  }, [recipes, filter]);

  const filterChip = (key: Filter, label: string) => {
    const sel = filter === key;
    return (
      <button
        key={key}
        onClick={() => setFilter(key)}
        style={{
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
          padding: "6px 0", background: "transparent", color: sel ? "var(--fg)" : "var(--fg-muted)",
          border: 0, borderBottom: `1px solid ${sel ? "var(--saffron)" : "var(--hairline)"}`, cursor: "pointer",
        }}
      >{label}</button>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader current="Cookbook" />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <div style={eyebrow}>№ 005 — Cookbook</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
          fontSize: "clamp(48px, 7vw, 80px)", lineHeight: 1.05,
          letterSpacing: "-0.02em", margin: "16px 0 12px", color: "var(--fg)",
        }}>Everything you've cooked.</h1>
        {stats && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "var(--fg-muted)", margin: 0 }}>
            {stats.total} recipes saved · {stats.cooked} cooked · average rating {stats.avg}
          </p>
        )}
        <hr style={hairline} />
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 32 }}>
          {filterChip("all", "All")}
          {filterChip("cooked", "Cooked")}
          {filterChip("rated", "Rated")}
          {filterChip("unrated", "Unrated")}
          {cuisines.map((c) => filterChip(c, c))}
        </div>
        {!recipes && <div style={labelMono}>Loading…</div>}
        {recipes && filtered.length === 0 && (
          <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-muted)" }}>Nothing here yet.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate({ to: "/recipes/$id", params: { id: r.id } })}
              style={{
                textAlign: "left", background: "transparent", color: "var(--fg)",
                borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)",
                borderLeft: 0, borderRight: 0,
                padding: 16, marginTop: -1, cursor: "pointer",
                display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start",
                width: "100%", boxSizing: "border-box", maxWidth: "100%",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, fontSize: 22, color: "var(--fg)", overflowWrap: "anywhere", wordBreak: "break-word" }}>{r.title}</div>
                <div style={{ ...labelMono, marginTop: 4 }}>
                  {(r.cuisine ?? "").toUpperCase()}{r.time_estimate_minutes ? ` · ${r.time_estimate_minutes} MIN` : ""}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                {r.rating != null ? (
                  <div style={{ display: "flex", gap: 3 }}>
                    {[1,2,3,4,5].map((n) => (
                      <span key={n} style={{ width: 10, height: 10, background: n <= r.rating ? "var(--saffron)" : "transparent", border: "1px solid var(--hairline)" }} />
                    ))}
                  </div>
                ) : (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-low)" }}>—</span>
                )}
                {r.cooked_at && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontStyle: "italic", color: "var(--fg-low)" }}>
                    {new Date(r.cooked_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}