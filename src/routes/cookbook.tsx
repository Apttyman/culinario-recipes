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

type Status = "all" | "cooked" | "saved" | "rated" | "unrated";
type Sort = "newest" | "oldest" | "rating" | "title" | "time";

function Cookbook() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<any[] | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [cuisine, setCuisine] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [maxTime, setMaxTime] = useState<string>("any");
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    supabase.from("recipes").select("*").eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRecipes(data ?? []);
        // eslint-disable-next-line no-console
        console.log("[cookbook] sample recipe fields", (data ?? []).slice(0, 3).map((r: any) => ({
          title: r.title, cuisine: r.cuisine, difficulty: r.difficulty, time: r.time_estimate_minutes,
        })));
      });
  }, [session]);

  const stats = useMemo(() => {
    if (!recipes) return null;
    const cooked = recipes.filter((r) => r.cooked_at).length;
    const rated = recipes.filter((r) => r.rating != null);
    const avg = rated.length ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : "—";
    return { total: recipes.length, cooked, avg };
  }, [recipes]);

  const groupCounts = (key: "cuisine" | "difficulty") => {
    const m = new Map<string, number>();
    (recipes ?? []).forEach((r) => {
      const v = r[key];
      if (!v) return;
      m.set(v, (m.get(v) ?? 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };
  const cuisines = useMemo(() => groupCounts("cuisine"), [recipes]);
  const difficulties = useMemo(() => groupCounts("difficulty"), [recipes]);

  const TIME_BUCKETS: { key: string; label: string; test: (n: number) => boolean }[] = [
    { key: "15", label: "≤ 15 min", test: (n) => n <= 15 },
    { key: "30", label: "≤ 30 min", test: (n) => n <= 30 },
    { key: "45", label: "≤ 45 min", test: (n) => n <= 45 },
    { key: "60", label: "≤ 60 min", test: (n) => n <= 60 },
    { key: "120", label: "≤ 2 hrs", test: (n) => n <= 120 },
  ];
  const timeCounts = useMemo(() => {
    return TIME_BUCKETS.map((b) => ({
      ...b,
      count: (recipes ?? []).filter((r) => typeof r.time_estimate_minutes === "number" && b.test(r.time_estimate_minutes)).length,
    })).filter((b) => b.count > 0);
  }, [recipes]);

  const filtered = useMemo(() => {
    if (!recipes) return [];
    let out = recipes.slice();
    if (status === "cooked") out = out.filter((r) => r.cooked_at);
    else if (status === "saved") out = out.filter((r) => !r.cooked_at);
    else if (status === "rated") out = out.filter((r) => r.rating != null);
    else if (status === "unrated") out = out.filter((r) => r.rating == null);
    if (cuisine !== "all") out = out.filter((r) => r.cuisine === cuisine);
    if (difficulty !== "all") out = out.filter((r) => r.difficulty === difficulty);
    if (maxTime !== "any") {
      const t = parseInt(maxTime, 10);
      out = out.filter((r) => typeof r.time_estimate_minutes === "number" && r.time_estimate_minutes <= t);
    }
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((r) =>
      (r.title ?? "").toLowerCase().includes(q) ||
      (r.cuisine ?? "").toLowerCase().includes(q) ||
      (r.chef_inspiration ?? "").toLowerCase().includes(q)
    );
    switch (sort) {
      case "oldest": out.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)); break;
      case "rating": out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)); break;
      case "title": out.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")); break;
      case "time": out.sort((a, b) => (a.time_estimate_minutes ?? 9999) - (b.time_estimate_minutes ?? 9999)); break;
      default: out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return out;
  }, [recipes, status, cuisine, difficulty, maxTime, query, sort]);

  const activeFilters =
    (status !== "all" ? 1 : 0) +
    (cuisine !== "all" ? 1 : 0) +
    (difficulty !== "all" ? 1 : 0) +
    (maxTime !== "any" ? 1 : 0) +
    (query.trim() ? 1 : 0);

  const clearAll = () => {
    setQuery(""); setStatus("all"); setCuisine("all");
    setDifficulty("all"); setMaxTime("any"); setSort("newest");
  };

  const statusChip = (key: Status, label: string) => {
    const sel = status === key;
    return (
      <button
        key={key}
        onClick={() => setStatus(key)}
        style={{
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
          padding: "6px 0", background: "transparent", color: sel ? "var(--fg)" : "var(--fg-muted)",
          border: 0, borderBottom: `1px solid ${sel ? "var(--saffron)" : "var(--hairline)"}`, cursor: "pointer",
        }}
      >{label}</button>
    );
  };

  const selectStyle: React.CSSProperties = {
    appearance: "none",
    WebkitAppearance: "none",
    background: "transparent",
    color: "var(--fg)",
    colorScheme: "dark",
    border: 0,
    borderBottom: "1px solid var(--hairline)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    padding: "8px 22px 8px 0",
    cursor: "pointer",
    outline: "none",
    minWidth: 0,
    backgroundImage:
      "linear-gradient(45deg, transparent 50%, var(--fg-muted) 50%), linear-gradient(135deg, var(--fg-muted) 50%, transparent 50%)",
    backgroundPosition: "calc(100% - 12px) 50%, calc(100% - 7px) 50%",
    backgroundSize: "5px 5px, 5px 5px",
    backgroundRepeat: "no-repeat",
  };

  const fieldLabel: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em",
    textTransform: "uppercase", color: "var(--fg-low)", marginBottom: 6,
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

        {/* Search bar */}
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, cuisine, or inspiration"
            style={{
              width: "100%", boxSizing: "border-box",
              background: "transparent", color: "var(--fg)",
              border: 0, borderBottom: "1px solid var(--hairline)",
              fontFamily: "var(--font-display)", fontStyle: "italic",
              fontSize: "clamp(18px, 3vw, 24px)", padding: "10px 28px 10px 0",
              outline: "none",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              style={{
                position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: 0, color: "var(--fg-muted)",
                fontFamily: "var(--font-mono)", fontSize: 14, cursor: "pointer", padding: 4,
              }}
            >×</button>
          )}
        </div>

        {/* Status chips */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 24 }}>
          {statusChip("all", "All")}
          {statusChip("cooked", "Cooked")}
          {statusChip("saved", "Saved")}
          {statusChip("rated", "Rated")}
          {statusChip("unrated", "Unrated")}
        </div>

        {/* Selects */}
        <div style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 20,
        }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={fieldLabel}>Cuisine</span>
            <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} style={selectStyle}>
              <option value="all">Any cuisine</option>
              {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={fieldLabel}>Difficulty</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={selectStyle}>
              <option value="all">Any level</option>
              {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={fieldLabel}>Max time</span>
            <select value={maxTime} onChange={(e) => setMaxTime(e.target.value)} style={selectStyle}>
              <option value="any">Any length</option>
              <option value="15">≤ 15 min</option>
              <option value="30">≤ 30 min</option>
              <option value="45">≤ 45 min</option>
              <option value="60">≤ 60 min</option>
              <option value="120">≤ 2 hrs</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={fieldLabel}>Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={selectStyle}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="rating">Highest rated</option>
              <option value="title">Title A–Z</option>
              <option value="time">Quickest first</option>
            </select>
          </div>
        </div>

        {/* Result count + clear */}
        <div style={{
          marginTop: 24, marginBottom: 24,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
          paddingTop: 16, borderTop: "1px solid var(--hairline)",
        }}>
          <span style={labelMono}>
            {recipes ? `${filtered.length} ${filtered.length === 1 ? "recipe" : "recipes"}` : "Loading…"}
          </span>
          {activeFilters > 0 && (
            <button
              onClick={clearAll}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em",
                textTransform: "uppercase", color: "var(--saffron)",
                background: "transparent", border: 0, cursor: "pointer", padding: 0,
              }}
            >Clear filters ({activeFilters})</button>
          )}
        </div>

        {!recipes && <div style={labelMono}>Loading…</div>}
        {recipes && filtered.length === 0 && (
          <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-muted)" }}>Nothing matches those filters.</p>
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
                  {(r.cuisine ?? "").toUpperCase()}{r.time_estimate_minutes ? ` · ${r.time_estimate_minutes} MIN` : ""}{r.difficulty ? ` · ${String(r.difficulty).toUpperCase()}` : ""}
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
