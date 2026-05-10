import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { label: "Today", to: "/today" },
  { label: "Cookbook", to: "/cookbook" },
  { label: "Inverse", to: "/inverse" },
  { label: "Duels", to: "/duels" },
  { label: "Profile", to: "/portrait" },
] as const;

export function AppHeader({ current }: { current?: "Today" | "Cookbook" | "Profile" | "Inverse" | "Duels" }) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const email = session?.user?.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    navigate({ to: "/" });
  };

  return (
    <header
      style={{
        height: 64,
        width: "100%",
        background: "transparent",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div
        className="culinario-header-inner"
        style={{
          maxWidth: 720,
          height: "100%",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <Link
          to="/today"
          className="culinario-wordmark"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "0.2em",
            color: "var(--fg)",
            textDecoration: "none",
            fontFeatureSettings: '"smcp"',
          }}
        >
          Culinario
        </Link>
        <nav className="culinario-header-nav" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 500,
                fontSize: 12,
                letterSpacing: "0.15em",
                color: "var(--fg-muted)",
                textDecoration: "none",
                fontFeatureSettings: '"smcp"',
                paddingBottom: 4,
                borderBottom:
                  current === item.label
                    ? "1px solid var(--saffron)"
                    : "1px solid transparent",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {session && (
          <div ref={wrapRef} style={{ position: "relative" }}>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="Account"
              className="culinario-avatar-tap"
              style={{
                color: "var(--fg)",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--surface-elev)",
                  border: "1px solid var(--hairline)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-display)",
                  fontStyle: "italic",
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                {initial}
              </span>
            </button>
            {open && (
              <div
                className="culinario-avatar-menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  minWidth: 220,
                  background: "var(--surface-elev)",
                  border: "1px solid var(--hairline)",
                  zIndex: 50,
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "var(--fg-muted)",
                    borderBottom: "1px solid var(--hairline)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {email}
                </div>
                <Link
                  to="/settings"
                  onClick={() => setOpen(false)}
                  className="culinario-signout"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: 0,
                    padding: "12px 14px",
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--fg)",
                    textDecoration: "none",
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="culinario-signout"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: 0,
                    padding: "12px 14px",
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--fg)",
                    cursor: "pointer",
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
