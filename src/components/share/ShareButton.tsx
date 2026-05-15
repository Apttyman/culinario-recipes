import { useState } from "react";
import { ShareDialog } from "./ShareDialog";

type Props = {
  kind: "recipe" | "inverse_set" | "duel";
  targetId: string | null | undefined;
  label?: string;
  targetLabel?: string;
  variant?: "link" | "pill";
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

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        style={variant === "pill" ? pill : baseLink}
      >
        {label ?? "Share ↗"}
      </button>
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
