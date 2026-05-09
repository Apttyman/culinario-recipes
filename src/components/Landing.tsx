import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-client";

export function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !session?.user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", session.user.id)
        .maybeSingle();
      navigate({ to: prof?.onboarding_complete ? "/today" : "/onboarding" });
    })();
  }, [session, loading, navigate]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)" }}>
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
          }}
        >
          <a
            href="/"
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
          </a>
          <nav className="culinario-header-nav" style={{ display: "flex", gap: 28 }}>
            {[
              { label: "Today", to: "/today", current: true },
              { label: "Cookbook", to: "/cookbook", current: false },
              { label: "Profile", to: "/portrait", current: false },
            ].map((item) => (
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
                  borderBottom: item.current
                    ? "1px solid var(--saffron)"
                    : "1px solid transparent",
                }}
                className="culinario-nav-link"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main
        className="culinario-page"
        style={{
          paddingTop: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "var(--fg-low)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          № 001 — A Cooking Diary
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 300,
            fontStyle: "italic",
            fontSize: "clamp(56px, 8vw, 96px)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "var(--fg)",
            margin: "32px 0 0",
          }}
          className="culinario-title"
        >
          What's in the fridge.
        </h1>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 400,
            fontSize: 18,
            lineHeight: 1.5,
            color: "var(--fg-muted)",
            maxWidth: 520,
            margin: "32px 0 0",
          }}
        >
          A quiet practice of paying attention to what you cook, who you cook for,
          and how it turns out. Begin by photographing your fridge.
        </p>

        <hr
          style={{
            width: 64,
            height: 1,
            border: 0,
            background: "var(--hairline)",
            margin: "48px 0 0",
          }}
        />

        <div
          className="culinario-meta"
          style={{
            marginTop: 48,
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
          }}
        >
          {[
            { label: "Method", value: "Photograph, Identify, Cook" },
            { label: "Memory", value: "Stored, Rated, Recalled" },
            { label: "Voice", value: "Chosen at onboarding" },
          ].map((col, i) => (
            <div
              key={col.label}
              className="culinario-meta-col"
              style={{
                padding: "0 20px",
                borderLeft: i === 0 ? "none" : "1px solid var(--hairline)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  color: "var(--fg-low)",
                }}
              >
                {col.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: 24,
                  color: "var(--fg)",
                  marginTop: 12,
                  lineHeight: 1.25,
                }}
              >
                {col.value}
              </div>
            </div>
          ))}
        </div>

        <hr
          style={{
            width: "100%",
            height: 1,
            border: 0,
            background: "var(--hairline)",
            margin: "64px 0 0",
          }}
        />

        <Link
          to="/sign-up"
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "var(--saffron)",
            textDecoration: "none",
            marginTop: 48,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
          className="culinario-cta"
        >
          Begin
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="2" y1="10" x2="10" y2="2" />
            <polyline points="4,2 10,2 10,8" />
          </svg>
        </Link>

        <div
          style={{
            marginTop: 96,
            marginBottom: 48,
            fontFamily: "var(--font-mono)",
            fontWeight: 400,
            fontSize: 10,
            color: "var(--fg-low)",
            letterSpacing: "0.05em",
          }}
        >
          CULINARIO
          <span style={{ margin: "0 0.5em" }}>·</span>
          EST 2026
          <span style={{ margin: "0 0.5em" }}>·</span>
          A COOKING DIARY
        </div>
      </main>
    </div>
  );
}
