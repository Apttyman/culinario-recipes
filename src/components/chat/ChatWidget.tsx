import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth-context";
import { useChatSuppression } from "@/lib/chat-suppression";

type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  updated_at: string | null;
  created_at: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  kind: string | null; // 'text' | 'share_notification'
  share_id: string | null;
  read_at: string | null;
  created_at: string;
};

type ConversationSummary = Conversation & {
  otherUserId: string;
  otherDisplayName: string | null;
  lastMessage: Message | null;
  unread: number;
};

type View = "collapsed" | "list" | "thread";

export function ChatWidget() {
  const { session } = useAuth();
  const { suppressed } = useChatSuppression();
  const userId = session?.user?.id;
  const [view, setView] = useState<View>("collapsed");
  const [convos, setConvos] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>({});
  const [profileNames, setProfileNames] = useState<Record<string, string | null>>({});

  const reload = async () => {
    if (!userId) return;
    const { data: rows } = await supabase
      .from("conversations" as any)
      .select("*")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("updated_at", { ascending: false, nullsFirst: false });
    const list = (rows ?? []) as unknown as Conversation[];
    if (list.length === 0) { setConvos([]); return; }

    const otherIds = Array.from(new Set(list.map((c) => (c.user_a === userId ? c.user_b : c.user_a))));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", otherIds);
    const nameMap: Record<string, string | null> = {};
    for (const p of (profs ?? []) as any[]) nameMap[p.id] = p.display_name ?? null;
    setProfileNames(nameMap);

    // Pull last message + unread for each conversation
    const ids = list.map((c) => c.id);
    const { data: msgs } = await supabase
      .from("messages" as any)
      .select("*")
      .in("conversation_id", ids)
      .order("created_at", { ascending: true });
    const byConv: Record<string, Message[]> = {};
    for (const m of (msgs ?? []) as unknown as Message[]) {
      (byConv[m.conversation_id] ??= []).push(m);
    }
    setMessagesByConv(byConv);

    const summaries: ConversationSummary[] = list.map((c) => {
      const otherUserId = c.user_a === userId ? c.user_b : c.user_a;
      const list = byConv[c.id] ?? [];
      const lastMessage = list.length ? list[list.length - 1] : null;
      const unread = list.filter((m) => m.sender_id !== userId && !m.read_at).length;
      return { ...c, otherUserId, otherDisplayName: nameMap[otherUserId] ?? null, lastMessage, unread };
    });
    setConvos(summaries);
  };

  useEffect(() => { if (userId) reload(); }, [userId]);

  // Realtime subscription on messages for this user's conversations
  useEffect(() => {
    if (!userId || convos.length === 0) return;
    const ids = convos.map((c) => c.id);
    const channel = supabase
      .channel(`chat-msgs-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=in.(${ids.join(",")})` },
        () => { reload(); },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=in.(${ids.join(",")})` },
        () => { reload(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, convos.map((c) => c.id).join(",")]);

  // Also listen for new conversations
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`chat-convos-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => { reload(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Mark messages read when thread opened
  useEffect(() => {
    if (view !== "thread" || !activeConvId || !userId) return;
    (async () => {
      await supabase
        .from("messages" as any)
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", activeConvId)
        .neq("sender_id", userId)
        .is("read_at", null);
      // Optimistic local update
      setMessagesByConv((prev) => {
        const next = { ...prev };
        next[activeConvId] = (next[activeConvId] ?? []).map((m) =>
          m.sender_id !== userId && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m,
        );
        return next;
      });
      setConvos((prev) => prev.map((c) => c.id === activeConvId ? { ...c, unread: 0 } : c));
    })();
  }, [view, activeConvId, userId, messagesByConv[activeConvId ?? ""]?.length]);

  const totalUnread = useMemo(() => convos.reduce((s, c) => s + c.unread, 0), [convos]);

  if (!userId || suppressed) return null;

  const activeConv = activeConvId ? convos.find((c) => c.id === activeConvId) ?? null : null;
  const activeMsgs = activeConvId ? (messagesByConv[activeConvId] ?? []) : [];

  return (
    <>
      {view === "collapsed" && (
        <button
          type="button"
          aria-label="Open chat"
          onClick={() => setView("list")}
          className="cw-fab"
        >
          <span aria-hidden>💬</span>
          {totalUnread > 0 && <span className="cw-badge">{totalUnread > 9 ? "9+" : totalUnread}</span>}
        </button>
      )}

      {view !== "collapsed" && (
        <div className="cw-panel" role="dialog" aria-label="Chat">
          <header className="cw-header">
            {view === "thread" ? (
              <>
                <button type="button" onClick={() => setView("list")} className="cw-icon-btn" aria-label="Back">←</button>
                <div className="cw-title">
                  {activeConv?.otherDisplayName ?? "Conversation"}
                </div>
              </>
            ) : (
              <div className="cw-title">Messages</div>
            )}
            <button
              type="button"
              onClick={() => setView("collapsed")}
              className="cw-icon-btn"
              aria-label="Close"
            >×</button>
          </header>

          <div className="cw-body">
            {view === "list" && (
              <ConversationList
                convos={convos}
                onOpen={(id) => { setActiveConvId(id); setView("thread"); }}
              />
            )}
            {view === "thread" && activeConvId && (
              <ThreadView
                conversationId={activeConvId}
                meId={userId}
                messages={activeMsgs}
                otherDisplayName={activeConv?.otherDisplayName ?? null}
                onChange={reload}
              />
            )}
          </div>
        </div>
      )}

      <style>{`
        .cw-fab {
          position: fixed; right: 20px; bottom: 20px; z-index: 90;
          width: 56px; height: 56px; border-radius: 9999px;
          border: 1px solid color-mix(in oklab, var(--saffron) 60%, transparent);
          background: var(--surface-elev);
          color: var(--saffron);
          font-size: 24px; cursor: pointer;
          box-shadow: 0 14px 40px -12px color-mix(in oklab, var(--saffron) 50%, transparent);
          display: flex; align-items: center; justify-content: center;
          transition: transform 150ms ease;
        }
        .cw-fab:hover { transform: translateY(-2px); }
        .cw-badge {
          position: absolute; top: -4px; right: -4px;
          min-width: 20px; height: 20px; padding: 0 6px;
          border-radius: 9999px; background: var(--saffron); color: #000;
          font-family: var(--font-mono); font-size: 11px; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .cw-panel {
          position: fixed; right: 20px; bottom: 20px; z-index: 90;
          width: 380px; max-width: calc(100vw - 24px);
          height: 560px; max-height: calc(100vh - 40px);
          background: var(--bg); color: var(--fg);
          border: 1px solid var(--hairline); border-radius: 16px;
          display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 30px 60px -20px rgba(0,0,0,0.7);
        }
        @media (max-width: 640px) {
          .cw-panel {
            right: 8px; left: 8px; bottom: 8px;
            width: auto; height: 80vh; max-height: calc(100vh - 16px);
          }
        }
        .cw-header {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 14px; border-bottom: 1px solid var(--hairline);
        }
        .cw-title {
          flex: 1;
          font-family: var(--font-display); font-style: italic;
          font-size: 18px; color: var(--fg);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cw-icon-btn {
          background: transparent; border: 0; color: var(--fg-muted);
          width: 32px; height: 32px; border-radius: 9999px;
          font-size: 20px; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .cw-icon-btn:hover { background: var(--surface-elev); color: var(--fg); }
        .cw-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      `}</style>
    </>
  );
}

function ConversationList({
  convos,
  onOpen,
}: { convos: ConversationSummary[]; onOpen: (id: string) => void }) {
  if (convos.length === 0) {
    return (
      <div style={{
        padding: 28, textAlign: "center", color: "var(--fg-muted)",
        fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16,
      }}>
        No conversations yet. Share a recipe to start one.
      </div>
    );
  }
  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {convos.map((c) => {
        const last = c.lastMessage;
        const preview = last
          ? last.kind === "share_notification"
            ? "📎 Shared something"
            : (last.body ?? "")
          : "No messages yet";
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            style={{
              width: "100%", textAlign: "left", background: "transparent",
              border: 0, borderBottom: "1px solid var(--hairline)",
              padding: "14px 16px", cursor: "pointer", color: "var(--fg)",
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 9999,
              background: "color-mix(in oklab, var(--saffron) 18%, var(--surface-elev))",
              color: "var(--saffron)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, fontSize: 16,
              flexShrink: 0,
            }}>
              {(c.otherDisplayName?.[0] ?? "?").toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline",
              }}>
                <div style={{
                  fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500,
                  fontSize: 16, color: "var(--fg)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {c.otherDisplayName ?? "Unnamed"}
                </div>
                {last && (
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-low)",
                    flexShrink: 0,
                  }}>{relTime(last.created_at)}</div>
                )}
              </div>
              <div style={{
                marginTop: 2, fontFamily: "var(--font-body)", fontSize: 13,
                color: c.unread > 0 ? "var(--fg)" : "var(--fg-muted)",
                fontWeight: c.unread > 0 ? 600 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{preview}</div>
            </div>
            {c.unread > 0 && (
              <div style={{
                minWidth: 20, height: 20, padding: "0 6px", borderRadius: 9999,
                background: "var(--saffron)", color: "#000",
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>{c.unread > 9 ? "9+" : c.unread}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ThreadView({
  conversationId,
  meId,
  messages,
  otherDisplayName,
  onChange,
}: {
  conversationId: string;
  meId: string;
  messages: Message[];
  otherDisplayName: string | null;
  onChange: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await supabase.from("messages" as any).insert({
        conversation_id: conversationId,
        sender_id: meId,
        body: text,
        kind: "text",
      });
      setDraft("");
      onChange();
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div ref={scrollerRef} style={{
        flex: 1, overflowY: "auto", padding: "16px 14px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{ color: "var(--fg-muted)", textAlign: "center", marginTop: 40, fontStyle: "italic" }}>
            Say hi to {otherDisplayName ?? "them"}.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} meId={meId} onChange={onChange} />
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        style={{
          padding: 12, borderTop: "1px solid var(--hairline)",
          display: "flex", gap: 8, alignItems: "flex-end",
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Message…"
          style={{
            flex: 1, resize: "none", maxHeight: 120,
            background: "var(--surface-elev)", color: "var(--fg)",
            border: "1px solid var(--hairline)", borderRadius: 18,
            padding: "10px 14px", fontFamily: "var(--font-body)", fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          style={{
            background: "var(--saffron)", color: "#000",
            border: 0, borderRadius: 9999, padding: "10px 16px",
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", fontWeight: 700,
            cursor: sending ? "wait" : "pointer", opacity: !draft.trim() ? 0.5 : 1,
          }}
        >Send</button>
      </form>
    </>
  );
}

function MessageBubble({ m, meId, onChange }: { m: Message; meId: string; onChange: () => void }) {
  const mine = m.sender_id === meId;
  if (m.kind === "share_notification" && m.share_id) {
    return <ShareNotificationCard m={m} meId={meId} onChange={onChange} />;
  }
  return (
    <div style={{
      alignSelf: mine ? "flex-end" : "flex-start",
      maxWidth: "78%",
      background: mine ? "var(--saffron)" : "var(--surface-elev)",
      color: mine ? "#000" : "var(--fg)",
      padding: "8px 12px", borderRadius: 16,
      borderTopRightRadius: mine ? 4 : 16,
      borderTopLeftRadius: mine ? 16 : 4,
      fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.4,
      whiteSpace: "pre-wrap", wordWrap: "break-word",
    }}>
      {m.body}
    </div>
  );
}

function ShareNotificationCard({ m, meId, onChange }: { m: Message; meId: string; onChange: () => void }) {
  const [share, setShare] = useState<any>(null);
  const [target, setTarget] = useState<any>(null);
  const [senderName, setSenderName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!m.share_id) return;
    let cancelled = false;
    (async () => {
      const { data: sRaw } = await supabase
        .from("shares" as any).select("*").eq("id", m.share_id).maybeSingle();
      const s: any = sRaw;
      if (cancelled || !s) return;
      setShare(s);
      const { data: prof } = await supabase
        .from("profiles").select("display_name").eq("id", s.sender_id).maybeSingle();
      if (!cancelled) setSenderName((prof as any)?.display_name ?? null);
      // Lookup preview
      if (s.kind === "recipe") {
        const { data: r } = await supabase
          .from("recipes").select("id, title").eq("id", s.target_id).maybeSingle();
        if (!cancelled) setTarget(r);
      } else if (s.kind === "duel") {
        const { data: d } = await supabase
          .from("duels" as any).select("id, chef_a, chef_b").eq("id", s.target_id).maybeSingle();
        if (!cancelled) setTarget(d);
      } else if (s.kind === "inverse_set") {
        const { data: rs } = await (supabase
          .from("recipes" as any).select("id, title, inverse_celebrity") as any)
          .eq("inverse_session_id", s.target_id).limit(3);
        if (!cancelled) setTarget({ kind: "inverse_set", recipes: rs ?? [] });
      }
    })();
    return () => { cancelled = true; };
  }, [m.share_id]);

  const isRecipient = share?.recipient_user_id === meId;
  const status: string = share?.status ?? "pending";

  const respond = async (action: "accept" | "decline") => {
    if (!share?.id || busy) return;
    setBusy(true); setErr(null);
    try {
      const fn = action === "accept" ? "accept-share" : "decline-share";
      const { data, error } = await supabase.functions.invoke(fn, { body: { share_id: share.id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      // Optimistic
      setShare((s: any) => ({ ...s, status: action === "accept" ? "accepted" : "declined" }));
      onChange();
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const title =
    !share ? "Loading share…" :
    share.kind === "recipe" ? (target?.title ?? "Recipe") :
    share.kind === "duel" ? `${target?.chef_a ?? "Chef"} vs ${target?.chef_b ?? "Chef"}` :
    share.kind === "inverse_set" ? `${target?.recipes?.[0]?.inverse_celebrity ?? "Inverse"} menu` :
    "Share";
  const kindLabel =
    share?.kind === "recipe" ? "recipe" :
    share?.kind === "duel" ? "duel" :
    share?.kind === "inverse_set" ? "inverse menu" : "item";
  const senderLabel = senderName ?? "Someone";

  const openHref =
    share?.kind === "recipe" ? `/recipes/${share.target_id}` :
    share?.kind === "duel" ? `/duel/${share.target_id}` :
    share?.kind === "inverse_set" ? `/inverse` : null;

  return (
    <div style={{
      alignSelf: "stretch",
      background: "var(--surface-elev)", color: "var(--fg)",
      border: "1px solid color-mix(in oklab, var(--saffron) 50%, transparent)",
      borderRadius: 14, padding: 14,
      fontFamily: "var(--font-body)", fontSize: 13,
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
        textTransform: "uppercase", color: "var(--fg-muted)",
      }}>
        {senderLabel} shared a {kindLabel}
      </div>
      <div style={{
        marginTop: 6,
        fontFamily: "var(--font-display)", fontStyle: "italic",
        fontSize: 18, color: "var(--fg)", lineHeight: 1.2,
      }}>
        {title}
      </div>
      {m.body && (
        <div style={{
          marginTop: 8, fontStyle: "italic", color: "var(--fg-muted)",
        }}>"{m.body}"</div>
      )}
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {isRecipient && status === "pending" && (
          <>
            <button
              type="button"
              onClick={() => respond("accept")}
              disabled={busy}
              style={miniPrimary}
            >Accept</button>
            <button
              type="button"
              onClick={() => respond("decline")}
              disabled={busy}
              style={miniGhost}
            >Decline</button>
          </>
        )}
        {status === "accepted" && (
          <>
            <span style={{ color: "var(--saffron)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              ✓ Accepted
            </span>
            {openHref && (
              <Link to={openHref as any} style={miniLink}>Open ↗</Link>
            )}
          </>
        )}
        {status === "declined" && (
          <span style={{ color: "var(--fg-muted)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            ✗ Declined
          </span>
        )}
        {err && <span style={{ color: "var(--saffron)", fontSize: 11 }}>{err}</span>}
      </div>
    </div>
  );
}

const miniPrimary: React.CSSProperties = {
  background: "var(--saffron)", color: "#000", border: 0,
  padding: "6px 14px", borderRadius: 9999,
  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em",
  textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
};
const miniGhost: React.CSSProperties = {
  background: "transparent", color: "var(--fg-muted)",
  border: "1px solid var(--hairline)",
  padding: "6px 14px", borderRadius: 9999,
  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em",
  textTransform: "uppercase", cursor: "pointer",
};
const miniLink: React.CSSProperties = {
  color: "var(--saffron)", textDecoration: "none",
  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em",
  textTransform: "uppercase",
};

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
