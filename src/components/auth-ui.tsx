import type { CSSProperties, ReactNode } from "react";

export const page: CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--fg)",
};

export const container: CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "80px 24px 64px",
};

export const eyebrow: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.2em",
  color: "var(--fg-low)",
};

export const title: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 300,
  fontStyle: "italic",
  fontSize: "clamp(40px, 6vw, 72px)",
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  color: "var(--fg)",
  margin: "24px 0 0",
};

export const subtitle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 17,
  lineHeight: 1.5,
  color: "var(--fg-muted)",
  margin: "20px 0 0",
  maxWidth: 560,
};

export const labelStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.15em",
  color: "var(--fg-low)",
  display: "block",
  marginBottom: 8,
};

export const helperStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--fg-low)",
  marginTop: 6,
  letterSpacing: "0.05em",
};

export const errorStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontStyle: "italic",
  fontSize: 14,
  color: "var(--saffron)",
  marginTop: 8,
};

export const ctaStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.2em",
  color: "var(--saffron)",
  textDecoration: "none",
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
};

export function ArrowUpRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="2" y1="10" x2="10" y2="2" />
      <polyline points="4,2 10,2 10,8" />
    </svg>
  );
}

export function ArrowUpLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="10" y1="10" x2="2" y2="2" />
      <polyline points="8,2 2,2 2,8" />
    </svg>
  );
}

export function Field({
  label,
  children,
  helper,
  error,
}: {
  label: string;
  children: ReactNode;
  helper?: string;
  error?: string | null;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {helper && <div style={helperStyle}>{helper}</div>}
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: 0,
  borderBottom: "1px solid var(--hairline)",
  outline: "none",
  padding: "8px 0",
  fontFamily: "var(--font-display)",
  fontWeight: 500,
  fontSize: 24,
  color: "var(--fg)",
  borderRadius: 0,
};

export const hairline: CSSProperties = {
  border: 0,
  height: 1,
  background: "var(--hairline)",
  width: "100%",
  margin: "32px 0",
};