import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth-context";

type ShareKind = "recipe" | "inverse_set" | "duel";

type Props = {
  open: boolean;
  onClose: () => void;
  kind: ShareKind;
  targetId: string;
  /** Friendly label of the thing being shared, for the dialog header */
  targetLabel?: string;
};

type ProfileRow = { id: string; display_name: string | null };

export function ShareDialog({ open, onClose, kind, targetId, targetLabel }: Props) {
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [picked, setPicked] = useState<ProfileRow | null>(null);
  const [emailFallback, setEmailFallback] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery(""); setResults([]); setPicked(null); setEmailFallback("");
      setMessage(""); setErr(null); setDone(false); setSending(false);
    }
  }, [open]);

  // Search profiles via ilike as the user types
  useEffect(() => {
    if (!open || picked) return;
    const q = query.trim();
    const uid = session?.user?.id;
    let cancelled = false;
    (async () => {
      let req = supabase
        .from("profiles")
        .select("id, display_name")
        .order("display_name", { ascending: true })
        .limit(10);
      if (q) req = req.ilike("display_name", `%${q}%`);
      if (uid) req = req.neq("id", uid);
      console.log("[ShareDialog] querying public.profiles", { query: q, excludeUid: uid });
      const { data, error } = await req;
      console.log("[ShareDialog] profiles response", { data, error });
      if (cancelled) return;
      setResults((data ?? []) as ProfileRow[]);
    })();
    return () => { cancelled = true; };
  }, [query, open, picked, session?.user?.id]);

  if (!open) return null;

  const send = async () => {
    setErr(null);
    if (!picked && !emailFallback.trim()) {
      setErr("Pick a person or enter an email address.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-share", {
        body: {
          kind,
          target_id: targetId,
          recipient_user_id: picked?.id ?? undefined,
          recipient_email: picked ? undefined : emailFallback.trim() || undefined,
          message: message.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDone(true);
      setTimeout(() => onClose(), 1100);
    } catch (e: any) {
      setErr(e?.message ?? "Could not send share.");
    } finally {
      setSending(false);
    }
  };

  const labelKind =
    kind === "recipe" ? "recipe" :
    kind === "inverse_set" ? "inverse menu" : "duel";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460,
          background: "var(--bg)", color: "var(--fg)",
          border: "1px solid var(--hairline)", borderRadius: 12,
          padding: 24,
          fontFamily: "var(--font-body)",
        }}
      >
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "var(--fg-muted)",
        }}>
          Share {labelKind}
        </div>
        {targetLabel && (
          <div style={{
            marginTop: 8,
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 22, lineHeight: 1.2, color: "var(--fg)",
          }}>
            {targetLabel}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <label style={fieldLabel}>Send to</label>
          {picked ? (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", border: "1px solid var(--saffron)", borderRadius: 6,
              marginTop: 6,
            }}>
              <span>{picked.display_name ?? "Unnamed cook"}</span>
              <button
                onClick={() => setPicked(null)}
                style={chipBtn}
                type="button"
              >Change</button>
            </div>
          ) : (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by display name…"
                style={inputStyle}
                autoFocus
              />
              <div style={{
                marginTop: 6,
                border: "1px solid var(--hairline)", borderRadius: 6,
                maxHeight: 220, overflowY: "auto",
              }}>
                {results.length === 0 ? (
                  <div style={{
                    padding: "12px",
                    fontFamily: "var(--font-mono)", fontSize: 11,
                    color: "var(--fg-muted)",
                  }}>
                    No cooks match "{query}".
                  </div>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setPicked(r); setQuery(""); }}
                      style={{
                        width: "100%", textAlign: "left",
                        padding: "10px 12px", background: "transparent", color: "var(--fg)",
                        border: 0, borderBottom: "1px solid var(--hairline)", cursor: "pointer",
                      }}
                    >
                      {r.display_name ?? "Unnamed cook"}
                    </button>
                  ))
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={fieldLabel}>…or invite by email</label>
                <input
                  type="email"
                  value={emailFallback}
                  onChange={(e) => setEmailFallback(e.target.value)}
                  placeholder="friend@example.com"
                  style={inputStyle}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <label style={fieldLabel}>Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="You have to try this…"
            rows={3}
            style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
          />
        </div>

        {err && (
          <div style={{
            marginTop: 14, color: "var(--saffron)",
            fontFamily: "var(--font-mono)", fontSize: 12,
          }}>{err}</div>
        )}
        {done && (
          <div style={{
            marginTop: 14, color: "var(--saffron)",
            fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}>Sent ✓</div>
        )}

        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onClose} type="button" style={ghostBtn}>Cancel</button>
          <button
            onClick={send}
            type="button"
            disabled={sending || done}
            style={primaryBtn(sending || done)}
          >
            {sending ? "Sending…" : done ? "Sent" : "Send share"}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "transparent", color: "var(--fg)",
  border: "1px solid var(--hairline)", borderRadius: 6,
  padding: "10px 12px", fontFamily: "var(--font-body)", fontSize: 15,
  outline: "none",
};
const ghostBtn: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--fg-muted)",
  background: "transparent", border: "1px solid var(--hairline)",
  padding: "10px 18px", borderRadius: 9999, cursor: "pointer",
};
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
  textTransform: "uppercase", color: "var(--saffron)",
  background: "transparent", border: "1px solid var(--saffron)",
  padding: "10px 18px", borderRadius: 9999,
  cursor: disabled ? "wait" : "pointer", opacity: disabled ? 0.6 : 1,
});
const chipBtn: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em",
  textTransform: "uppercase", color: "var(--fg-muted)",
  background: "transparent", border: 0, cursor: "pointer",
};
