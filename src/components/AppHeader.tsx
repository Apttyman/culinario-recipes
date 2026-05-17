import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { label: "Today", to: "/today" },
  { label: "Cookbook", to: "/cookbook" },
  { label: "Inverse", to: "/inverse" },
  { label: "Duels", to: "/duels" },
  { label: "Last Meal", to: "/last-meal" },
  { label: "Converse", to: "/converse" },
  { label: "Profile", to: "/portrait" },
] as const;

type CurrentNav = "Today" | "Cookbook" | "Profile" | "Inverse" | "Duels" | "Last Meal" | "Converse";

export function AppHeader({ current }: { current?: CurrentNav }) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const [acctOpen, setAcctOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const acctRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  // Close account dropdown on outside click
  useEffect(() => {
    if (!acctOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [acctOpen]);

  // Close mobile nav on outside click. We must check BOTH the toggle button
  // AND the dropdown panel, because they're separate elements in the DOM
  // tree. If we only checked the toggle, tapping a Link inside the panel
  // would fire setMobileOpen(false) on mousedown, the panel would re-render
  // away, and the Link's click never fires → no navigation. That's the bug
  // the avatar dropdown doesn't have (its ref wraps both button + menu).
  useEffect(() => {
    if (!mobileOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      const inToggle = mobileToggleRef.current?.contains(t);
      const inPanel = mobilePanelRef.current?.contains(t);
      if (!inToggle && !inPanel) setMobileOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [mobileOpen]);

  // Close mobile nav on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const email = session?.user?.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    setAcctOpen(false);
    setMobileOpen(false);
    navigate({ to: "/" });
  };

  return (
    <header
      style={{
        position: "relative",
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
          gap: 16,
        }}
      >
        {/* Mobile hamburger — sits to the LEFT of the wordmark on small screens */}
        <button
          ref={mobileToggleRef}
          type="button"
          className="culinario-mobile-toggle"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((o) => !o)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {mobileOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

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

        {/* Desktop horizontal nav — hidden on small screens */}
        <nav className="culinario-header-nav" style={{ display: "flex", gap: 22, alignItems: "center" }}>
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
                whiteSpace: "nowrap",
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
          <div ref={acctRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setAcctOpen((o) => !o)}
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
            {acctOpen && (
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
                  onClick={() => setAcctOpen(false)}
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

      {/* Mobile dropdown panel — full-width, anchored to header bottom */}
      {mobileOpen && (
        <div
          ref={mobilePanelRef}
          className="culinario-mobile-panel"
          role="menu"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--bg)",
            borderBottom: "1px solid var(--hairline)",
            boxShadow: "0 16px 32px -16px rgba(0,0,0,0.5)",
            zIndex: 40,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", padding: "8px 0" }}>
            {NAV.map((item) => {
              const isCurrent = current === item.label;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  role="menuitem"
                  style={{
                    display: "block",
                    padding: "14px 24px",
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic",
                    fontWeight: 400,
                    fontSize: 18,
                    color: isCurrent ? "var(--saffron)" : "var(--fg)",
                    textDecoration: "none",
                    borderLeft: isCurrent
                      ? "3px solid var(--saffron)"
                      : "3px solid transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        /* Default: desktop layout (nav visible, hamburger hidden) */
        .culinario-mobile-toggle {
          display: none;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          padding: 0;
          margin-left: -8px;
          background: transparent;
          border: 0;
          color: var(--fg);
          cursor: pointer;
          border-radius: 8px;
        }
        .culinario-mobile-toggle:hover { background: color-mix(in oklab, var(--saffron) 10%, transparent); }

        /* Mobile breakpoint — desktop nav exceeds available width once we hit
           seven items on most phones. Hide it and reveal the hamburger. */
        @media (max-width: 760px) {
          .culinario-header-nav { display: none !important; }
          .culinario-mobile-toggle { display: inline-flex; }
          .culinario-header-inner {
            justify-content: flex-start !important;
            gap: 12px !important;
          }
          /* Wordmark scoots over a bit on mobile so the hamburger sits left of it,
             then avatar gets pushed to the right via margin-left:auto. */
          .culinario-wordmark { margin-right: auto; }
        }
      `}</style>
    </header>
  );
}
