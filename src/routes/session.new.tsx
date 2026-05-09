import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/session/new")({
  head: () => ({ meta: [{ title: "Session — Culinario" }] }),
  component: SessionFlow,
});

const SURFACES = ["FRIDGE", "PANTRY", "COUNTER"] as const;
type Surface = (typeof SURFACES)[number];

const VOICE_LIST = [
  { slug: "nonna", name: "Nonna" },
  { slug: "health_inspector", name: "The Health Inspector" },
  { slug: "tom_ford_intern", name: "The Tom Ford Intern" },
  { slug: "bike_messenger", name: "The Bike Messenger" },
  { slug: "monk", name: "The Monk" },
];

type DetectedItem = {
  name: string;
  confidence: "high" | "low";
  alternatives?: string[];
  chosen?: string; // user's pick when low
};

type RecipeRow = {
  id: string;
  title: string | null;
  cuisine: string | null;
  time_estimate_minutes: number | null;
  difficulty: string | null;
  chef_inspiration: string | null;
  is_wildcard: boolean;
  wildcard_rationale: string | null;
  position: number | null;
  body: any;
};
type VoiceLineRow = {
  recipe_id: string;
  voice_character: string | null;
  intro_line: string | null;
  success_line: string | null;
};

const eyebrow = (text: string) => (
  <div
    style={{
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "var(--fg-muted)",
    }}
  >
    {text}
  </div>
);

const headline = (text: string) => (
  <h1
    className="culinario-display-h1"
    style={{
      fontFamily: "var(--font-display)",
      fontWeight: 300,
      fontStyle: "italic",
      fontSize: "clamp(40px, 6vw, 64px)",
      lineHeight: 1.05,
      letterSpacing: "-0.02em",
      margin: "16px 0 0",
      color: "var(--fg)",
    }}
  >
    {text}
  </h1>
);

const HR = () => (
  <hr style={{ border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" }} />
);

const ctaBtn = (active: boolean) =>
  ({
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.2em",
    color: active ? "var(--saffron)" : "var(--fg-low)",
    background: "transparent",
    border: 0,
    cursor: active ? "pointer" : "not-allowed",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  }) as const;

const Arrow = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="2" y1="10" x2="10" y2="2" />
    <polyline points="4,2 10,2 10,8" />
  </svg>
);

const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 7h3l2-2.5h8L18 7h3v12H3z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

function SessionFlow() {
  const { session, loading, profile } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [photos, setPhotos] = useState<Record<Surface, string[]>>({ FRIDGE: [], PANTRY: [], COUNTER: [] });
  const [buckWild, setBuckWild] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [showManual, setShowManual] = useState(false);

  const [voice, setVoice] = useState<string>("");
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [cookingFor, setCookingFor] = useState<string[]>([]);

  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [voiceLines, setVoiceLines] = useState<Record<string, VoiceLineRow>>({});
  const [saveSet, setSaveSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
    else if (profile && !profile.onboarding_complete) navigate({ to: "/onboarding" });
  }, [session, loading, profile, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    if (profile?.kitchen_voice && !voice) setVoice(profile.kitchen_voice);
    supabase
      .from("people")
      .select("id, name")
      .eq("user_id", session.user.id)
      .then(({ data }) => setPeople(data ?? []));
  }, [session, profile, voice]);

  if (loading || !session) return <div style={{ minHeight: "100vh", background: "var(--bg)" }} />;
  const userId = session.user.id;

  const totalPhotos = photos.FRIDGE.length + photos.PANTRY.length + photos.COUNTER.length;

  const toggleSurface = (s: Surface) =>
    setSurfaces((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const startBuckWild = async () => {
    setError(null);
    setBusy("Opening the kitchen…");
    try {
      const sid = sessionId ?? crypto.randomUUID();
      const { error: insErr } = await supabase
        .from("fridge_sessions")
        .upsert({
          id: sid,
          user_id: userId,
          photo_urls: [],
          detected_ingredients: { ingredients: [], buck_wild: true },
        }, { onConflict: "id" });
      if (insErr) throw insErr;
      setSessionId(sid);
      setStage(4);
    } catch (e: any) {
      console.error("[session] buck-wild start failed", e);
      setError(e.message ?? "couldn't start");
    } finally {
      setBusy(null);
    }
  };

  const uploadPhoto = async (surface: Surface, file: File) => {
    setError(null);
    try {
      // generate a session id once we start uploading
      let sid = sessionId;
      if (!sid) {
        sid = crypto.randomUUID();
        setSessionId(sid);
      }
      const idx = totalPhotos;
      const path = `${userId}/${sid}/${surface.toLowerCase()}-${idx}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("session-photos")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (upErr) {
        console.error("[session] upload failed", upErr);
        throw upErr;
      }
      setPhotos((prev) => ({ ...prev, [surface]: [...prev[surface], path] }));
    } catch (e: any) {
      setError(e.message ?? "upload failed");
    }
  };

  const removePhoto = async (surface: Surface, path: string) => {
    await supabase.storage.from("session-photos").remove([path]);
    setPhotos((prev) => ({ ...prev, [surface]: prev[surface].filter((p) => p !== path) }));
  };

  const runDetect = async () => {
    setError(null);
    setBusy("Reading the kitchen…");
    try {
      const allPaths = [...photos.FRIDGE, ...photos.PANTRY, ...photos.COUNTER];
      const sid = sessionId ?? crypto.randomUUID();
      // Insert/upsert the session row
      const { error: insErr } = await supabase
        .from("fridge_sessions")
        .upsert({ id: sid, user_id: userId, photo_urls: allPaths }, { onConflict: "id" });
      if (insErr) {
        console.error("[session] fridge_sessions upsert failed", insErr);
        throw insErr;
      }
      setSessionId(sid);

      const { data, error: fnErr } = await supabase.functions.invoke("detect-ingredients", {
        body: { session_id: sid },
      });
      if (fnErr) {
        console.error("[session] detect-ingredients failed", fnErr);
        throw fnErr;
      }
      const items: DetectedItem[] = (data?.ingredients ?? []).map((i: any) => ({
        name: i.name,
        confidence: i.confidence === "low" ? "low" : "high",
        alternatives: i.alternatives ?? [],
      }));
      setDetected(items);
      setStage(3);
    } catch (e: any) {
      setError(e.message ?? "detection failed");
    } finally {
      setBusy(null);
    }
  };

  const confirmIngredients = async () => {
    setError(null);
    try {
      const finalList = detected.map((d) => ({
        name: d.confidence === "low" && d.chosen ? d.chosen : d.name,
        confidence: "high" as const,
      }));
      const { error: upErr } = await supabase
        .from("fridge_sessions")
        .update({ detected_ingredients: { ingredients: finalList } })
        .eq("id", sessionId!);
      if (upErr) {
        console.error("[session] update detected failed", upErr);
        throw upErr;
      }
      setStage(4);
    } catch (e: any) {
      setError(e.message ?? "save failed");
    }
  };

  const runGenerate = async () => {
    setError(null);
    setBusy("Composing…");
    try {
      // persist voice + cooked_for on the session so the generator picks them up
      if (sessionId) {
        await supabase
          .from("fridge_sessions")
          .update({ cooked_for: cookingFor })
          .eq("id", sessionId);
      }
      if (voice) {
        await supabase.from("profiles").update({ kitchen_voice: voice }).eq("id", userId);
      }
      const { data, error: fnErr } = await supabase.functions.invoke("generate-recipes", {
        body: { session_id: sessionId },
      });
      if (fnErr) {
        console.error("[session] generate-recipes failed", fnErr);
        throw fnErr;
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const ids: string[] = (data as any)?.recipe_ids ?? [];
      if (!ids.length) throw new Error("no recipes returned");
      setBusy("Plating…");
      const { data: rows, error: rErr } = await supabase
        .from("recipes")
        .select("id,title,cuisine,time_estimate_minutes,difficulty,chef_inspiration,is_wildcard,wildcard_rationale,position,body")
        .in("id", ids)
        .order("position", { ascending: true });
      if (rErr) throw rErr;
      const { data: vls } = await supabase
        .from("recipe_voice_lines")
        .select("recipe_id,voice_character,intro_line,success_line")
        .in("recipe_id", ids);
      const vlMap: Record<string, VoiceLineRow> = {};
      (vls ?? []).forEach((v: any) => { vlMap[v.recipe_id] = v; });
      setRecipes((rows ?? []) as RecipeRow[]);
      setVoiceLines(vlMap);
      setSaveSet(new Set((rows ?? []).map((r: any) => r.id)));
      setStage(5);
    } catch (e: any) {
      setError(e.message ?? "generation failed");
    } finally {
      setBusy(null);
    }
  };

  const toggleSave = (id: string) =>
    setSaveSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const onDone = async () => {
    const toDelete = recipes.filter((r) => !saveSet.has(r.id)).map((r) => r.id);
    if (toDelete.length > 0) {
      const { error: vErr } = await supabase
        .from("recipe_voice_lines").delete().in("recipe_id", toDelete);
      if (vErr) console.error("[session] delete voice lines failed", vErr);
      const { error: dErr } = await supabase
        .from("recipes").delete().in("id", toDelete);
      if (dErr) console.error("[session] delete recipes failed", dErr);
    }
    const kept = recipes.filter((r) => saveSet.has(r.id));
    if (kept.length === 0) {
      navigate({ to: "/today" });
    } else {
      navigate({ to: "/recipes/$id", params: { id: kept[0].id } });
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 96 }}>
        {busy ? (
          <div style={{ padding: "120px 0", textAlign: "center" }}>
            <div
              className="culinario-loading"
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontSize: 32,
                color: "var(--fg-muted)",
              }}
            >
              {busy}
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div
                style={{
                  marginBottom: 24,
                  padding: 12,
                  border: "1px solid var(--saffron)",
                  color: "var(--saffron)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            )}

            {stage === 1 && (
              <Stage1
                surfaces={surfaces}
                toggle={toggleSurface}
                onContinue={() => setStage(2)}
                buckWild={buckWild}
                setBuckWild={setBuckWild}
                onBuckWild={startBuckWild}
              />
            )}
            {stage === 2 && (
              <Stage2
                surfaces={surfaces}
                photos={photos}
                onUpload={uploadPhoto}
                onRemove={removePhoto}
                totalPhotos={totalPhotos}
                onContinue={runDetect}
              />
            )}
            {stage === 3 && (
              <Stage3
                detected={detected}
                setDetected={setDetected}
                manualInput={manualInput}
                setManualInput={setManualInput}
                showManual={showManual}
                setShowManual={setShowManual}
                onContinue={confirmIngredients}
              />
            )}
            {stage === 4 && (
              <Stage4
                voice={voice}
                setVoice={setVoice}
                people={people}
                cookingFor={cookingFor}
                setCookingFor={setCookingFor}
                onGenerate={runGenerate}
              />
            )}
            {stage === 5 && recipes.length > 0 && (
              <Stage5
                recipes={recipes}
                voiceLines={voiceLines}
                saveSet={saveSet}
                toggleSave={toggleSave}
                onDone={onDone}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* -------------------- Stage 1 -------------------- */
function Stage1({
  surfaces,
  toggle,
  onContinue,
  buckWild,
  setBuckWild,
  onBuckWild,
}: {
  surfaces: Surface[];
  toggle: (s: Surface) => void;
  onContinue: () => void;
  buckWild: boolean;
  setBuckWild: (v: boolean) => void;
  onBuckWild: () => void;
}) {
  return (
    <>
      {eyebrow("№ 002 — A new session")}
      {headline("What did you photograph?")}
      <HR />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {SURFACES.map((s) => {
          const active = surfaces.includes(s);
          const disabled = buckWild;
          return (
            <button
              key={s}
              type="button"
              onClick={() => !disabled && toggle(s)}
              disabled={disabled}
              className="culinario-surface-row"
              style={{
                background: "transparent",
                border: 0,
                borderBottom: "1px solid var(--hairline)",
                padding: "20px 0",
                textAlign: "left",
                cursor: disabled ? "default" : "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: disabled ? "var(--fg-low)" : (active ? "var(--saffron)" : "var(--fg-muted)"),
              }}
            >
              {s}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setBuckWild(!buckWild)}
          style={{
            background: "transparent",
            border: 0,
            borderBottom: "1px solid var(--hairline)",
            padding: "20px 0",
            textAlign: "left",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: buckWild ? "var(--saffron)" : "var(--fg-muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>OR — surprise me, no photos</span>
          <span style={{ color: buckWild ? "var(--saffron)" : "var(--fg-muted)" }}>
            {buckWild ? "[•]" : "[ ]"}
          </span>
        </button>
      </div>
      <HR />
      <div style={{ textAlign: "center" }}>
        {buckWild ? (
          <button style={ctaBtn(true)} onClick={onBuckWild}>
            Generate recipe <Arrow />
          </button>
        ) : (
          <button style={ctaBtn(surfaces.length > 0)} disabled={surfaces.length === 0} onClick={onContinue}>
            Continue <Arrow />
          </button>
        )}
      </div>
    </>
  );
}

/* -------------------- Stage 2 -------------------- */
function Stage2({
  surfaces,
  photos,
  onUpload,
  onRemove,
  totalPhotos,
  onContinue,
}: {
  surfaces: Surface[];
  photos: Record<Surface, string[]>;
  onUpload: (s: Surface, f: File) => void;
  onRemove: (s: Surface, p: string) => void;
  totalPhotos: number;
  onContinue: () => void;
}) {
  return (
    <>
      {eyebrow("№ 002 — Photographs")}
      {headline("Show me what's there.")}
      <HR />
      <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
        {surfaces.map((s) => (
          <SurfaceUpload
            key={s}
            surface={s}
            paths={photos[s]}
            onUpload={(f) => onUpload(s, f)}
            onRemove={(p) => onRemove(s, p)}
          />
        ))}
      </div>
      <HR />
      <div style={{ textAlign: "center" }}>
        <button style={ctaBtn(totalPhotos > 0)} disabled={totalPhotos === 0} onClick={onContinue}>
          Detect ingredients <Arrow />
        </button>
      </div>
    </>
  );
}

function SurfaceUpload({
  surface,
  paths,
  onUpload,
  onRemove,
}: {
  surface: Surface;
  paths: string[];
  onUpload: (f: File) => void;
  onRemove: (p: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const p of paths) {
        if (previews[p]) {
          next[p] = previews[p];
          continue;
        }
        const { data } = await supabase.storage
          .from("session-photos")
          .createSignedUrl(p, 60 * 30);
        if (data?.signedUrl) next[p] = data.signedUrl;
      }
      if (!cancelled) setPreviews(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join("|")]);

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        {surface}
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <label
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="culinario-photo-zone"
          style={{
            position: "relative",
            background: "transparent",
            border: `1px solid ${hover ? "var(--fg)" : "var(--hairline)"}`,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            color: "var(--fg-muted)",
            transition: "border-color 0.15s",
          }}
        >
          <span style={{ display: "contents", pointerEvents: "none" }}>
            <CameraIcon />
            <span style={{ fontFamily: "var(--font-body)", fontSize: 14 }}>Tap to add photo</span>
          </span>
          <input
            type="file"
            accept="image/*,.heic,.heif"
            aria-label={`Add ${surface.toLowerCase()} photo`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
            }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {paths.length > 0 && (
        <div className="culinario-thumbs" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
          {paths.map((p) => (
            <div key={p} style={{ position: "relative", width: 56, height: 56, flex: "0 0 auto" }}>
              {previews[p] ? (
                <img src={previews[p]} alt="" style={{ width: 56, height: 56, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 56, height: 56, background: "var(--surface-elev)" }} />
              )}
              <button
                onClick={() => onRemove(p)}
                aria-label="Remove"
                className="culinario-x-tap"
                style={{
                  position: "absolute",
                  top: -22,
                  right: -22,
                  color: "var(--fg-muted)",
                  cursor: "pointer",
                  fontSize: 12,
                  lineHeight: 1,
                  padding: 0,
                  background: "transparent",
                  border: 0,
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: "var(--bg)", border: "1px solid var(--hairline)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>×</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- Stage 3 -------------------- */
function Stage3({
  detected,
  setDetected,
  manualInput,
  setManualInput,
  showManual,
  setShowManual,
  onContinue,
}: {
  detected: DetectedItem[];
  setDetected: (fn: (prev: DetectedItem[]) => DetectedItem[]) => void;
  manualInput: string;
  setManualInput: (v: string) => void;
  showManual: boolean;
  setShowManual: (v: boolean) => void;
  onContinue: () => void;
}) {
  const high = detected.filter((d) => d.confidence === "high");
  const low = detected.filter((d) => d.confidence === "low");

  const removeAt = (name: string) =>
    setDetected((prev) => prev.filter((d) => d.name !== name));

  const pickAlt = (name: string, choice: string) =>
    setDetected((prev) => prev.map((d) => (d.name === name ? { ...d, chosen: choice } : d)));

  const addManual = () => {
    const n = manualInput.trim().toLowerCase();
    if (!n) return;
    if (detected.find((d) => d.name === n)) {
      setManualInput("");
      return;
    }
    setDetected((prev) => [...prev, { name: n, confidence: "high" }]);
    setManualInput("");
  };

  return (
    <>
      {eyebrow("№ 002 — Detected ingredients")}
      {headline("Here's what I see.")}
      <HR />
      {high.length === 0 ? (
        <div style={{ color: "var(--fg-muted)", fontFamily: "var(--font-body)", fontSize: 14 }}>
          Nothing detected with confidence. Add manually below.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {high.map((d) => (
            <DetectedRow key={d.name} name={d.name} onRemove={() => removeAt(d.name)} />
          ))}
        </div>
      )}

      {low.length > 0 && (
        <>
          <HR />
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: 28,
              margin: "0 0 24px",
            }}
          >
            Help me out.
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {low.map((d) => {
              const alts = Array.from(
                new Set(
                  (d.alternatives ?? [])
                    .map((a) => a.trim().toLowerCase())
                    .filter((a) => a && a !== d.name.trim().toLowerCase())
                )
              );
              const options = Array.from(new Set([d.name, ...alts]));
              return (
              <div key={d.name}>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--fg)", marginBottom: 12 }}>
                  {alts.length > 0
                    ? `Is this ${d.name}, or ${alts.join(", or ")}?`
                    : `Is this ${d.name}?`}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {options.map((alt) => {
                    const active = (d.chosen ?? d.name) === alt;
                    return (
                      <button
                        key={alt}
                        onClick={() => pickAlt(d.name, alt)}
                        className="culinario-chip"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.15em",
                          padding: "8px 14px",
                          background: "transparent",
                          border: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
                          color: active ? "var(--saffron)" : "var(--fg-muted)",
                          cursor: "pointer",
                          borderRadius: 0,
                        }}
                      >
                        {alt}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => removeAt(d.name)}
                    className="culinario-chip"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                      padding: "8px 14px",
                      background: "transparent",
                      border: "1px solid var(--hairline)",
                      color: "var(--fg-low)",
                      cursor: "pointer",
                    }}
                  >
                    skip
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}

      <HR />
      {showManual ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addManual();
              }
            }}
            placeholder="ingredient name"
            className="culinario-input"
            style={{
              flex: 1,
              background: "transparent",
              border: 0,
              borderBottom: "1px solid var(--hairline)",
              padding: "10px 0",
              fontFamily: "var(--font-body)",
              fontSize: 16,
              color: "var(--fg)",
              outline: "none",
            }}
            autoFocus
          />
          <button onClick={addManual} style={ctaBtn(true)}>
            Add <Arrow />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowManual(true)}
          style={{
            background: "transparent",
            border: 0,
            color: "var(--fg-muted)",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            padding: 0,
          }}
        >
          + Add ingredient
        </button>
      )}

      <HR />
      <div style={{ textAlign: "center" }}>
        <button style={ctaBtn(true)} onClick={onContinue}>
          Continue <Arrow />
        </button>
      </div>
    </>
  );
}

function DetectedRow({ name, onRemove }: { name: string; onRemove: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderBottom: "1px solid var(--hairline)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: "var(--fg)",
      }}
    >
      <span>{name}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="culinario-x-tap"
        style={{
          background: "transparent",
          border: 0,
          cursor: "pointer",
          color: hover ? "var(--saffron)" : "var(--fg-low)",
          fontSize: 18,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

/* -------------------- Stage 4 -------------------- */
function Stage4({
  voice,
  setVoice,
  people,
  cookingFor,
  setCookingFor,
  onGenerate,
}: {
  voice: string;
  setVoice: (v: string) => void;
  people: { id: string; name: string }[];
  cookingFor: string[];
  setCookingFor: (fn: (prev: string[]) => string[]) => void;
  onGenerate: () => void;
}) {
  const toggleP = (id: string) =>
    setCookingFor((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <>
      {eyebrow("№ 002 — Tonight")}
      {headline("Tell me about tonight.")}
      <HR />

      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
            marginBottom: 16,
          }}
        >
          Voice
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {VOICE_LIST.map((v) => {
            const active = voice === v.slug;
            return (
              <button
                key={v.slug}
                onClick={() => setVoice(v.slug)}
                className="culinario-chip"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  padding: "8px 14px",
                  background: "transparent",
                  border: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
                  color: active ? "var(--saffron)" : "var(--fg-muted)",
                  cursor: "pointer",
                }}
              >
                {v.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 40 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
            marginBottom: 16,
          }}
        >
          Cooking for
        </div>
        {people.length === 0 ? (
          <div style={{ color: "var(--fg-low)", fontFamily: "var(--font-body)", fontSize: 14 }}>
            No one yet. (optional)
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {people.map((p) => {
              const active = cookingFor.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleP(p.id)}
                  className="culinario-chip"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    padding: "8px 14px",
                    background: "transparent",
                    border: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
                    color: active ? "var(--saffron)" : "var(--fg-muted)",
                    cursor: "pointer",
                  }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <HR />
      <div style={{ textAlign: "center" }}>
        <button style={ctaBtn(!!voice)} disabled={!voice} onClick={onGenerate}>
          Generate recipe <Arrow />
        </button>
      </div>
    </>
  );
}

/* -------------------- Stage 5 -------------------- */
function Stage5({
  recipes,
  voiceLines,
  saveSet,
  toggleSave,
  onDone,
}: {
  recipes: RecipeRow[];
  voiceLines: Record<string, VoiceLineRow>;
  saveSet: Set<string>;
  toggleSave: (id: string) => void;
  onDone: () => void;
}) {
  const colLabel = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: "var(--fg-muted)",
    marginBottom: 6,
  };
  const colVal = {
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    color: "var(--fg)",
    fontFeatureSettings: '"tnum"',
  };
  const sectionLabel = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    color: "var(--fg-muted)",
    marginBottom: 16,
  };
  const savedCount = saveSet.size;

  return (
    <>
      {eyebrow("№ 002 — Three ways tonight")}
      {headline("Three ways tonight.")}
      <HR />

      {recipes.map((r, idx) => {
        const vl = voiceLines[r.id];
        const voiceName =
          VOICE_LIST.find((v) => v.slug === vl?.voice_character)?.name ??
          vl?.voice_character ??
          "the kitchen";
        const body = (r.body ?? {}) as any;
        const ingredients: any[] = Array.isArray(body.ingredients) ? body.ingredients : [];
        const steps: any[] = Array.isArray(body.steps) ? body.steps : [];
        const intro = vl?.intro_line || body.rationale || null;
        const isSaved = saveSet.has(r.id);
        return (
          <div key={r.id}>
            {idx > 0 && <HR />}
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 300,
                fontStyle: "italic",
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
                margin: 0,
                color: "var(--fg)",
              }}
            >
              {r.title ?? "Untitled"}
            </h2>
            <div
              style={{
                marginTop: 12,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--fg-muted)",
              }}
            >
              As told by {voiceName}
            </div>
            {r.is_wildcard && r.wildcard_rationale && (
              <div
                style={{
                  marginTop: 8,
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontSize: 16,
                  color: "var(--saffron)",
                }}
              >
                An attempt to surprise you well. {r.wildcard_rationale}
              </div>
            )}
            <div
              className="culinario-recipe-meta"
              style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}
            >
              <div>
                <div style={colLabel}>Cuisine</div>
                <div style={colVal}>{r.cuisine ?? "—"}</div>
              </div>
              <div>
                <div style={colLabel}>Time</div>
                <div style={colVal}>{r.time_estimate_minutes ? `${r.time_estimate_minutes} min` : "—"}</div>
              </div>
              <div>
                <div style={colLabel}>Difficulty</div>
                <div style={colVal}>{r.difficulty ?? "—"}</div>
              </div>
            </div>

            {intro && (
              <p
                style={{
                  marginTop: 24,
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontSize: 20,
                  lineHeight: 1.4,
                  color: "var(--fg-muted)",
                }}
              >
                {intro}
              </p>
            )}

            <div style={{ ...sectionLabel, marginTop: 32 }}>Ingredients</div>
            <div style={{ display: "flex", flexDirection: "column", marginBottom: 32 }}>
              {ingredients.map((ing: any, i: number) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--fg)" }}>
                    {ing.item ?? ing.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-muted)",
                      fontFeatureSettings: '"tnum"',
                      textAlign: "right",
                      marginLeft: 16,
                    }}
                  >
                    {(() => {
                      const amt = (ing?.amount ?? "").toString().trim();
                      const unit = (ing?.unit ?? "").toString().trim();
                      return amt && unit ? `${amt} ${unit}` : (amt || unit);
                    })()}
                  </span>
                </div>
              ))}
            </div>

            <div style={sectionLabel}>Method</div>
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {steps.map((s: any, i: number) => {
                const text = typeof s === "string" ? s : (s?.text ?? "");
                return (
                  <li key={i} style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--saffron)",
                        fontFeatureSettings: '"tnum"',
                        minWidth: 24,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 16,
                        lineHeight: 1.6,
                        color: "var(--fg)",
                      }}
                    >
                      {text}
                    </span>
                  </li>
                );
              })}
            </ol>

            {vl?.success_line && (
              <p
                style={{
                  marginTop: 32,
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontSize: 20,
                  lineHeight: 1.4,
                  color: "var(--fg-muted)",
                }}
              >
                {vl.success_line}
              </p>
            )}

            <div style={{ marginTop: 32, textAlign: "center" }}>
              <button
                onClick={() => toggleSave(r.id)}
                style={{
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: isSaved ? "var(--saffron)" : "var(--fg-muted)",
                  padding: "8px 0",
                }}
              >
                {isSaved ? "✓ Saved to cookbook" : "Save to cookbook"}
              </button>
            </div>
          </div>
        );
      })}

      <HR />
      <div style={{ textAlign: "center" }}>
        <button
          style={ctaBtn(savedCount > 0)}
          disabled={savedCount === 0}
          onClick={onDone}
        >
          Done <Arrow />
        </button>
      </div>
    </>
  );
}