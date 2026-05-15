import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { insertSignal, ratingWeight } from "@/lib/preference-signals";
import { AppHeader } from "@/components/AppHeader";
import { triggerPortraitSynthesis } from "@/lib/portrait";
import { ShareButton } from "@/components/share/ShareButton";

export const Route = createFileRoute("/recipes/$id")({
  head: () => ({ meta: [{ title: "Recipe — Culinario" }] }),
  validateSearch: (search: Record<string, unknown>) => {
    const rawAct = Number(search.act);
    return {
      from: typeof search.from === "string" ? search.from : undefined,
      act: Number.isFinite(rawAct) && rawAct >= 0 && rawAct <= 8 ? Math.floor(rawAct) : undefined,
    };
  },
  component: RecipePage,
});

const VOICE_NAMES: Record<string, string> = {
  nonna: "Nonna",
  health_inspector: "The Health Inspector",
  tom_ford_intern: "The Tom Ford Intern",
  bike_messenger: "The Bike Messenger",
  monk: "The Monk",
};

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};
const labelMono: React.CSSProperties = { ...eyebrow };
const hairline: React.CSSProperties = { border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" };
const ctaStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
  textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--saffron)",
  background: "transparent", border: 0, cursor: "pointer", padding: "12px 0",
  display: "inline-flex", alignItems: "center", gap: 10,
};
const sectionHeader: React.CSSProperties = {
  fontFamily: "var(--font-display)", fontWeight: 500,
  fontVariantCaps: "small-caps", textTransform: "uppercase",
  letterSpacing: "0.15em", fontSize: 16, color: "var(--fg)",
  margin: "0 0 24px",
};

function RecipePage() {
  const { session } = useAuth();
  const { id } = Route.useParams();
  const { from: fromDuel, act: duelAct } = Route.useSearch();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<any>(null);
  const [voice, setVoice] = useState<any>(null);
  const [showRate, setShowRate] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgHover, setImgHover] = useState(false);
  

  const load = async () => {
    const { data: r } = await supabase.from("recipes").select("*").eq("id", id).single();
    setRecipe(r);
    const { data: v } = await supabase.from("recipe_voice_lines").select("*").eq("recipe_id", id).maybeSingle();
    setVoice(v);
  };

  useEffect(() => { if (session) load(); }, [session, id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Prefer the inverse-mode image_url if present (set by edge function).
      if (recipe?.inverse_image_url) {
        if (!cancelled) setImageUrl(recipe.inverse_image_url);
        return;
      }
      if (!recipe?.image_path) { setImageUrl(null); return; }
      const { data, error } = await supabase.storage
        .from("recipe-images")
        .createSignedUrl(recipe.image_path, 3600);
      if (!cancelled && !error && data) setImageUrl(data.signedUrl);
    })();
    return () => { cancelled = true; };
  }, [recipe?.image_path, recipe?.inverse_image_url]);

  const generateImage = async () => {
    const recipeId = recipe?.id ?? id;
    if (!recipeId) {
      setImgError("Recipe not loaded yet");
      return;
    }
    setImgLoading(true);
    setImgError(null);
    try {
      const body = recipe?.body ?? {};
      const isInverse = Boolean(recipe?.is_inverse ?? body.inverse_celebrity);
      const fnName = isInverse ? "generate-inverse-image" : "generate-recipe-image";
      
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { recipe_id: recipeId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      // Edge function already persisted to DB. Mirror returned image_url in local state
      // so the image renders immediately without a re-fetch round-trip.
      const returnedUrl = (data as any)?.image_url ?? null;
      if (isInverse && returnedUrl) {
        setRecipe((r: any) => r ? { ...r, inverse_image_url: returnedUrl } : r);
      }
      await load();
    } catch (e: any) {
      setImgError(e?.message ?? "Generation failed");
    } finally {
      setImgLoading(false);
    }
  };

  // Auto-generate image for inverse recipes that don't yet have one.
  useEffect(() => {
    if (!recipe) return;
    if (recipe.image_path || recipe.inverse_image_url) return;
    if (imgLoading) return;
    const body = recipe.body ?? {};
    const isInverse = Boolean(recipe.is_inverse ?? body.inverse_celebrity);
    if (!isInverse) return;
    generateImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id, recipe?.image_path, recipe?.inverse_image_url]);

  const regenerateImage = async () => {
    await supabase.from("recipes").update({ image_path: null }).eq("id", id);
    setRecipe((r: any) => r ? { ...r, image_path: null, inverse_image_url: null } : r);
    setImageUrl(null);
    await generateImage();
  };

  if (!recipe) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
        <AppHeader current="Cookbook" />
        <main className="culinario-page" style={{ paddingTop: 96 }}>
          <div style={eyebrow}>Loading…</div>
        </main>
      </div>
    );
  }

  const body = recipe.body ?? {};
  const ingredients: any[] = body.ingredients ?? [];
  const steps: string[] = body.steps ?? [];
  const isInverse = Boolean(recipe.is_inverse ?? body.inverse_celebrity);
  const inverseCelebrity = recipe.inverse_celebrity ?? body.inverse_celebrity;
  const inverseBlurb = recipe.inverse_blurb ?? body.inverse_blurb ?? body.rationale;
  const fridgeCount = ingredients.filter((i) => i.from === "fridge").length;
  const hasFromMeta = ingredients.some((i) => typeof i?.from === "string" && i.from.length > 0);
  const metaLabel = hasFromMeta ? "From your fridge" : "Ingredients";
  const metaValue = hasFromMeta
    ? `${fridgeCount} ingredients`
    : `${ingredients.length} ingredients`;
  const formatAmount = (ing: any) => {
    const amt = (ing?.amount ?? "").toString().trim();
    const unit = (ing?.unit ?? "").toString().trim();
    if (amt && unit) return `${amt} ${unit}`;
    return amt || unit;
  };
  const voiceSlug = voice?.voice_character;

  const markCooked = async () => {
    await supabase.from("recipes").update({ cooked_at: new Date().toISOString() }).eq("id", id);
    if (session?.user) {
      const voiceLabel = VOICE_NAMES[voiceSlug ?? ""] ?? voiceSlug ?? "kitchen voice";
      insertSignal({
        user_id: session.user.id,
        source: "recipe_cook",
        axis: null,
        signal_text: `cooked a recipe titled '${recipe.title ?? "untitled"}' in voice ${voiceLabel}`,
        signal_weight: 0.5,
        metadata: { recipe_id: id },
      });
    }
    triggerPortraitSynthesis();
    load();
  };
  const setRating = async (n: number) => {
    console.log("[recipe] setRating", n, "recipe", id, "user", session?.user?.id);
    const { error: rErr } = await supabase.from("recipes").update({ rating: n }).eq("id", id);
    if (rErr) console.warn("[recipe] rating update error", rErr);
    if (session?.user) {
      const cuisine = recipe.cuisine ? ` (${recipe.cuisine})` : "";
      insertSignal({
        user_id: session.user.id,
        source: "recipe_rating",
        axis: "rating",
        signal_text: `rated ${n}/5 a recipe titled '${recipe.title ?? "untitled"}'${cuisine}`,
        signal_weight: ratingWeight(n),
        metadata: { recipe_id: id, rating: n },
      });
    } else {
      console.warn("[recipe] no session.user when rating — signal NOT inserted");
    }
    triggerPortraitSynthesis();
    load();
  };
  const saveNote = async () => {
    const merged = recipe.notes ? `${recipe.notes}\n\n${noteDraft.trim()}` : noteDraft.trim();
    await supabase.from("recipes").update({ notes: merged }).eq("id", id);
    triggerPortraitSynthesis();
    setNoteDraft(""); setShowNote(false); load();
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader current="Cookbook" />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 240 }}>
        <div style={eyebrow}>№ 004 — Recipe</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
          fontSize: "clamp(48px, 7vw, 80px)", lineHeight: 1.05,
          letterSpacing: "-0.02em", margin: "16px 0 12px", color: "var(--fg)",
        }}>{recipe.title}</h1>
        <div style={labelMono}>
          {(recipe.cuisine ?? "").toUpperCase()} · {recipe.time_estimate_minutes ?? "—"} MIN · {(recipe.difficulty ?? "").toUpperCase()}
        </div>
        {recipe.chef_inspiration && (
          <div style={{ marginTop: 12, fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color: "var(--fg-muted)" }}>
            {isInverse && inverseCelebrity ? `as ${inverseCelebrity} would cook it` : `in the spirit of ${recipe.chef_inspiration}`}
          </div>
        )}
        {isInverse && inverseBlurb && (
          <blockquote style={{
            margin: "24px 0 0", padding: "0 0 0 20px",
            borderLeft: "1px solid var(--saffron)",
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 22, lineHeight: 1.45, color: "var(--fg)", maxWidth: 640,
          }}>
            "{inverseBlurb}"
            <div style={{ ...labelMono, marginTop: 12, fontStyle: "normal" }}>
              — {inverseCelebrity}
            </div>
          </blockquote>
        )}
        {recipe.is_wildcard && recipe.wildcard_rationale && (
          <div style={{ marginTop: 8, fontFamily: "var(--font-display)", fontWeight: 400, fontStyle: "italic", fontSize: 16, color: "var(--saffron)" }}>
            An attempt to surprise you well. {recipe.wildcard_rationale}
          </div>
        )}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {imageUrl && (
            <>
              <img
                src={imageUrl}
                alt={recipe.title ?? "recipe"}
                style={{ width: "100%", display: "block", border: "1px solid var(--hairline)", borderRadius: 0 }}
              />
              <button
                onClick={regenerateImage}
                disabled={imgLoading}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
                  textTransform: "uppercase", color: "var(--fg-low)",
                  background: "transparent", border: 0, padding: "4px 0", cursor: imgLoading ? "wait" : "pointer",
                }}
              >
                {imgLoading ? "Composing…" : "Regenerate ↗"}
              </button>
            </>
          )}
          {!imageUrl && imgLoading && (
            <div style={{
              fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18,
              color: "var(--fg-muted)", animation: "culinario-pulse 1.6s ease-in-out infinite",
            }}>
              Composing the photograph…
            </div>
          )}
          {!imageUrl && !imgLoading && (
            <button
              onClick={generateImage}
              onMouseEnter={() => setImgHover(true)}
              onMouseLeave={() => setImgHover(false)}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: imgHover ? "var(--saffron)" : "var(--fg-muted)",
                background: "transparent", border: 0, padding: "8px 0", cursor: "pointer",
                transition: "color 150ms ease",
              }}
            >
              Generate image ↗
            </button>
          )}
          {imgError && (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em",
              textTransform: "uppercase", color: "var(--fg-muted)",
            }}>
              {imgError}
            </div>
          )}
        </div>
        {voice?.intro_line && (
          <div style={{ marginTop: 24, paddingLeft: 24 }}>
            <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 20, color: "var(--fg-muted)" }}>
              {voice.intro_line}
            </div>
            <div style={{ ...labelMono, marginTop: 8 }}>— {VOICE_NAMES[voiceSlug] ?? voiceSlug ?? ""}</div>
          </div>
        )}
        <hr style={hairline} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            ["Time", `${recipe.time_estimate_minutes ?? "—"} minutes`],
            ["Difficulty", recipe.difficulty ?? "—"],
            [metaLabel, metaValue],
          ].map(([l, v]) => (
            <div key={l}>
              <div style={labelMono}>{l}</div>
              <div style={{ marginTop: 8, fontFamily: "var(--font-body)", fontSize: 16, color: "var(--fg)" }}>{v}</div>
            </div>
          ))}
        </div>
        <hr style={hairline} />

        {body.rationale && (
          <>
            <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 18, color: "var(--fg)", margin: 0 }}>
              {body.rationale}
            </p>
            <hr style={hairline} />
          </>
        )}

        <h2 style={sectionHeader}>Ingredients</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ingredients.map((ing, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 16, alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--fg-muted)" }}>{formatAmount(ing)}</span>
              <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color: "var(--fg)" }}>{ing.item}</span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
                color: ing.from === "fridge" ? "var(--saffron-muted)" : ing.from === "shopping" ? "var(--fg-low)" : "var(--fg-muted)",
                fontStyle: ing.from === "shopping" ? "italic" : "normal",
                textTransform: "uppercase",
              }}>{ing.from}</span>
            </div>
          ))}
        </div>
        <hr style={hairline} />

        <h2 style={sectionHeader}>Method</h2>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          {steps.map((s, i) => (
            <li key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 16 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--fg-low)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 18, lineHeight: 1.6, color: "var(--fg)" }}>{s}</span>
            </li>
          ))}
        </ol>

        {(body.notes || recipe.notes) && (
          <>
            <hr style={hairline} />
            <h2 style={sectionHeader}>Notes</h2>
            {body.notes && (
              <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 16, color: "var(--fg-muted)", margin: 0, whiteSpace: "pre-wrap" }}>
                {body.notes}
              </p>
            )}
            {recipe.notes && (
              <p style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 16, color: "var(--fg)", marginTop: 16, whiteSpace: "pre-wrap" }}>
                {recipe.notes}
              </p>
            )}
          </>
        )}

        <hr style={hairline} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          {!recipe.cooked_at && (
            <button onClick={markCooked} style={ctaStyle}>I'm cooking this ↗</button>
          )}
          {recipe.cooked_at && !showRate && recipe.rating == null && (
            <button onClick={() => setShowRate(true)} style={ctaStyle}>Rate this recipe ↗</button>
          )}
          {(showRate || recipe.rating != null) && (
            <div style={{ display: "flex", gap: 8, padding: "12px 0" }}>
              {[1,2,3,4,5].map((n) => {
                const filled = (hoverStar ?? recipe.rating ?? 0) >= n;
                return (
                  <button
                    key={n}
                    onMouseEnter={() => setHoverStar(n)}
                    onMouseLeave={() => setHoverStar(null)}
                    onClick={() => setRating(n)}
                    aria-label={`${n} star`}
                    style={{
                      width: 28, height: 28, border: "1px solid var(--hairline)",
                      background: filled ? "var(--saffron)" : "transparent",
                      cursor: "pointer", padding: 0,
                    }}
                  />
                );
              })}
            </div>
          )}
          {recipe.rating != null && voice?.success_line && (
            <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color: "var(--fg-muted)", padding: "8px 0" }}>
              {voice.success_line}
            </div>
          )}
          {!showNote && (
            <button onClick={() => setShowNote(true)} style={ctaStyle}>Add a note ↗</button>
          )}
          {showNote && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="what worked, what to change, who liked it"
                rows={3}
                style={{
                  width: "100%", background: "transparent", color: "var(--fg)",
                  border: 0, borderBottom: "1px solid var(--hairline)",
                  fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18,
                  padding: "8px 0", outline: "none", resize: "vertical",
                }}
              />
              <button onClick={saveNote} disabled={!noteDraft.trim()} style={noteDraft.trim() ? ctaStyle : { ...ctaStyle, color: "var(--fg-low)", cursor: "not-allowed" }}>
                Save note ↗
              </button>
            </div>
          )}
          <ShareButton kind="recipe" targetId={recipe.id} targetLabel={recipe.title ?? undefined} variant="ghost" />
        </div>

        <div style={{ marginTop: 48 }}>
          {fromDuel ? (
            <button onClick={() => navigate({ to: "/duel/$id", params: { id: fromDuel }, search: { act: duelAct ?? 0 } })} style={{ ...ctaStyle, color: "var(--fg-muted)" }}>
              ← Back to the duel
            </button>
          ) : (
            <button onClick={() => navigate({ to: "/cookbook" })} style={{ ...ctaStyle, color: "var(--fg-muted)" }}>
              ← Cookbook
            </button>
          )}
        </div>
      </main>
    </div>
  );
}