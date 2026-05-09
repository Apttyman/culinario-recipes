import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { triggerPortraitSynthesis } from "@/lib/portrait";

type Props = {
  open: boolean;
  observationText: string;
  appliedToField?: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function DiscussModal({ open, observationText, appliedToField, onClose, onSubmitted }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    const correction = text.trim();
    if (!correction) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("not signed in");
      await supabase.from("portrait_corrections").insert({
        user_id: uid,
        correction_text: correction,
        observation_text: observationText || null,
        applied_to_field: appliedToField || null,
      });
      triggerPortraitSynthesis();
      onSubmitted?.();
      onClose();
    } catch (e) {
      console.warn("discuss submit failed", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "color-mix(in oklab, var(--bg) 80%, transparent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 560, width: "100%",
          background: "var(--surface-elev)",
          border: "1px solid var(--hairline)",
          padding: 32,
        }}
      >
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
          fontSize: 32, color: "var(--fg)", lineHeight: 1.1,
        }}>
          Tell us what we got wrong.
        </div>
        {observationText && (
          <div style={{
            marginTop: 16, fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 18, color: "var(--fg-muted)",
          }}>
            {observationText}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Actually, I love anchovies — that one Caesar I rated low was just a bad recipe…"
          style={{
            marginTop: 24, width: "100%", background: "transparent",
            color: "var(--fg)", border: 0,
            borderBottom: "1px solid var(--hairline)",
            fontFamily: "var(--font-display)", fontStyle: "italic",
            fontSize: 18, padding: "12px 0", outline: "none", resize: "vertical",
          }}
        />
        <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={onClose}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
              textTransform: "uppercase", color: "var(--fg-low)",
              background: "transparent", border: 0, cursor: "pointer", padding: 0,
            }}
          >Cancel</button>
          <button
            onClick={submit}
            disabled={!text.trim() || busy}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: text.trim() && !busy ? "var(--saffron)" : "var(--fg-low)",
              background: "transparent", border: 0,
              cursor: text.trim() && !busy ? "pointer" : "not-allowed", padding: 0,
            }}
          >{busy ? "Sending…" : "Submit ↗"}</button>
        </div>
      </div>
    </div>
  );
}