import { useState } from "react";
import { ShareDialog } from "./ShareDialog";

type Props = {
  kind: "recipe" | "inverse_set" | "duel";
  targetId: string | null | undefined;
  label?: string;
  targetLabel?: string;
  variant?: "link" | "pill" | "ghost" | "icon";
  className?: string;
};

export function ShareButton({ kind, targetId, label, targetLabel, variant = "link", className }: Props) {
  const [open, setOpen] = useState(false);
  if (!targetId) return null;

  const baseLink: React.CSSProperties = {
    fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12,
    textTransform: "uppercase", letterSpacing: "0.2em",
    color: "var(--saffron)", background: "transparent",
    border: 0, cursor: "pointer", padding: "12px 0",
    display: "inline-flex", alignItems: "center", gap: 10,
  };
  const pill: React.CSSProperties = {
    ...baseLink,
    border: "1px solid var(--saffron)",
    padding: "10px 18px", borderRadius: 9999,
  };
  const ghost: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 10,
    textTransform: "uppercase", letterSpacing: "0.18em",
    color: "var(--fg-muted)", background: "transparent",
    border: 0, cursor: "pointer", padding: "6px 10px",
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 9999,
  };
  const icon: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 9999,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: "var(--fg-muted)", background: "transparent",
    border: 0, cursor: "pointer", padding: 0,
    transition: "background 180ms ease, color 180ms ease",
  };

  const style =
    variant === "pill" ? pill :
    variant === "ghost" ? ghost :
    variant === "icon" ? icon :
    baseLink;

  const isIcon = variant === "icon";
  const content = isIcon ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  ) : (label ?? "Share ↗");

  return (
    <>
      <button
        type="button"
        className={className ? `${className} share-btn-${variant}` : `share-btn-${variant}`}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={style}
        aria-label={isIcon ? "Share" : undefined}
        title={isIcon ? "Share" : undefined}
      >
        {content}
      </button>
      <style>{`
        .share-btn-icon:hover, .share-btn-ghost:hover {
          background: color-mix(in oklab, var(--saffron) 14%, transparent);
          color: var(--saffron);
        }
      `}</style>
      <ShareDialog
        open={open}
        onClose={() => setOpen(false)}
        kind={kind}
        targetId={targetId}
        targetLabel={targetLabel}
      />
    </>
  );
}

