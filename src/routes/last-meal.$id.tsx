import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";
import { ShareButton } from "@/components/share/ShareButton";
import { ServingsStepper } from "@/components/ServingsStepper";
import { scaleAmount } from "@/lib/scale-amount";
import { getFaceCropStyle, parseFaceBox, type FaceBox } from "@/lib/face-crop";

export const Route = createFileRoute("/last-meal/$id")({
  head: ({ params }) => {
    const ogImage = `https://upofudganvjbdhxxpfti.supabase.co/functions/v1/last-meal-og?id=${params.id}`;
    const pageUrl = `https://culinario-recipes.lovable.app/last-meal/${params.id}`;
    return {
      meta: [
        { title: "A Last Meal — Culinario" },
        { name: "description", content: "Every last supper deserves a recipe. Conjure your own at Culinario." },
        { property: "og:title", content: "A Last Meal — Culinario" },
        { property: "og:description", content: "Every last supper deserves a recipe. Conjure your own at Culinario." },
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: pageUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "A Last Meal — Culinario" },
        { name: "twitter:description", content: "Every last supper deserves a recipe. Conjure your own at Culinario." },
        { name: "twitter:image", content: ogImage },
      ],
    };
  },
  component: LastMealDetailPage,
});

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};
const hairline: React.CSSProperties = { border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" };

type Ingredient = { item: string; amount: string; unit?: string | null };
type LastMealRecipe = {
  title: string;
  blurb: string;
  cuisine: string;
  time_estimate_minutes: number | null;
  difficulty: string;
  servings?: number | null;
  ingredients: Ingredient[];
  steps: string[];
  voice_intro: string;
  voice_outro: string;
};
type PanelMemos = {
  biographer?: string;
  food_writer?: string;
  mythographer?: string;
};
type LastMeal = {
  id: string;
  user_id: string;
  figure_name: string;
  figure_key: string;
  is_documented: boolean | null;
  historical_note: string | null;
  meal_description: string | null;
  editorial_note: string | null;
  recipe: LastMealRecipe | null;
  epitaph: string | null;
  portrait_url: string | null;
  portrait_face_box: any;
  panel_memos: PanelMemos | null;
  created_at: string;
};

function LastMealDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  // Anonymous viewers can still read the meal via public-by-uuid RLS.
  const isAnonymous = !authLoading && !session;

  const [meal, setMeal] = useState<LastMeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  // Servings stepper state MUST live up here with the other hooks (above any
  // early returns) — React's Rules of Hooks require stable render order.
  const [currentServings, setCurrentServings] = useState<number | null>(null);
  useEffect(() => {
    const r = meal?.recipe;
    const s = Number(r?.servings) > 0 ? Number(r!.servings) : 4;
    setCurrentServings(s);
  }, [meal?.id, meal?.recipe?.servings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("last_meals" as any)
        .select("id, user_id, figure_name, figure_key, is_documented, historical_note, meal_description, editorial_note, recipe, epitaph, portrait_url, portrait_face_box, panel_memos, created_at")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setErr(`${error.code ?? "?"}: ${error.message}`); setLoading(false); return; }
      if (!data) { setErr("This last meal could not be found."); setLoading(false); return; }
      setMeal(data as unknown as LastMeal);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
        <AppHeader />
        <main className="culinario-page" style={{ paddingTop: 96 }}>
          <div style={eyebrow}>Setting the table…</div>
        </main>
      </div>
    );
  }
  if (err || !meal) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
        <AppHeader />
        <main className="culinario-page" style={{ paddingTop: 96 }}>
          <div style={{ ...eyebrow, color: "var(--saffron)" }}>{err ?? "Not found."}</div>
          <div style={{ marginTop: 20 }}>
            <Link to="/last-meal" style={{ ...eyebrow, textDecoration: "none", color: "var(--saffron)" }}>
              ← Back to Last Meal Mode
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const initial = (meal.figure_name?.[0] ?? "?").toUpperCase();
  const faceBox = parseFaceBox(meal.portrait_face_box);
  const r = meal.recipe;
  const isOwner = !!session?.user && session.user.id === meal.user_id;
  const hasPanel = !!(meal.panel_memos && (meal.panel_memos.biographer || meal.panel_memos.food_writer || meal.panel_memos.mythographer));

  // Last meals predating the servings rollout default to 4. The
  // useState/useEffect for currentServings lives at the top of the
  // component above the early returns.
  const baseServings = Number(r?.servings) > 0 ? Number(r!.servings) : 4;
  const displayServings = currentServings ?? baseServings;
  const scaleRatio = baseServings > 0 ? displayServings / baseServings : 1;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 240 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Link
            to="/last-meal"
            style={{
              background: "transparent", border: 0, padding: 0, textDecoration: "none",
              ...eyebrow,
            }}
          >
            ← All last meals
          </Link>
          {isOwner && (
            <ShareButton
              kind="last_meal"
              targetId={meal.id}
              targetLabel={`${meal.figure_name}'s last meal`}
              label="Share"
              variant="pill"
            />
          )}
          {isAnonymous && (
            <button
              type="button"
              onClick={() => navigate({ to: "/sign-up" })}
              style={{
                fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                textTransform: "uppercase", letterSpacing: "0.2em",
                color: "var(--saffron)", background: "transparent",
                border: "1px solid var(--saffron)",
                padding: "10px 18px", borderRadius: 9999, cursor: "pointer",
              }}
            >
              Set your own table
            </button>
          )}
        </div>

        {/* Identity + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", marginTop: 32 }}>
          <div
            aria-hidden="true"
            className="lm-portrait"
            style={{
              width: 132, height: 132,
              ...(meal.portrait_url ? { backgroundImage: `url(${meal.portrait_url})`, ...getFaceCropStyle(faceBox, 132) } : {}),
            }}
          >
            {!meal.portrait_url && <span className="lm-portrait-initial">{initial}</span>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={eyebrow}>№ 009 — Last Meal Mode</div>
            <h1 style={{
              fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
              fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.05,
              letterSpacing: "-0.02em", margin: "10px 0 12px",
            }}>
              {meal.figure_name}
            </h1>
            <span style={{
              display: "inline-block",
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "var(--fg-muted)",
              border: "1px solid var(--hairline)", padding: "5px 12px", borderRadius: 9999,
            }}>
              {meal.is_documented ? "Historically documented" : "Lovingly inferred"}
            </span>
          </div>
        </div>

        {/* Scene-setting */}
        {meal.historical_note && (
          <p style={{
            marginTop: 28,
            fontFamily: "var(--font-body)", fontStyle: "italic",
            fontSize: 20, lineHeight: 1.55, color: "var(--fg)",
            maxWidth: 720, whiteSpace: "pre-wrap",
          }}>
            {meal.historical_note}
          </p>
        )}

        {/* Meal description */}
        {meal.meal_description && (
          <p style={{
            marginTop: 18,
            fontFamily: "var(--font-body)",
            fontSize: 17, lineHeight: 1.6, color: "var(--fg)",
            maxWidth: 720, whiteSpace: "pre-wrap",
          }}>
            {meal.meal_description}
          </p>
        )}

        {/* Editorial aside */}
        {meal.editorial_note && (
          <div style={{
            marginTop: 22, paddingLeft: 18,
            borderLeft: "2px solid color-mix(in oklab, var(--saffron) 65%, transparent)",
            fontFamily: "var(--font-body)", fontStyle: "italic",
            fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)",
            maxWidth: 600,
          }}>
            {meal.editorial_note}
          </div>
        )}

        {/* Recipe */}
        {r && (
          <>
            <hr style={hairline} />
            <div style={eyebrow}>The recipe</div>
            <h2 style={{
              fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
              fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.1,
              margin: "14px 0 8px", color: "var(--fg)",
            }}>
              {r.title}
            </h2>
            <div style={{ ...eyebrow, marginBottom: 16 }}>
              {(r.cuisine ?? "").toUpperCase()} · {r.time_estimate_minutes ?? "—"} MIN · {(r.difficulty ?? "").toString().toUpperCase()}
            </div>
            {r.blurb && (
              <p style={{
                fontFamily: "var(--font-body)", fontStyle: "italic",
                fontSize: 17, lineHeight: 1.6, color: "var(--fg-muted)",
                margin: "0 0 28px", maxWidth: 640,
              }}>
                "{r.blurb}"
              </p>
            )}

            {r.voice_intro && (
              <blockquote style={{
                margin: "0 0 24px",
                padding: "16px 20px",
                borderLeft: "3px solid var(--saffron)",
                background: "color-mix(in oklab, var(--saffron) 6%, transparent)",
                fontFamily: "var(--font-body)", fontStyle: "italic",
                fontSize: 17, lineHeight: 1.6, color: "var(--fg)",
                maxWidth: 640,
              }}>
                {r.voice_intro}
                <div style={{ ...eyebrow, marginTop: 8, color: "var(--saffron)" }}>
                  — {meal.figure_name}
                </div>
              </blockquote>
            )}

            <div style={{ marginTop: 28 }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 20, flexWrap: "wrap",
                marginBottom: 16,
              }}>
                <div style={eyebrow}>Ingredients</div>
                <ServingsStepper
                  value={displayServings}
                  baseServings={baseServings}
                  onChange={setCurrentServings}
                />
              </div>
              <ul style={{
                listStyle: "none", padding: 0, margin: 0,
                display: "flex", flexDirection: "column", gap: 8,
                maxWidth: 560,
              }}>
                {r.ingredients?.map((ing, i) => (
                  <li key={i} style={{
                    display: "flex", justifyContent: "space-between", gap: 16,
                    paddingBottom: 8, borderBottom: "1px solid var(--hairline)",
                    fontFamily: "var(--font-body)", fontSize: 16, lineHeight: 1.5, color: "var(--fg)",
                  }}>
                    <span style={{ fontStyle: "italic" }}>{ing.item}</span>
                    <span style={{ color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                      {scaleAmount(ing.amount, scaleRatio)}{ing.unit ? ` ${ing.unit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: 36 }}>
              <div style={eyebrow}>Method</div>
              <ol style={{
                listStyle: "none", padding: 0, margin: "16px 0 0",
                counterReset: "step", display: "flex", flexDirection: "column", gap: 18,
                maxWidth: 700,
              }}>
                {r.steps?.map((step, i) => (
                  <li key={i} style={{
                    position: "relative", paddingLeft: 44,
                    fontFamily: "var(--font-body)", fontSize: 16, lineHeight: 1.65, color: "var(--fg)",
                  }}>
                    <span style={{
                      position: "absolute", left: 0, top: 0,
                      fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500,
                      fontSize: 22, color: "var(--saffron)",
                      width: 32, textAlign: "right",
                    }}>{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {r.voice_outro && (
              <blockquote style={{
                margin: "36px 0 0",
                padding: "16px 20px",
                borderLeft: "3px solid var(--saffron)",
                background: "color-mix(in oklab, var(--saffron) 6%, transparent)",
                fontFamily: "var(--font-body)", fontStyle: "italic",
                fontSize: 17, lineHeight: 1.6, color: "var(--fg)",
                maxWidth: 640,
              }}>
                {r.voice_outro}
                <div style={{ ...eyebrow, marginTop: 8, color: "var(--saffron)" }}>
                  — {meal.figure_name}
                </div>
              </blockquote>
            )}
          </>
        )}

        {/* THE EPITAPH — the screenshot moment */}
        {meal.epitaph && (
          <div style={{
            marginTop: 80, marginBottom: 32,
            padding: "56px 24px",
            textAlign: "center",
            borderTop: "1px solid var(--hairline)",
            borderBottom: "1px solid var(--hairline)",
          }}>
            <div style={{ ...eyebrow, marginBottom: 28 }}>An epitaph</div>
            <p style={{
              fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
              fontSize: "clamp(28px, 4.5vw, 48px)", lineHeight: 1.25,
              letterSpacing: "-0.01em",
              color: "var(--fg)", margin: "0 auto", maxWidth: 820,
            }}>
              "{meal.epitaph}"
            </p>
            <div style={{
              marginTop: 32,
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.3em",
              textTransform: "uppercase", color: "var(--fg-muted)",
            }}>
              For {meal.figure_name}
            </div>
          </div>
        )}

        {/* Three voices conferred — disclosure */}
        {hasPanel && (
          <div style={{ marginTop: 48 }}>
            <button
              type="button"
              onClick={() => setShowPanel((v) => !v)}
              style={{
                background: "transparent", border: 0, padding: 0, cursor: "pointer",
                ...eyebrow, display: "inline-flex", alignItems: "center", gap: 10,
                color: showPanel ? "var(--saffron)" : "var(--fg-muted)",
              }}
            >
              {showPanel ? "Hide the panel ↑" : "Three voices conferred ↓"}
            </button>
            {showPanel && (
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 28 }}>
                {meal.panel_memos?.biographer && <PanelMemo role="The biographer" body={meal.panel_memos.biographer} />}
                {meal.panel_memos?.food_writer && <PanelMemo role="The food writer" body={meal.panel_memos.food_writer} />}
                {meal.panel_memos?.mythographer && <PanelMemo role="The mythographer" body={meal.panel_memos.mythographer} />}
              </div>
            )}
          </div>
        )}

        {/* Action row */}
        <div style={{ marginTop: 48, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
          <Link
            to="/last-meal"
            style={{
              fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
              textTransform: "uppercase", letterSpacing: "0.2em",
              color: "var(--saffron)", background: "transparent",
              border: "1px solid var(--saffron)",
              padding: "14px 24px", borderRadius: 9999, textDecoration: "none",
            }}
          >
            Set another table ↗
          </Link>
        </div>

        <style>{`
          .lm-portrait {
            border-radius: 50%; flex-shrink: 0;
            background-color: color-mix(in oklab, var(--saffron) 18%, var(--surface-elev));
            background-position: center 22%; background-size: cover; background-repeat: no-repeat;
            border: 2px solid color-mix(in oklab, var(--saffron) 65%, transparent);
            box-shadow:
              0 0 0 4px color-mix(in oklab, var(--saffron) 14%, transparent),
              0 8px 24px -8px color-mix(in oklab, var(--saffron) 55%, transparent);
            display: flex; align-items: center; justify-content: center;
          }
          .lm-portrait-initial {
            font-family: var(--font-display); font-style: italic; font-weight: 600;
            font-size: 54px; color: var(--saffron);
          }
        `}</style>
      </main>
    </div>
  );
}

function PanelMemo({ role, body }: { role: string; body: string }) {
  return (
    <div style={{
      padding: "20px 22px",
      borderLeft: "2px solid color-mix(in oklab, var(--saffron) 65%, transparent)",
      maxWidth: 720,
    }}>
      <div style={{ ...eyebrow, marginBottom: 12, color: "var(--saffron)" }}>{role}</div>
      <div style={{
        fontFamily: "var(--font-body)",
        fontSize: 15, lineHeight: 1.65, color: "var(--fg)",
        whiteSpace: "pre-wrap",
      }}>
        {body}
      </div>
    </div>
  );
}
