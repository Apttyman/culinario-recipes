import { Link } from "@tanstack/react-router";

/**
 * Shared layout for /terms, /privacy, /takedown. Matches the editorial
 * typography of the rest of the product. The legal text itself is templated
 * and MUST be reviewed by counsel before any paid launch.
 */
export function LegalPage({
  eyebrow,
  title,
  lastUpdated,
  children,
}: {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
      <main className="culinario-page" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "var(--fg-muted)",
        }}>
          {eyebrow}
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 300, fontStyle: "italic",
          fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.05,
          letterSpacing: "-0.02em", margin: "16px 0 12px", color: "var(--fg)",
        }}>{title}</h1>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em",
          textTransform: "uppercase", color: "var(--fg-low)",
        }}>
          Last updated · {lastUpdated}
        </div>
        <hr style={{ border: 0, height: 1, background: "var(--hairline)", margin: "32px 0" }} />
        <article style={{
          fontFamily: "var(--font-body)", fontSize: 16, lineHeight: 1.65,
          color: "var(--fg)", maxWidth: 680,
        }}>
          {children}
        </article>
        <hr style={{ border: 0, height: 1, background: "var(--hairline)", margin: "48px 0 24px" }} />
        <Link
          to="/"
          style={{
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "var(--saffron)", textDecoration: "none",
          }}
        >
          ← Culinario
        </Link>
      </main>
    </div>
  );
}

// Standard typographic primitives for legal body copy.
export const legalH2: React.CSSProperties = {
  fontFamily: "var(--font-display)", fontWeight: 500, fontVariantCaps: "small-caps",
  textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 16,
  color: "var(--fg)", margin: "40px 0 16px",
};
export const legalP: React.CSSProperties = { margin: "0 0 16px" };
export const legalUl: React.CSSProperties = { margin: "0 0 16px 1.4em", padding: 0 };
export const legalLi: React.CSSProperties = { margin: "0 0 8px" };
