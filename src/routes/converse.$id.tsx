import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";
import { useSuppressChatWhileMounted } from "@/lib/chat-suppression";
import { AppHeader } from "@/components/AppHeader";
import { getFaceCropStyle, parseFaceBox, type FaceBox } from "@/lib/face-crop";

export const Route = createFileRoute("/converse/$id")({
  head: () => ({
    meta: [
      { title: "Conversation — Culinario" },
      { name: "description", content: "A conversation in progress." },
    ],
  }),
  component: ConversationPage,
});

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  recipe_id?: string | null;
  // Local-only: when an extracted recipe comes back from a turn, we hang it
  // on the assistant message so the card renders inline. Persisted shape on
  // the server is just recipe_id; full recipe is on the recipes row.
  recipe?: ExtractedRecipe | null;
};

type ExtractedRecipe = {
  id?: string | null;
  title: string;
  cuisine?: string | null;
  time_estimate_minutes?: number | null;
  difficulty?: string | null;
  ingredients: Array<{ item: string; amount: string; unit?: string | null }>;
  steps: string[];
};

type Conversation = {
  id: string;
  user_id: string;
  figure_name: string;
  figure_key: string;
  persona: any;
  messages: ChatMessage[];
  last_recipe: ExtractedRecipe | null;
  portrait_url: string | null;
  portrait_face_box: any;
  created_at: string;
  updated_at: string;
};

function ConversationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  // Hide the global Culinario chat widget while this route is mounted —
  // otherwise its floating bubble parks on top of the conversation send
  // button on mobile. Restores automatically on unmount.
  useSuppressChatWhileMounted();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Local working copy of messages (additive: we append optimistically and
  // then reconcile with the server response).
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate({ to: "/sign-in" });
  }, [session, authLoading, navigate]);

  // Load conversation
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("persona_conversations" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setLoadErr(`${error.code ?? "?"}: ${error.message}`); setLoading(false); return; }
      if (!data) { setLoadErr("Conversation not found."); setLoading(false); return; }
      const row = data as unknown as Conversation;
      setConv(row);
      const initialMessages: ChatMessage[] = Array.isArray(row.messages) ? row.messages as ChatMessage[] : [];
      setMessages(initialMessages);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, session?.user?.id]);

  // Auto-scroll to bottom whenever messages change OR while sending
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [messages.length, sending]);

  // Auto-resize the textarea up to a sane cap
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [draft]);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending || !conv) return;
    setSendErr(null);
    setSending(true);

    // Optimistic append
    const nowIso = new Date().toISOString();
    const userMsg: ChatMessage = { role: "user", content: message, timestamp: nowIso };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");

    try {
      const { data, error } = await supabase.functions.invoke("conversation-turn", {
        body: { conversation_id: conv.id, user_message: message },
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

      const replyText: string = (data as any)?.reply ?? "";
      const extractedRecipe: ExtractedRecipe | null = (data as any)?.recipe ?? null;

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: replyText,
        timestamp: new Date().toISOString(),
        recipe_id: extractedRecipe?.id ?? null,
        recipe: extractedRecipe,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      // Roll back the optimistic user message on failure so the user can retry.
      setMessages((prev) => prev.slice(0, -1));
      setDraft(message);
      setSendErr(e?.message ?? "The kitchen line dropped.");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    // Enter sends; Shift+Enter inserts newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
        <AppHeader />
        <main className="culinario-page" style={{ paddingTop: 96 }}>
          <div style={eyebrow}>Walking them into the room…</div>
        </main>
      </div>
    );
  }
  if (loadErr || !conv) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
        <AppHeader />
        <main className="culinario-page" style={{ paddingTop: 96 }}>
          <div style={{ ...eyebrow, color: "var(--saffron)" }}>{loadErr ?? "Not found."}</div>
          <div style={{ marginTop: 20 }}>
            <Link to="/converse" style={{ ...eyebrow, textDecoration: "none", color: "var(--saffron)" }}>
              ← Back to Conversation Mode
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const initial = (conv.figure_name?.[0] ?? "?").toUpperCase();
  const faceBox = parseFaceBox(conv.portrait_face_box);
  const disambig = conv.persona?.disambiguator ?? "";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", display: "flex", flexDirection: "column" }}>
      <AppHeader current="Converse" />

      {/* Header — persona identity + new conversation CTA */}
      <div style={{
        flexShrink: 0,
        borderBottom: "1px solid var(--hairline)",
        background: "color-mix(in oklab, var(--bg) 92%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <div className="culinario-page" style={{ paddingTop: 20, paddingBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <div
              aria-hidden="true"
              className="cv-persona-portrait"
              style={{
                width: 64, height: 64,
                ...(conv.portrait_url ? { backgroundImage: `url(${conv.portrait_url})`, ...getFaceCropStyle(faceBox, 64) } : {}),
              }}
            >
              {!conv.portrait_url && <span className="cv-persona-initial">{initial}</span>}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={eyebrow}>№ 010 — Conversation Mode</div>
              <h1 style={{
                fontFamily: "var(--font-display)", fontWeight: 400, fontStyle: "italic",
                fontSize: "clamp(24px, 4vw, 36px)", lineHeight: 1.1,
                margin: "4px 0 2px", color: "var(--fg)",
              }}>
                {conv.figure_name}
              </h1>
              {disambig && (
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em",
                  textTransform: "uppercase", color: "var(--fg-low)",
                }}>
                  {disambig}
                </div>
              )}
            </div>
            <Link
              to="/converse"
              style={{
                fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
                textTransform: "uppercase", color: "var(--saffron)",
                textDecoration: "none", whiteSpace: "nowrap",
                border: "1px solid color-mix(in oklab, var(--saffron) 65%, transparent)",
                padding: "8px 14px", borderRadius: 9999,
              }}
            >
              Start a new conversation ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Conversation scroller */}
      <div
        ref={scrollerRef}
        style={{
          flex: 1, overflowY: "auto",
          // Bottom padding leaves room for the sticky input bar.
          padding: "32px 0 200px",
        }}
      >
        <div className="culinario-page" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {messages.map((m, i) => (
            <MessageRow
              key={`${i}-${m.timestamp ?? i}`}
              message={m}
              figureName={conv.figure_name}
              portraitUrl={conv.portrait_url}
              portraitFaceBox={faceBox}
              initial={initial}
            />
          ))}
          {sending && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <div
                aria-hidden="true"
                className="cv-msg-avatar"
                style={{
                  width: 32, height: 32,
                  ...(conv.portrait_url ? { backgroundImage: `url(${conv.portrait_url})`, ...getFaceCropStyle(faceBox, 32) } : {}),
                }}
              >
                {!conv.portrait_url && <span className="cv-msg-avatar-initial">{initial}</span>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="cv-typing-dot" style={{ animationDelay: `${i * 160}ms` }} />
                ))}
              </div>
            </div>
          )}
          {sendErr && (
            <div style={{ ...eyebrow, color: "var(--saffron)" }}>{sendErr}</div>
          )}
        </div>
      </div>

      {/* Sticky input bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "color-mix(in oklab, var(--bg) 92%, transparent)",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        borderTop: "1px solid var(--hairline)",
        padding: "16px 0 calc(16px + env(safe-area-inset-bottom, 0px))",
        zIndex: 20,
      }}>
        <div className="culinario-page" style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Say something to ${conv.figure_name}…`}
            rows={1}
            disabled={sending}
            style={{
              flex: 1,
              background: "transparent",
              color: "var(--fg)",
              border: "1px solid var(--hairline)",
              borderRadius: 18,
              padding: "12px 16px",
              fontFamily: "var(--font-body)",
              fontSize: 15,
              lineHeight: 1.5,
              outline: "none",
              resize: "none",
              minHeight: 44,
              maxHeight: 200,
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || sending}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: !draft.trim() || sending ? "var(--fg-low)" : "var(--saffron)",
              background: "transparent",
              border: "1px solid",
              borderColor: !draft.trim() || sending ? "var(--hairline)" : "var(--saffron)",
              cursor: !draft.trim() || sending ? "not-allowed" : "pointer",
              padding: "12px 18px", borderRadius: 9999,
              flexShrink: 0,
              alignSelf: "flex-end",
            }}
          >
            Send ↗
          </button>
        </div>
      </div>

      <style>{`
        .cv-persona-portrait {
          border-radius: 50%; flex-shrink: 0;
          background-color: color-mix(in oklab, var(--saffron) 18%, var(--surface-elev));
          background-position: center 22%; background-size: cover; background-repeat: no-repeat;
          border: 2px solid color-mix(in oklab, var(--saffron) 65%, transparent);
          box-shadow:
            0 0 0 3px color-mix(in oklab, var(--saffron) 14%, transparent),
            0 6px 18px -6px color-mix(in oklab, var(--saffron) 55%, transparent);
          display: flex; align-items: center; justify-content: center;
        }
        .cv-persona-initial {
          font-family: var(--font-display); font-style: italic; font-weight: 600;
          font-size: 28px; color: var(--saffron);
        }
        .cv-msg-avatar {
          border-radius: 50%; flex-shrink: 0;
          background-color: color-mix(in oklab, var(--saffron) 18%, var(--surface-elev));
          background-position: center 22%; background-size: cover; background-repeat: no-repeat;
          border: 1px solid color-mix(in oklab, var(--saffron) 55%, transparent);
          display: flex; align-items: center; justify-content: center;
          align-self: flex-start; margin-top: 4px;
        }
        .cv-msg-avatar-initial {
          font-family: var(--font-display); font-style: italic; font-weight: 600;
          font-size: 13px; color: var(--saffron);
        }
        @keyframes cv-typing { 0%,80%,100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-6px); opacity: 1; } }
        .cv-typing-dot {
          width: 8px; height: 8px; border-radius: 9999px;
          background: var(--saffron);
          box-shadow: 0 0 10px color-mix(in oklab, var(--saffron) 70%, transparent);
          animation: cv-typing 1.2s ease-in-out infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One message — user vs persona get distinct typographic treatments.
// ─────────────────────────────────────────────────────────────────────────────
function MessageRow({
  message, figureName, portraitUrl, portraitFaceBox, initial,
}: {
  message: ChatMessage;
  figureName: string;
  portraitUrl: string | null;
  portraitFaceBox: FaceBox;
  initial: string;
}) {
  if (message.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          maxWidth: "70%",
          padding: "12px 18px",
          borderRadius: 18,
          background: "color-mix(in oklab, var(--surface-elev) 60%, transparent)",
          border: "1px solid var(--hairline)",
          fontFamily: "var(--font-body)",
          fontSize: 15, lineHeight: 1.55, color: "var(--fg)",
          whiteSpace: "pre-wrap",
        }}>
          {message.content}
        </div>
      </div>
    );
  }

  // Persona message — wider, more typographic weight, with tiny avatar
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", maxWidth: "92%" }}>
      <div
        aria-hidden="true"
        className="cv-msg-avatar"
        style={{
          width: 32, height: 32,
          ...(portraitUrl ? { backgroundImage: `url(${portraitUrl})`, ...getFaceCropStyle(portraitFaceBox, 32) } : {}),
        }}
      >
        {!portraitUrl && <span className="cv-msg-avatar-initial">{initial}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em",
          textTransform: "uppercase", color: "var(--fg-low)", marginBottom: 8,
        }}>
          {figureName}
        </div>
        <div style={{
          fontFamily: "var(--font-body)",
          fontSize: 17, lineHeight: 1.65, color: "var(--fg)",
          whiteSpace: "pre-wrap",
        }}>
          {message.content}
        </div>
        {message.recipe && (
          <InlineRecipeCard recipe={message.recipe} figureName={figureName} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline recipe card — surfaces when conversation-turn extracted a recipe.
// The recipe is already saved server-side as a row in recipes; the CTA opens
// the full structured view at /recipes/$id.
// ─────────────────────────────────────────────────────────────────────────────
function InlineRecipeCard({ recipe, figureName }: { recipe: ExtractedRecipe; figureName: string }) {
  const navigate = useNavigate();
  const open = () => {
    if (recipe.id) navigate({ to: "/recipes/$id", params: { id: recipe.id } });
  };
  return (
    <div
      onClick={recipe.id ? open : undefined}
      role={recipe.id ? "button" : undefined}
      tabIndex={recipe.id ? 0 : undefined}
      style={{
        marginTop: 20,
        padding: "20px 22px",
        border: "1px solid color-mix(in oklab, var(--saffron) 55%, transparent)",
        borderRadius: 18,
        background: "color-mix(in oklab, var(--saffron) 6%, transparent)",
        cursor: recipe.id ? "pointer" : "default",
        transition: "transform 180ms ease, box-shadow 180ms ease",
      }}
      onMouseEnter={(e) => {
        if (!recipe.id) return;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 30px -10px color-mix(in oklab, var(--saffron) 50%, transparent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em",
        textTransform: "uppercase", color: "var(--saffron)", marginBottom: 10,
      }}>
        A recipe from {figureName}
      </div>
      <h3 style={{
        fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400,
        fontSize: 24, lineHeight: 1.15, margin: "0 0 8px", color: "var(--fg)",
      }}>
        {recipe.title}
      </h3>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
        textTransform: "uppercase", color: "var(--fg-muted)",
      }}>
        {[
          recipe.cuisine,
          typeof recipe.time_estimate_minutes === "number" ? `${recipe.time_estimate_minutes} min` : null,
          recipe.difficulty,
          `${(recipe.ingredients ?? []).length} ingredients`,
          `${(recipe.steps ?? []).length} steps`,
        ].filter(Boolean).join(" · ")}
      </div>
      {recipe.id && (
        <div style={{
          marginTop: 14,
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.22em",
          textTransform: "uppercase", color: "var(--saffron)",
        }}>
          Open recipe ↗
        </div>
      )}
    </div>
  );
}
