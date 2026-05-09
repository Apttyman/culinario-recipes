import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/capture")({
  head: () => ({ meta: [{ title: "Capture — Culinario" }] }),
  component: Capture,
});

const VOICE_GEN_LINES: Record<string, string> = {
  nonna: "Patience. Good food takes time, even now.",
  health_inspector: "Compiling. This may take a moment.",
  tom_ford_intern: "Curating. We're going for elevated comfort tonight.",
  bike_messenger: "Cool cool cool, lemme think.",
  monk: "The recipes will arrive. Notice the breath.",
};

type Photo = { file: File; preview: string };
type Detected = {
  ingredients: Array<{
    name: string;
    category?: string;
    quantity_estimate?: string;
    confidence?: number;
    ambiguous?: boolean;
    ambiguity_question?: string | null;
  }>;
  notes?: string;
};
type Person = { id: string; name: string };

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--fg-muted)",
};
const title: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 300,
  fontStyle: "italic",
  fontSize: "clamp(40px, 6vw, 64px)",
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  margin: "16px 0 12px",
  color: "var(--fg)",
};
const subtitle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--fg-muted)",
  margin: 0,
  maxWidth: 560,
};
const hairline: React.CSSProperties = { border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" };
const ctaStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.2em",
  color: "var(--saffron)",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
};
const ctaDisabled: React.CSSProperties = { ...ctaStyle, color: "var(--fg-low)", cursor: "not-allowed" };
const labelMono: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--fg-muted)",
};

function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="2" y1="10" x2="10" y2="2" />
      <polyline points="4,2 10,2 10,8" />
    </svg>
  );
}

function LoadingHairline() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
      <div
        style={{
          width: 200,
          height: 1,
          background: "var(--hairline)",
          animation: "culinarioHairlinePulse 2s ease-in-out infinite",
        }}
      />
      <style>{`@keyframes culinarioHairlinePulse {0%,100%{background:var(--hairline);}50%{background:var(--saffron);}}`}</style>
    </div>
  );
}

function Capture() {
  const { session, loading, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [detected, setDetected] = useState<Detected | null>(null);
  const [clarifications, setClarifications] = useState<Record<number, { choice: string; custom?: string }>>({});
  const [people, setPeople] = useState<Person[]>([]);
  const [timeBudget, setTimeBudget] = useState<"quick" | "weeknight" | "project">("weeknight");
  const [cookedFor, setCookedFor] = useState<string[]>([]);
  const [justMe, setJustMe] = useState(true);
  const [modifier, setModifier] = useState("");
  const [surprise, setSurprise] = useState<number>(25);
  const [surpriseLoaded, setSurpriseLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [buckWild, setBuckWild] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
    else if (profile && !profile.onboarding_complete) navigate({ to: "/onboarding" });
  }, [session, loading, profile, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    supabase.from("people").select("id,name").eq("user_id", session.user.id).then(({ data }) => {
      setPeople(data ?? []);
    });
  }, [session]);

  useEffect(() => {
    if (!session?.user || surpriseLoaded) return;
    supabase.from("taste_portraits").select("surprise_tolerance").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => {
        if (typeof data?.surprise_tolerance === "number") setSurprise(data.surprise_tolerance);
        setSurpriseLoaded(true);
      });
  }, [session, surpriseLoaded]);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Photo[] = [];
    for (let i = 0; i < files.length && photos.length + next.length < 6; i++) {
      const f = files[i];
      if (f.size > 10 * 1024 * 1024) continue;
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setPhotos((p) => [...p, ...next]);
  };

  const removePhoto = (i: number) => {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
  };

  const uploadAndDetect = async () => {
    if (!session?.user || photos.length === 0) return;
    setBusy(true); setError(null);
    try {
      const uid = session.user.id;
      const { data: srow, error: sErr } = await supabase
        .from("fridge_sessions")
        .insert({ user_id: uid, photo_urls: [] })
        .select("id").single();
      if (sErr) throw new Error(`Capture session create failed: ${sErr.message}`);
      const sid = srow.id as string;
      setSessionId(sid);

      const paths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const f = photos[i].file;
        const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${uid}/${sid}/${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("fridge_photos").upload(path, f, {
          cacheControl: "3600", upsert: true, contentType: f.type || undefined,
        });
        if (upErr) throw upErr;
        paths.push(path);
      }
      await supabase.from("fridge_sessions").update({ photo_urls: paths }).eq("id", sid);
      setStep(2);

      const { data, error: fnErr } = await supabase.functions.invoke("detect-ingredients", {
        body: { session_id: sid },
      });
      if (fnErr) throw fnErr;
      const det = data as Detected;
      setDetected(det);
      const hasAmbig = det.ingredients?.some((i) => i.ambiguous);
      setStep(hasAmbig ? 3 : 4);
    } catch (e: any) {
      setError(e.message ?? String(e));
      setStep(1);
    } finally {
      setBusy(false);
    }
  };

  const skipPhotosBuckWild = async () => {
    if (!session?.user) return;
    setBusy(true); setError(null);
    try {
      const uid = session.user.id;
      const { data: srow, error: sErr } = await supabase
        .from("fridge_sessions")
        .insert({
          user_id: uid,
          photo_urls: [],
          detected_ingredients: { ingredients: [], buck_wild: true },
        })
        .select("id").single();
      if (sErr) throw new Error(`Capture session create failed: ${sErr.message}`);
      setSessionId(srow.id as string);
      setDetected({ ingredients: [] });
      setBuckWild(true);
      setStep(4);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const submitClarifications = async () => {
    if (!sessionId || !detected) return;
    const clarified = {
      ...detected,
      ingredients: detected.ingredients
        .map((ing, idx) => {
          if (!ing.ambiguous) return ing;
          const c = clarifications[idx];
          if (!c || c.choice === "skip") return null;
          if (c.choice === "custom" && c.custom) return { ...ing, name: c.custom, ambiguous: false };
          if (c.choice === "alt" && (ing as any).alternatives?.[0]) return { ...ing, name: (ing as any).alternatives[0], ambiguous: false };
          return { ...ing, ambiguous: false };
        })
        .filter(Boolean),
    };
    await supabase.from("fridge_sessions").update({ clarified_ingredients: clarified }).eq("id", sessionId);
    setStep(4);
  };

  const [results, setResults] = useState<any[] | null>(null);
  useEffect(() => {
    if (step !== 6 || !sessionId) return;
    supabase.from("recipes").select("*").eq("session_id", sessionId).order("position", { ascending: true })
      .then(({ data }) => setResults(data ?? []));
  }, [step, sessionId]);

  // After generate-recipes we want step 6 inline (override navigate above)
  const generateInline = async () => {
    if (!sessionId) return;
    setBusy(true); setError(null);
    try {
      await supabase.from("fridge_sessions").update({
        time_budget: timeBudget,
        cooked_for: justMe ? null : cookedFor,
        modifier: modifier.trim() || null,
        surprise_for_session: surprise,
      }).eq("id", sessionId);
      if (session?.user) {
        await supabase.from("taste_portraits").update({ surprise_tolerance: surprise }).eq("user_id", session.user.id);
      }
      setStep(5);
      const { error: fnErr } = await supabase.functions.invoke("generate-recipes", {
        body: { session_id: sessionId },
      });
      if (fnErr) throw fnErr;
      setStep(6);
    } catch (e: any) {
      setError(e.message ?? String(e));
      setStep(4);
    } finally {
      setBusy(false);
    }
  };

  const ambigList = detected?.ingredients
    .map((ing, idx) => ({ ing, idx }))
    .filter((x) => x.ing.ambiguous) ?? [];
  const allAnswered = ambigList.every((x) => {
    const c = clarifications[x.idx];
    return !!c && (c.choice !== "custom" || !!c.custom?.trim());
  });

  const voiceSlug = profile?.kitchen_voice ?? "nonna";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader current="Today" />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 96 }}>
        {error && (
          <div style={{ marginBottom: 24, padding: 12, border: "1px solid var(--saffron-muted)", color: "var(--saffron)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            <div style={eyebrow}>№ 003.1 — Capture</div>
            <h1 style={title}>Photograph your fridge.</h1>
            <p style={subtitle}>One photo or many — fridge, pantry, counter, whatever's in play. The more we see, the better the recipes.</p>
            <hr style={hairline} />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              style={{
                height: 240, borderBottom: "1px solid var(--hairline)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 12, cursor: "pointer",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--fg-muted)" }} aria-hidden>
                <rect x="3" y="8" width="26" height="18" rx="1" />
                <circle cx="16" cy="17" r="5" />
                <path d="M11 8 L13 5 L19 5 L21 8" />
              </svg>
              <div style={{ ...labelMono, color: "var(--fg)" }}>Drop photos or click to upload</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--fg-low)" }}>JPG, PNG, HEIC up to 10MB each</div>
              <input
                ref={fileRef} type="file" accept="image/*" multiple
                style={{ display: "none" }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "16px 0" }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: "relative", flex: "0 0 auto" }}>
                    <img src={p.preview} alt="" style={{ width: 120, height: 120, objectFit: "cover", border: "1px solid var(--hairline)" }} />
                    <button onClick={() => removePhoto(i)} aria-label="remove" style={{
                      position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 0,
                      background: "var(--bg)", color: "var(--fg)", border: "1px solid var(--hairline)",
                      cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0,
                    }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 32 }}>
              <button
                onClick={uploadAndDetect}
                disabled={photos.length === 0 || busy}
                style={photos.length === 0 || busy ? ctaDisabled : ctaStyle}
              >
                {busy ? "Uploading…" : "Continue"} <Arrow />
              </button>
            </div>
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--hairline)" }}>
              <div style={{ ...labelMono, marginBottom: 12 }}>Or — no photos tonight</div>
              <button
                onClick={skipPhotosBuckWild}
                disabled={busy}
                style={busy ? ctaDisabled : ctaStyle}
              >
                Cook without the fridge <Arrow />
              </button>
              <p style={{ marginTop: 8, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--fg-low)", maxWidth: 480 }}>
                Skip the photos — we'll compose three recipes from your taste portrait alone. On the next step you can let us surprise you, or tell us exactly what you're in the mood for: a cuisine, an ingredient to use up, a craving, a constraint.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={eyebrow}>№ 003.2 — Detection</div>
            <h1 style={title}>Looking at the fridge.</h1>
            <p style={subtitle}>This takes a few seconds. Sometimes longer if there's a lot.</p>
            <LoadingHairline />
          </>
        )}

        {step === 3 && detected && (
          <>
            <div style={eyebrow}>№ 003.3 — Clarify</div>
            <h1 style={title}>A few questions.</h1>
            <p style={subtitle}>Just to make sure the recipes work.</p>
            <hr style={hairline} />
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {ambigList.map(({ ing, idx }) => {
                const c = clarifications[idx];
                return (
                  <div key={idx} style={{ padding: "16px 0", borderBottom: "1px solid var(--hairline)" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontStyle: "italic", fontSize: 24, color: "var(--fg)" }}>
                      {ing.name}
                    </div>
                    <div style={{ marginTop: 6, fontFamily: "var(--font-body)", fontSize: 16, color: "var(--fg-muted)" }}>
                      {ing.ambiguity_question || "Confirm this ingredient?"}
                    </div>
                    <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        { key: "confirm", label: "Confirm" },
                        { key: "custom", label: "Different ingredient (type)" },
                        { key: "skip", label: "Skip — don't use it" },
                      ].map((opt) => {
                        const sel = c?.choice === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => setClarifications((m) => ({ ...m, [idx]: { choice: opt.key, custom: m[idx]?.custom } }))}
                            style={{
                              fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                              padding: "8px 0", background: "transparent", color: sel ? "var(--fg)" : "var(--fg-muted)",
                              border: 0, borderBottom: `1px solid ${sel ? "var(--saffron)" : "var(--hairline)"}`,
                              cursor: "pointer",
                            }}
                          >{opt.label}</button>
                        );
                      })}
                    </div>
                    {c?.choice === "custom" && (
                      <input
                        value={c.custom ?? ""}
                        onChange={(e) => setClarifications((m) => ({ ...m, [idx]: { choice: "custom", custom: e.target.value } }))}
                        placeholder="type the actual ingredient"
                        style={{
                          marginTop: 12, width: "100%", background: "transparent",
                          border: 0, borderBottom: "1px solid var(--hairline)",
                          padding: "8px 0", color: "var(--fg)", fontFamily: "var(--font-display)",
                          fontStyle: "italic", fontSize: 18, outline: "none",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 32 }}>
              <button onClick={submitClarifications} disabled={!allAnswered} style={allAnswered ? ctaStyle : ctaDisabled}>
                Continue <Arrow />
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div style={eyebrow}>№ 003.4 — Tonight's brief</div>
            <h1 style={title}>{buckWild ? "Tell me what you want." : "What kind of cooking tonight."}</h1>
            <p style={subtitle}>
              {buckWild
                ? "No fridge tonight — describe what you're in the mood for, and we'll compose three recipes from scratch. Be as specific or as loose as you like."
                : "Set the scene. We'll pick three recipes that fit."}
            </p>
            <hr style={hairline} />

            {buckWild && (
              <>
                <div style={{ ...labelMono, marginBottom: 8 }}>What sounds good?</div>
                <div style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 13, color: "var(--fg-low)", marginBottom: 16 }}>
                  A cuisine, a chef, an ingredient, a mood, a constraint — anything. Examples: "weeknight Thai with tofu", "use up a can of chickpeas", "something Ottolenghi-ish", "comfort food, rainy night", "low-carb, high-protein, under 40 min".
                </div>
                <textarea
                  value={modifier}
                  onChange={(e) => setModifier(e.target.value)}
                  rows={4}
                  placeholder="describe tonight in your own words…"
                  style={{
                    width: "100%", background: "transparent",
                    border: 0, borderBottom: "1px solid var(--hairline)",
                    padding: "10px 0", color: "var(--fg)",
                    fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22, outline: "none",
                    resize: "vertical",
                  }}
                />
                <div style={{ width: 64, height: 1, background: "var(--hairline)", margin: "48px auto" }} />
              </>
            )}

            <div style={{ ...labelMono, marginBottom: 16 }}>Time</div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { k: "quick", label: "Quick · Under 30 min" },
                { k: "weeknight", label: "Weeknight · 30-60 min" },
                { k: "project", label: "Project · Over an hour" },
              ].map((p) => {
                const sel = timeBudget === p.k;
                return (
                  <button
                    key={p.k}
                    onClick={() => setTimeBudget(p.k as any)}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                      padding: "8px 0", background: "transparent", color: sel ? "var(--fg)" : "var(--fg-muted)",
                      border: 0, borderBottom: `1px solid ${sel ? "var(--saffron)" : "var(--hairline)"}`, cursor: "pointer",
                    }}
                  >{p.label}</button>
                );
              })}
            </div>

            <div style={{ width: 64, height: 1, background: "var(--hairline)", margin: "48px auto" }} />

            <div style={{ ...labelMono, marginBottom: 16 }}>Cooking for</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => { setJustMe(true); setCookedFor([]); }}
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                  padding: "8px 0", background: "transparent", color: justMe ? "var(--fg)" : "var(--fg-muted)",
                  border: 0, borderBottom: `1px solid ${justMe ? "var(--saffron)" : "var(--hairline)"}`, cursor: "pointer",
                }}
              >Just me</button>
              {people.map((p) => {
                const sel = !justMe && cookedFor.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setJustMe(false);
                      setCookedFor((cur) => cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]);
                    }}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                      padding: "8px 0", background: "transparent", color: sel ? "var(--fg)" : "var(--fg-muted)",
                      border: 0, borderBottom: `1px solid ${sel ? "var(--saffron)" : "var(--hairline)"}`, cursor: "pointer",
                    }}
                  >{p.name}</button>
                );
              })}
            </div>

            <div style={{ width: 64, height: 1, background: "var(--hairline)", margin: "48px auto" }} />

            <div style={{ ...labelMono, marginBottom: 8 }}>Surprise tonight</div>
            <div style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 13, color: "var(--fg-low)", marginBottom: 16 }}>
              How willing are you to be surprised tonight? At low values, all three recipes match what you usually love. Higher values increase the chance one of three departs from your preferences.
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={surprise}
              onChange={(e) => setSurprise(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--saffron)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", color: "var(--fg-low)" }}>
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", color: "var(--saffron)" }}>
              {surprise} / 100
            </div>

            <div style={{ width: 64, height: 1, background: "var(--hairline)", margin: "48px auto" }} />

            {!buckWild && (<>
            <div style={{ ...labelMono, color: "var(--fg-low)", marginBottom: 8 }}>Modifier (optional)</div>
            <div style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: 13, color: "var(--fg-low)", marginBottom: 16 }}>
              If there's something specific you want tonight — a cuisine, a chef's style, a constraint like low-carb — say it here. This takes precedence over your default preferences for this session only.
            </div>
            <input
              value={modifier}
              onChange={(e) => setModifier(e.target.value)}
              placeholder="in the style of Ottolenghi, healthy, low-carb, soup weather…"
              style={{
                width: "100%", background: "transparent",
                border: 0, borderBottom: "1px solid var(--hairline)",
                padding: "10px 0", color: "var(--fg)",
                fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 20, outline: "none",
              }}
            />
            </>)}

            <div style={{ marginTop: 48 }}>
              <button onClick={generateInline} disabled={busy} style={busy ? ctaDisabled : ctaStyle}>
                Generate <Arrow />
              </button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <div style={eyebrow}>№ 003.5 — Composing</div>
            <h1 style={title}>Three recipes coming.</h1>
            <p style={subtitle}>{VOICE_GEN_LINES[voiceSlug] ?? VOICE_GEN_LINES.nonna}</p>
            <LoadingHairline />
          </>
        )}

        {step === 6 && (
          <>
            <div style={eyebrow}>№ 003.6 — Tonight's options</div>
            <h1 style={title}>
              {results?.[0] && (results[0] as any).body?.rationale
                ? "Three options. Pick one."
                : "Three options."}
            </h1>
            <hr style={hairline} />
            {!results && <LoadingHairline />}
            {results && results.length === 0 && (
              <p style={subtitle}>No recipes were saved. Try again.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {results?.map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => navigate({ to: "/recipes/$id", params: { id: r.id } })}
                  style={{
                    textAlign: "left", background: "transparent", color: "var(--fg)",
                    borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)",
                    borderLeft: 0, borderRight: 0,
                    padding: 32, marginTop: -1, cursor: "pointer",
                    display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    {r.is_wildcard && (
                      <div style={{ ...labelMono, color: "var(--saffron)", marginBottom: 8 }}>A surprise</div>
                    )}
                    <div style={{ ...labelMono, color: "var(--fg-low)" }}>
                      {(r.difficulty ?? "weeknight").toUpperCase()} · {r.time_estimate_minutes ?? "—"} MIN
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, fontSize: 32, marginTop: 8, color: "var(--fg)" }}>
                      {r.title}
                    </div>
                    <div style={{ ...labelMono, marginTop: 4 }}>{r.cuisine ?? ""}</div>
                    {r.chef_inspiration && (
                      <div style={{ marginTop: 8, fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14, color: "var(--saffron-muted)" }}>
                        in the spirit of {r.chef_inspiration}
                      </div>
                    )}
                    <div style={{ marginTop: 12, fontFamily: "var(--font-body)", fontSize: 16, color: "var(--fg-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {r.body?.rationale ?? ""}
                    </div>
                  </div>
                  <span style={{ ...ctaStyle, fontSize: 11 }}>Open <Arrow /></span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}