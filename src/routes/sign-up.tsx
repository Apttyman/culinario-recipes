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

export const Route = createFileRoute("/sign-up")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Begin — Culinario" }] }),
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const emailRedirect = redirect ? `${window.location.origin}${redirect}` : `${window.location.origin}/onboarding`;
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: emailRedirect },
    });
    // If signup fails OR returns no session (email confirm / already exists),
    // try signing in with the same credentials.
    if (err || !data.session) {
      const { data: signInData, error: signInErr } =
        await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (signInErr || !signInData.session) {
        setError(err?.message || signInErr?.message || "Could not sign in");
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", signInData.user.id)
        .maybeSingle();
      // Brand new accounts go through onboarding first even if a redirect is set.
      const destination = redirect && prof?.onboarding_complete
        ? redirect
        : (prof?.onboarding_complete ? "/today" : "/onboarding");
      navigate({ to: destination });
      return;
    }
    setLoading(false);
    navigate({ to: "/onboarding" });
  };

  const onGoogle = async () => {
    setError(null);
    const oauthRedirect = redirect ? `${window.location.origin}${redirect}` : `${window.location.origin}/onboarding`;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: oauthRedirect },
    });
    if (err) setError(err.message ?? "Google sign-in failed");
  };

  return (
    <div style={page}>
      <main style={container}>
        <div style={eyebrow}>№ 002 — BEGIN</div>
        <h1 style={title}>Begin a cooking diary.</h1>
        <p style={subtitle}>
          Email and a password. The kitchen voice will get to know you next.
        </p>
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              className="culinario-input"
              autoComplete="new-password"
            />
          </Field>

          <button type="submit" disabled={loading} style={ctaStyle} className="culinario-cta">
            {loading ? "Beginning…" : "Begin"} <ArrowUpRight />
          </button>
        </form>

        <div style={{ marginTop: 48 }}>
          <Link
            to="/sign-in"
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: 16,
              color: "var(--fg-muted)",
              textDecoration: "none",
            }}
          >
            Already have an account? Return.
          </Link>
        </div>
      </main>
    </div>
  );
}