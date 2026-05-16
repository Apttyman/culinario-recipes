import { Link } from "@tanstack/react-router";

type Variant = "footer" | "inline";

export function SatireDisclaimer({ variant = "footer" }: { variant?: Variant }) {
  const base: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--fg-low)",
    lineHeight: 1.6,
  };
  const footer: React.CSSProperties = {
    ...base,
    margin: "48px 0 32px",
    padding: "20px 0 0",
    borderTop: "1px solid var(--hairline)",
    textAlign: "center",
    maxWidth: 560,
    marginLeft: "auto",
    marginRight: "auto",
  };
  const inline: React.CSSProperties = {
    ...base,
    margin: "16px 0 0",
    padding: 0,
    textAlign: "left",
  };

  return (
    <p style={variant === "footer" ? footer : inline}>
      AI-generated parody for entertainment. Not affiliated with, sponsored by,
      or endorsed by any depicted figure. {" "}
      <Link
        to="/takedown"
        style={{
          color: "var(--saffron)",
          textDecoration: "none",
          borderBottom: "1px solid color-mix(in oklab, var(--saffron) 40%, transparent)",
        }}
      >
        Report content
      </Link>
      .
    </p>
  );
}
