import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { lovable } from "@/integrations/lovable";
import {
  page,
  container,
  eyebrow,
  title,
  subtitle,
  Field,
  inputStyle,
  ctaStyle,
  ArrowUpRight,
  hairline,
} from "@/components/auth-ui";

export const Route = createFileRoute("/sign-in")({
  head: () => ({ meta: [{ title: "Return — Culinario" }] }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", data.user.id)
        .maybeSingle();
      navigate({ to: prof?.onboarding_complete ? "/today" : "/onboarding" });
    }
  };

  const onGoogle = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/today` },
    });
    if (err) setError(err.message ?? "Google sign-in failed");
  };

  return (
    <div style={page}>
      <main style={container}>
        <div style={eyebrow}>№ 003 — RETURN</div>
        <h1 style={title}>Welcome back.</h1>
        <p style={subtitle}>The kitchen has been waiting.</p>
        <div style={{ height: 56 }} />

        <form onSubmit={onSubmit}>
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              className="culinario-input"
              autoComplete="email"
            />
          </Field>
          <Field label="Password" error={error}>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              className="culinario-input"
              autoComplete="current-password"
            />
          </Field>
          <button type="submit" disabled={loading} style={ctaStyle} className="culinario-cta">
            {loading ? "Returning…" : "Return"} <ArrowUpRight />
          </button>
        </form>

        <div style={{ marginTop: 48 }}>
          <Link
            to="/sign-up"
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: 16,
              color: "var(--fg-muted)",
              textDecoration: "none",
            }}
          >
            New here? Begin a diary.
          </Link>
        </div>
      </main>
    </div>
  );
}