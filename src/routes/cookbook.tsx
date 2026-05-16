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
  type SharedKind = "recipe" | "inverse_set" | "duel" | "last_meal";
  type SharedItem = {
    kind: SharedKind;
    key: string;            // unique row key
    navId: string;          // id used for nav (recipe_id | session_id | duel_id | last_meal_id)
    title: string;
    subtitle: string | null;
    sharedBy: string | null;
  };
  const [sharedItems, setSharedItems] = useState<SharedItem[]>([]);

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
      });
    // Load shared-with-me items (all four kinds: recipe, inverse_set, duel, last_meal)
    (async () => {
      const { data: links } = await supabase
        .from("shared_recipe_links" as any)
        .select("id, recipe_id, inverse_session_id, duel_id, last_meal_id, shared_by_display_name, created_at")
        .eq("recipient_id", session.user.id)
        .order("created_at", { ascending: false });
      const rows: any[] = (links ?? []) as any[];
      if (!rows.length) { setSharedItems([]); return; }

      const recipeIds = rows.filter((l) => l.recipe_id).map((l) => l.recipe_id);
      const inverseSessionIds = rows.filter((l) => l.inverse_session_id).map((l) => l.inverse_session_id);
      const duelIds = rows.filter((l) => l.duel_id).map((l) => l.duel_id);
      const lastMealIds = rows.filter((l) => l.last_meal_id).map((l) => l.last_meal_id);

      const [{ data: rs }, { data: invRs }, { data: ds }, { data: lms }] = await Promise.all([
        recipeIds.length
          ? supabase.from("recipes").select("id, title, cuisine, time_estimate_minutes").in("id", recipeIds)
          : Promise.resolve({ data: [] as any[] }),
        inverseSessionIds.length
          ? supabase.from("recipes").select("inverse_session_id, inverse_celebrity").in("inverse_session_id", inverseSessionIds).not("inverse_celebrity", "is", null)
          : Promise.resolve({ data: [] as any[] }),
        duelIds.length
          ? supabase.from("duels" as any).select("id, chef_a, chef_b, challenge").in("id", duelIds)
          : Promise.resolve({ data: [] as any[] }),
        lastMealIds.length
          ? supabase.from("last_meals" as any).select("id, figure_name, epitaph").in("id", lastMealIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const recipeMap = new Map<string, any>();
      for (const r of (rs ?? []) as any[]) recipeMap.set(r.id, r);

      // For inverse sessions, group by session_id and pick the first celebrity name.
      const inverseCelebMap = new Map<string, string>();
      for (const r of (invRs ?? []) as any[]) {
        if (!inverseCelebMap.has(r.inverse_session_id)) {
          inverseCelebMap.set(r.inverse_session_id, r.inverse_celebrity);
        }
      }

      const duelMap = new Map<string, any>();
      for (const d of (ds ?? []) as any[]) duelMap.set(d.id, d);

      const lastMealMap = new Map<string, any>();
      for (const m of (lms ?? []) as any[]) lastMealMap.set(m.id, m);

      const items: SharedItem[] = [];
      for (const l of rows) {
        if (l.recipe_id && recipeMap.has(l.recipe_id)) {
          const r = recipeMap.get(l.recipe_id);
          items.push({
            kind: "recipe",
            key: l.id,
            navId: l.recipe_id,
            title: r?.title ?? "Recipe",
            subtitle: [r?.cuisine, r?.time_estimate_minutes ? `${r.time_estimate_minutes} min` : null].filter(Boolean).join(" · ") || null,
            sharedBy: l.shared_by_display_name ?? null,
          });
        } else if (l.inverse_session_id && inverseCelebMap.has(l.inverse_session_id)) {
          const celeb = inverseCelebMap.get(l.inverse_session_id)!;
          items.push({
            kind: "inverse_set",
            key: l.id,
            navId: l.inverse_session_id,
            title: `${celeb}'s menu`,
            subtitle: "Three dishes",
            sharedBy: l.shared_by_display_name ?? null,
          });
        } else if (l.duel_id && duelMap.has(l.duel_id)) {
          const d = duelMap.get(l.duel_id);
          items.push({
            kind: "duel",
            key: l.id,
            navId: l.duel_id,
            title: `${d?.chef_a ?? "Chef"} vs ${d?.chef_b ?? "Chef"}`,
            subtitle: d?.challenge ?? null,
            sharedBy: l.shared_by_display_name ?? null,
          });
        } else if (l.last_meal_id && lastMealMap.has(l.last_meal_id)) {
          const m = lastMealMap.get(l.last_meal_id);
          items.push({
            kind: "last_meal",
            key: l.id,
            navId: l.last_meal_id,
            title: `${m?.figure_name ?? "A figure"}'s last meal`,
            subtitle: m?.epitaph ?? null,
            sharedBy: l.shared_by_display_name ?? null,
          });
        }
      }
      setSharedItems(items);
    })();
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

  const fieldLabel: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em",
    textTransform: "uppercase", color: "var(--fg-low)", marginBottom: 10,
  };

  const pill = (active: boolean): React.CSSProperties => ({
    fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em",
    textTransform: "uppercase",
    padding: "6px 12px",
    background: active ? "color-mix(in oklab, var(--saffron) 14%, transparent)" : "transparent",
    color: active ? "var(--fg)" : "var(--fg-muted)",
    border: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
    borderRadius: 999,
    cursor: "pointer",
    display: "inline-flex", alignItems: "baseline", gap: 8,
    transition: "background 120ms, color 120ms, border-color 120ms",
  });
  const pillCount: React.CSSProperties = {
    fontSize: 10, color: "var(--fg-low)", letterSpacing: "0.1em",
  };

  const sortStyle: React.CSSProperties = {
    appearance: "none", WebkitAppearance: "none",
    background: "transparent", color: "var(--fg)", colorScheme: "dark",
    border: 0, borderBottom: "1px solid var(--hairline)",
    fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em",
    textTransform: "uppercase", padding: "6px 22px 6px 0", cursor: "pointer", outline: "none",
    backgroundImage:
      "linear-gradient(45deg, transparent 50%, var(--fg-muted) 50%), linear-gradient(135deg, var(--fg-muted) 50%, transparent 50%)",
    backgroundPosition: "calc(100% - 12px) 50%, calc(100% - 7px) 50%",
    backgroundSize: "5px 5px, 5px 5px", backgroundRepeat: "no-repeat",
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

        {sharedItems.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={labelMono}>Shared with you</div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {sharedItems.map((it) => {
                const kindLabel =
                  it.kind === "recipe" ? "Recipe" :
                  it.kind === "inverse_set" ? "Inverse menu" :
                  it.kind === "duel" ? "Duel" :
                  "Last meal";
                const openShared = () => {
                  if (it.kind === "recipe") {
                    navigate({ to: "/recipes/$id", params: { id: it.navId } });
                  } else if (it.kind === "duel") {
                    navigate({ to: "/duel/$id", params: { id: it.navId }, search: { act: 0 } });
                  } else if (it.kind === "last_meal") {
                    navigate({ to: "/last-meal/$id", params: { id: it.navId } });
                  } else {
                    // inverse_set — deep-link via the inverse archive with ?open=<celebrity>
                    const celeb = it.title.replace(/'s menu$/, "");
                    navigate({ to: "/inverse", search: { open: celeb } as any });
                  }
                };
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={openShared}
                    style={{
                      textAlign: "left", background: "transparent", color: "var(--fg)",
                      border: "1px solid color-mix(in oklab, var(--saffron) 50%, transparent)",
                      borderRadius: 12, padding: "12px 16px", cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500,
                        fontSize: 18, color: "var(--fg)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {it.title}
                      </div>
                      <div style={{ ...labelMono, marginTop: 4, color: "var(--saffron)" }}>
                        Shared by {it.sharedBy ?? "a friend"} · {kindLabel}
                      </div>
                      {it.subtitle && (
                        <div style={{
                          marginTop: 6,
                          fontFamily: "var(--font-body)", fontStyle: "italic",
                          fontSize: 14, color: "var(--fg-muted)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {it.subtitle}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
                      textTransform: "uppercase", color: "var(--saffron)",
                    }}>Open ↗</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Group-by chip filters */}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 24 }}>
          {cuisines.length > 0 && (
            <div>
              <div style={fieldLabel}>Cuisine</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button onClick={() => setCuisine("all")} style={pill(cuisine === "all")}>
                  <span>All</span><span style={pillCount}>{recipes?.length ?? 0}</span>
                </button>
                {cuisines.map(([name, count]) => (
                  <button key={name} onClick={() => setCuisine(name)} style={pill(cuisine === name)}>
                    <span>{name}</span><span style={pillCount}>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {difficulties.length > 0 && (
            <div>
              <div style={fieldLabel}>Pace</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button onClick={() => setDifficulty("all")} style={pill(difficulty === "all")}>
                  <span>Any</span>
                </button>
                {difficulties.map(([name, count]) => (
                  <button key={name} onClick={() => setDifficulty(name)} style={pill(difficulty === name)}>
                    <span>{name}</span><span style={pillCount}>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {timeCounts.length > 0 && (
            <div>
              <div style={fieldLabel}>Time on the clock</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button onClick={() => setMaxTime("any")} style={pill(maxTime === "any")}>
                  <span>Any length</span>
                </button>
                {timeCounts.map((b) => (
                  <button key={b.key} onClick={() => setMaxTime(b.key)} style={pill(maxTime === b.key)}>
                    <span>{b.label}</span><span style={pillCount}>{b.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={fieldLabel}>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={sortStyle}>
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
