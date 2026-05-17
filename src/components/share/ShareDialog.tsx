import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth-context";

type ShareKind = "recipe" | "inverse_set" | "duel" | "last_meal";

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

  const [linkCopied, setLinkCopied] = useState(false);
  const [linkShared, setLinkShared] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageShared, setImageShared] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Compute the direct permalink + OG image URL for this share target.
  // Duel + Last Meal have public viewers (anon-readable by uuid) so the
  // direct URL works for anyone. Recipe permalinks require sign-in but the
  // copy-link is still useful for sending to other Culinario users.
  // Inverse sets don't have a clean per-session viewer URL yet.
  const SUPA_FN_BASE = "https://upofudganvjbdhxxpfti.supabase.co/functions/v1";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://culinario-recipes.lovable.app";
  let permalink: string | null = null;
  let ogImageUrl: string | null = null;
  let ogFileName: string | null = null;
  if (kind === "duel") {
    permalink = `${origin}/duel/${targetId}`;
    ogImageUrl = `${SUPA_FN_BASE}/duel-og?id=${targetId}`;
    ogFileName = `culinario-duel-${(targetLabel ?? "duel").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "duel"}.png`;
  } else if (kind === "last_meal") {
    permalink = `${origin}/last-meal/${targetId}`;
    ogImageUrl = `${SUPA_FN_BASE}/last-meal-og?id=${targetId}`;
    ogFileName = `culinario-last-meal-${(targetLabel ?? "last-meal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "last-meal"}.png`;
  } else if (kind === "recipe") {
    permalink = `${origin}/recipes/${targetId}`;
    // Recipes don't have an OG generator (their own image is on the recipe row,
    // not derived from a Supabase edge function).
  }
  // kind === "inverse_set": no clean per-session URL yet; copy link disabled.

  // Lock body scroll while the dialog is open. Without this, iOS Safari
  // can scroll the underlying page when the keyboard is dismissed, leaving
  // the modal misaligned over a different element.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Reset transient feedback when dialog closes/reopens
  useEffect(() => {
    if (!open) {
      setLinkCopied(false);
      setLinkShared(false);
      setImageBusy(false);
      setImageShared(false);
      setImageError(null);
    }
  }, [open]);

  // Share the link. On mobile (and any device that exposes Web Share API)
  // we trigger the native share sheet — that's the right primitive for
  // "text this to someone" because the user picks Messages / Mail / WhatsApp /
  // AirDrop from the OS. On desktop we fall back to the clipboard.
  const shareLink = async () => {
    if (!permalink) return;
    const hasWebShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
    if (hasWebShare) {
      try {
        await navigator.share({
          title: targetLabel ?? "From Culinario",
          text: targetLabel ?? undefined,
          url: permalink,
        });
        setLinkShared(true);
        setTimeout(() => setLinkShared(false), 1800);
        return;
      } catch (err: any) {
        // User dismissed the share sheet — not an error, no feedback needed.
        if (err?.name === "AbortError") return;
        // Anything else: fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(permalink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      window.prompt("Copy this link:", permalink);
    }
  };

  // Save (or share) the OG image. On mobile we prefer the share sheet with
  // the PNG as a file — that lets users hit "Save to Photos", "Messages",
  // "Mail", etc. natively. The <a download> attribute is unreliable on iOS
  // Safari (it ignores it and displays the PNG inline) so we never rely on
  // it. On desktop we fetch the blob and trigger a download via createObjectURL
  // so we don't depend on cross-origin Content-Disposition headers.
  const saveImage = async () => {
    if (!ogImageUrl || imageBusy) return;
    setImageBusy(true);
    setImageError(null);
    try {
      const resp = await fetch(ogImageUrl, { cache: "no-store" });
      if (!resp.ok) throw new Error(`Image not available (${resp.status})`);
      const blob = await resp.blob();
      const fileName = ogFileName ?? "culinario.png";

      // Try the share sheet with files first (best mobile UX)
      const hasShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function";
      if (hasShareFiles) {
        try {
          const file = new File([blob], fileName, { type: blob.type || "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: targetLabel ?? "From Culinario",
              files: [file],
            });
            setImageShared(true);
            setTimeout(() => setImageShared(false), 1800);
            return;
          }
        } catch (err: any) {
          if (err?.name === "AbortError") return;
          // fall through to download
        }
      }

      // Desktop / unsupported mobile: trigger a download via object URL
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err: any) {
      // Last-ditch: open in new tab so the user can long-press / right-click → save
      try { window.open(ogImageUrl, "_blank"); } catch {/* ignore */}
      setImageError(err?.message ?? "Couldn't fetch the image. Opened it in a new tab.");
      setTimeout(() => setImageError(null), 4000);
    } finally {
      setImageBusy(false);
    }
  };

  // Detect Web Share API once so the button label matches the actual behavior.
  const [hasWebShare, setHasWebShare] = useState(false);
  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setHasWebShare(true);
    }
  }, []);

  // Close on Escape so keyboard users + desktop don't get stuck.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
    kind === "inverse_set" ? "inverse menu" :
    kind === "duel" ? "duel" : "last meal";

  // Render via portal to document.body so the modal escapes any parent
  // stacking context (e.g. fixed-positioned acts in /duel/$id) and any
  // ancestor with touch-action constraints. This is what was breaking
  // mobile interaction on some pages — clicks on the dialog were being
  // swallowed by a parent layer's event handler.
  if (typeof document === "undefined") return null;

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        // Make sure the modal owns its own scroll if the keyboard pushes
        // content out of the viewport on mobile.
        overflowY: "auto",
        // Don't let touch gestures fall through to anything underneath.
        touchAction: "manipulation",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460,
          background: "var(--bg)", color: "var(--fg)",
          border: "1px solid var(--hairline)", borderRadius: 12,
          padding: 20,
          fontFamily: "var(--font-body)",
          // Cap height so the inner content can scroll independently when
          // the iOS keyboard takes over half the viewport.
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          // Belt-and-suspenders: ensure pointer events always reach the
          // modal even if a parent disabled them.
          pointerEvents: "auto",
          WebkitOverflowScrolling: "touch",
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

        {/* Quick actions — copy link + save image (when available). These
            sit at the top because they're the fastest path for "text it
            to someone" or "post the image" and don't require entering
            a recipient. */}
        {(permalink || ogImageUrl) && (
          <div style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: permalink && ogImageUrl ? "1fr 1fr" : "1fr",
            gap: 8,
          }}>
            {permalink && (
              <button
                type="button"
                onClick={shareLink}
                style={quickActionBtn(linkCopied || linkShared)}
                aria-label={hasWebShare ? "Share link" : "Copy link"}
              >
                {linkShared ? "Shared ✓"
                  : linkCopied ? "Copied ✓"
                  : hasWebShare ? "Share link ↗" : "Copy link"}
              </button>
            )}
            {ogImageUrl && (
              <button
                type="button"
                onClick={saveImage}
                disabled={imageBusy}
                style={{
                  ...quickActionBtn(imageShared),
                  ...(imageBusy ? { opacity: 0.6, cursor: "wait" } : {}),
                }}
                aria-label={hasWebShare ? "Share image" : "Save image"}
              >
                {imageBusy ? "Fetching…"
                  : imageShared ? "Shared ✓"
                  : hasWebShare ? "Share image ↗" : "Save image ↓"}
              </button>
            )}
          </div>
        )}
        {imageError && (
          <div style={{
            marginTop: 10,
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
            textTransform: "uppercase", color: "var(--saffron)",
          }}>
            {imageError}
          </div>
        )}
        {permalink && (
          <div style={{
            marginTop: 10,
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
            textTransform: "uppercase", color: "var(--fg-low)",
            wordBreak: "break-all",
            userSelect: "all",
            WebkitUserSelect: "all",
          }}>
            {permalink.replace(/^https?:\/\//, "")}
          </div>
        )}

        {(permalink || ogImageUrl) && (
          <hr style={{ border: 0, height: 1, background: "var(--hairline)", margin: "20px 0 0" }} />
        )}

        <div style={{ marginTop: 20 }}>
          <label style={fieldLabel}>Or send to</label>
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

  return createPortal(dialog, document.body);
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
// Used by both <button> and <a> at the top of the dialog (copy link / save image).
// `active` flips the visual feedback ("Copied ✓" gets a saffron-tinted state).
const quickActionBtn = (active: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8,
  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: active ? "var(--fg)" : "var(--saffron)",
  background: active ? "color-mix(in oklab, var(--saffron) 18%, transparent)" : "transparent",
  border: "1px solid var(--saffron)",
  padding: "10px 16px", borderRadius: 9999,
  cursor: "pointer", textDecoration: "none",
  transition: "background 180ms ease, color 180ms ease",
});
