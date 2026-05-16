import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { AppHeader } from "@/components/AppHeader";
import { getFaceCropStyle, parseFaceBox, type FaceBox } from "@/lib/face-crop";

export const Route = createFileRoute("/converse/")({
  head: () => ({
    meta: [
      { title: "Conversation Mode — Culinario" },
      { name: "description", content: "Pick anyone who cooks. Have a real conversation with them about food." },
    ],
  }),
  component: ConverseEntryPage,
});

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};
const hairline: React.CSSProperties = { border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" };

type ArchiveRow = {
  id: string;
  figure_name: string;
  persona: any;
  messages: Array<{ role: string; content: string; timestamp?: string }>;
  portrait_url: string | null;
  portrait_face_box: any;
  updated_at: string;
};

function ConverseEntryPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  const [archive, setArchive] = useState<ArchiveRow[] | null>(null);
  const [archiveErr, setArchiveErr] = useState<string | null>(null);

  const [figure, setFigure] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyError, setBusyError] = useState<string | null>(null);

  const [phraseIdx, setPhraseIdx] = useState(0);
  const phrases = useMemo(() => [
    "Building the persona…",
    "Reading their letters…",
    "Watching the way they talk…",
    "Remembering what they care about…",
    "Locating their pet peeves…",
    "Pouring them a drink…",
    "Setting the table for two…",
  ], []);
  useEffect(() => {
    if (!busy) { setPhraseIdx(0); return; }
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % phrases.length), 1400);
    return () => clearInterval(id);
  }, [busy, phrases.length]);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/sign-in" });
  }, [session, loading, navigate]);

  // Load archive
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("persona_conversations" as any)
        .select("id, figure_name, persona, messages, portrait_url, portrait_face_box, updated_at")
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false })
        .limit(120);
      if (cancelled) return;
      if (error) { setArchiveErr(error.message); return; }
      setArchive((data ?? []) as unknown as ArchiveRow[]);
    })();
    return () => { cancelled = true; };
  }, [session]);

  const start = async () => {
    const name = figure.trim();
    if (!name || busy) return;
    setBusy(true); setBusyError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-persona", {
        body: { figure_name: name },
      });
      if (error) {
        let msg = error.message ?? String(error);
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          }
        } catch {/* ignore */}
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const convId: string | undefined = (data as any)?.conversation_id;
      if (!convId) throw new Error("No conversation id returned.");
      navigate({ to: "/converse/$id", params: { id: convId } });
    } catch (e: any) {
      setBusyError(e?.message ?? "Couldn't start the conversation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <AppHeader current="Converse" />
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 240, position: "relative" }}>
        <div className="cv-orb cv-orb-a" />
        <div className="cv-orb cv-orb-b" />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={eyebrow}>№ 010 — Conversation Mode</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
            fontSize: "clamp(48px, 7vw, 80px)", lineHeight: 1.05,
            letterSpacing: "-0.02em", margin: "16px 0 12px",
          }}>
            Who do you want to cook with tonight?
          </h1>
          <p style={{
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 18, color: "var(--fg-muted)", margin: 0, maxWidth: 560,
          }}>
            Ask them anything. They have opinions.
          </p>

          {/* Input */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
            <label style={eyebrow}>The Cook</label>
            <input
              type="text"
              value={figure}
              onChange={(e) => setFigure(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") start(); }}
              placeholder="Bourdain. Julia Child. Escoffier. Your idea of Ina Garten."
              disabled={busy}
              autoFocus
              style={{
                width: "100%", background: "transparent", color: "var(--fg)",
                border: 0, borderBottom: "1px solid var(--hairline)",
                fontFamily: "var(--font-display)", fontStyle: "italic",
                fontSize: "clamp(18px, 5vw, 28px)", padding: "8px 0", outline: "none",
                minWidth: 0, maxWidth: "100%", boxSizing: "border-box",
              }}
            />
            <div>
              <button
                type="button"
                onClick={start}
                disabled={!figure.trim() || busy}
                style={{
                  fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
                  textTransform: "uppercase", letterSpacing: "0.2em",
                  color: !figure.trim() || busy ? "var(--fg-low)" : "var(--saffron)",
                  background: "transparent",
                  border: "1px solid",
                  borderColor: !figure.trim() || busy ? "var(--hairline)" : "var(--saffron)",
                  cursor: !figure.trim() || busy ? "not-allowed" : "pointer",
                  padding: "14px 22px", minHeight: 48, borderRadius: 0,
                }}
              >
                {busy ? "Building the persona…" : "Start the conversation"}
              </button>
            </div>
            {busyError && <div style={{ ...eyebrow, color: "var(--saffron)" }}>{busyError}</div>}
          </div>

          {/* Archive */}
          <hr style={hairline} />
          <div style={eyebrow}>Past conversations</div>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            {archiveErr && <div style={{ ...eyebrow, color: "var(--saffron)" }}>{archiveErr}</div>}
            {!archiveErr && archive === null && <div style={eyebrow}>Loading the archive…</div>}
            {!archiveErr && archive && archive.length === 0 && (
              <div style={{
                padding: "44px 28px", textAlign: "center",
                border: "1px dashed var(--hairline)", borderRadius: 24,
              }}>
                <div style={{
                  fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22,
                  color: "var(--fg-muted)",
                }}>No conversations yet. Start with someone whose voice you'd recognize.</div>
              </div>
            )}
            {archive?.map((c) => <ConversationArchiveRow key={c.id} conv={c} />)}
          </div>
        </div>

        <style>{`
          .cv-orb { position: absolute; border-radius: 9999px; filter: blur(80px); opacity: 0.28; pointer-events: none; z-index: 0; }
          .cv-orb-a {
            width: 460px; height: 460px; top: -120px; left: -100px;
            background: radial-gradient(circle, color-mix(in oklab, var(--saffron) 65%, transparent), transparent 65%);
          }
          .cv-orb-b {
            width: 520px; height: 520px; top: 30%; right: -160px;
            background: radial-gradient(circle, color-mix(in oklab, var(--saffron) 40%, #0e2a2a), transparent 65%);
          }
        `}</style>
      </main>

      {busy && <StartingOverlay name={figure.trim()} phrase={phrases[phraseIdx]} />}
    </div>
  );
}

function ConversationArchiveRow({ conv }: { conv: ArchiveRow }) {
  const initial = (conv.figure_name?.[0] ?? "?").toUpperCase();
  const faceBox: FaceBox = parseFaceBox(conv.portrait_face_box);
  const lastAssistant = [...conv.messages].reverse().find((m) => m?.role === "assistant")?.content
    ?? "(no messages yet)";
  const disambig = conv.persona?.disambiguator ?? "";
  const turnCount = conv.messages.filter((m) => m.role === "user").length;
  return (
    <Link
      to="/converse/$id"
      params={{ id: conv.id }}
      className="cv-row"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        aria-hidden="true"
        className="cv-portrait-small"
        style={conv.portrait_url ? { backgroundImage: `url(${conv.portrait_url})`, ...getFaceCropStyle(faceBox, 72) } : undefined}
      >
        {!conv.portrait_url && <span className="cv-initial">{initial}</span>}
      </div>
      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500,
            fontSize: 26, lineHeight: 1.1, color: "var(--fg)",
          }}>
            {conv.figure_name}
          </div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "var(--fg-muted)",
          }}>
            {turnCount} {turnCount === 1 ? "turn" : "turns"}
          </div>
        </div>
        {disambig && (
          <div style={{
            marginTop: 4,
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em",
            color: "var(--fg-low)",
          }}>
            {disambig}
          </div>
        )}
        <div style={{
          marginTop: 10,
          fontFamily: "var(--font-body)", fontStyle: "italic",
          fontSize: 15, lineHeight: 1.55, color: "var(--fg-muted)",
          whiteSpace: "pre-wrap",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {lastAssistant}
        </div>
      </div>
      <div className="cv-cta" aria-hidden="true">
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "var(--saffron)", whiteSpace: "nowrap",
        }}>
          Continue
        </span>
      </div>
      <style>{`
        .cv-row {
          position: relative;
          display: flex; align-items: flex-start; gap: 18px;
          padding: 18px 22px;
          border-radius: 24px;
          border: 1px solid color-mix(in oklab, var(--fg) 12%, transparent);
          background: color-mix(in oklab, var(--surface-elev) 50%, transparent);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          box-shadow:
            0 14px 40px -18px color-mix(in oklab, var(--saffron) 30%, transparent),
            inset 0 1px 0 color-mix(in oklab, white 14%, transparent);
          cursor: pointer;
          color: var(--fg);
          transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease;
          overflow: hidden;
          width: 100%;
        }
        .cv-row:hover {
          transform: translateY(-2px);
          border-color: color-mix(in oklab, var(--saffron) 45%, transparent);
          box-shadow:
            0 22px 50px -18px color-mix(in oklab, var(--saffron) 50%, transparent),
            inset 0 1px 0 color-mix(in oklab, white 22%, transparent);
        }
        .cv-portrait-small {
          width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
          background-color: color-mix(in oklab, var(--saffron) 18%, var(--surface-elev));
          background-position: center 22%; background-size: cover; background-repeat: no-repeat;
          border: 2px solid color-mix(in oklab, var(--saffron) 65%, transparent);
          box-shadow:
            0 0 0 4px color-mix(in oklab, var(--saffron) 14%, transparent),
            0 8px 24px -8px color-mix(in oklab, var(--saffron) 55%, transparent);
          display: flex; align-items: center; justify-content: center;
        }
        .cv-initial {
          font-family: var(--font-display); font-style: italic; font-weight: 600;
          font-size: 28px; color: var(--saffron);
        }
        .cv-cta { align-self: center; padding-left: 12px; flex-shrink: 0; opacity: 0.65; transition: opacity 240ms ease, transform 240ms ease; }
        .cv-row:hover .cv-cta { opacity: 1; transform: translateX(4px); }
        @media (max-width: 640px) { .cv-cta { display: none; } }
      `}</style>
    </Link>
  );
}

function StartingOverlay({ name, phrase }: { name: string; phrase: string }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "color-mix(in oklab, var(--bg) 55%, transparent)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        animation: "cv-fade-in 360ms ease-out both",
        overflow: "hidden",
        padding: 24,
      }}
    >
      <div className="cv-overlay-orb cv-overlay-orb-1" />
      <div className="cv-overlay-orb cv-overlay-orb-2" />
      <div
        style={{
          position: "relative", padding: "44px 56px", borderRadius: 28,
          border: "1px solid color-mix(in oklab, var(--fg) 14%, transparent)",
          background: "color-mix(in oklab, var(--bg) 35%, transparent)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.45), inset 0 1px 0 color-mix(in oklab, white 18%, transparent)",
          textAlign: "center", maxWidth: 520,
          animation: "cv-pop 520ms cubic-bezier(.2,.9,.3,1.2) both",
        }}
      >
        <div style={eyebrow}>№ 010 — Conversation Mode</div>
        <div
          style={{
            fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 300,
            fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.15, margin: "12px 0 18px",
            background: "linear-gradient(110deg, var(--fg) 30%, var(--saffron) 50%, var(--fg) 70%)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text", backgroundClip: "text",
            color: "transparent", animation: "cv-shimmer 2.4s linear infinite",
          }}
        >
          Walking {name || "them"} into the room…
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 18 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="cv-dot" style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </div>
        <div key={phrase} style={{ ...eyebrow, color: "var(--fg-muted)", animation: "cv-fade-in 380ms ease-out both" }}>
          {phrase}
        </div>
      </div>
      <style>{`
        @keyframes cv-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cv-pop { 0% { opacity: 0; transform: scale(0.92); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes cv-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes cv-float-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.08); } }
        @keyframes cv-float-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,40px) scale(1.12); } }
        .cv-overlay-orb { position: absolute; border-radius: 9999px; filter: blur(48px); opacity: 0.45; pointer-events: none; }
        .cv-overlay-orb-1 { width: 360px; height: 360px; top: -80px; left: -60px; background: radial-gradient(circle at 30% 30%, var(--saffron), transparent 60%); animation: cv-float-a 9s ease-in-out infinite; }
        .cv-overlay-orb-2 { width: 420px; height: 420px; bottom: -120px; right: -80px; background: radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--saffron) 55%, #0e2a2a), transparent 60%); animation: cv-float-b 11s ease-in-out infinite; }
        @keyframes cv-bounce { 0%,80%,100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-10px); opacity: 1; } }
        .cv-dot { width: 12px; height: 12px; border-radius: 9999px; background: var(--saffron); box-shadow: 0 0 14px color-mix(in oklab, var(--saffron) 70%, transparent); animation: cv-bounce 1.2s ease-in-out infinite; display: inline-block; }
      `}</style>
    </div>
  );
}
