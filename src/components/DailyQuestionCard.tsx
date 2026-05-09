import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { insertSignal } from "@/lib/preference-signals";

type Question = {
  id: string;
  axis: string;
  question: string;
  option_a_label: string;
  option_b_label: string;
  option_a_signal: string;
  option_b_signal: string;
};

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--fg-muted)",
};

export function DailyQuestionCard({ userId }: { userId: string }) {
  const [skipped, setSkipped] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answering, setAnswering] = useState(false);
  const [fading, setFading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Hide if user answered a question in the last 12 hours
      const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const { count } = await (supabase.from("preference_signals" as any) as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("source", "question")
        .gte("created_at", since);
      if (cancelled) return;
      if ((count ?? 0) > 0) {
        setHidden(true);
        return;
      }

      // Fetch all answered question_ids
      const { data: answered } = await (supabase.from("preference_signals" as any) as any)
        .select("metadata")
        .eq("user_id", userId)
        .eq("source", "question");
      const answeredIds = new Set<string>(
        (answered ?? []).map((r: any) => r.metadata?.question_id).filter(Boolean),
      );

      // Pull a batch and pick one not yet answered
      const { data: pool } = await (supabase.from("preference_questions" as any) as any)
        .select("id, axis, question, option_a_label, option_b_label, option_a_signal, option_b_signal")
        .limit(250);
      if (cancelled) return;
      const candidates = (pool ?? []).filter((q: any) => !answeredIds.has(q.id));
      const source = candidates.length ? candidates : (pool ?? []);
      if (!source.length) {
        setHidden(true);
        return;
      }
      const pick = source[Math.floor(Math.random() * source.length)];
      setQuestion(pick as Question);
      setHidden(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (skipped || hidden || !question) return null;

  const choose = async (which: "a" | "b") => {
    if (answering) return;
    setAnswering(true);
    setError(null);
    const { error: e } = await insertSignal({
      user_id: userId,
      source: "question",
      axis: question.axis,
      signal_text: which === "a" ? question.option_a_signal : question.option_b_signal,
      signal_weight: 1.0,
      metadata: { question_id: question.id, choice: which },
    });
    if (e) {
      setError("Couldn't save. Try again.");
      setAnswering(false);
      return;
    }
    setFading(true);
    setTimeout(() => setSkipped(true), 350);
  };

  const optionRow = (text: string, onClick: () => void, isLast: boolean) => (
    <button
      type="button"
      onClick={onClick}
      disabled={answering}
      className="culinario-question-option"
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: 0,
        borderBottom: isLast ? 0 : "1px solid var(--hairline)",
        padding: "14px 0",
        minHeight: 44,
        cursor: answering ? "default" : "pointer",
        fontFamily: "var(--font-display)",
        fontStyle: "italic",
        fontWeight: 400,
        fontSize: 20,
        color: fading ? "var(--fg-low)" : "var(--fg)",
        transition: "color 250ms ease",
      }}
    >
      {text}
    </button>
  );

  return (
    <div style={{ marginTop: 48, marginBottom: 48, opacity: fading ? 0.5 : 1, transition: "opacity 300ms ease" }}>
      <hr style={{ border: 0, height: 1, background: "var(--hairline)", margin: 0 }} />
      <div style={{ padding: "32px 0" }}>
        <div style={labelStyle}>№ 003 — A quick taste check</div>
        <h2
          style={{
            margin: "16px 0 24px",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 300,
            fontSize: "clamp(22px, 3vw, 30px)",
            lineHeight: 1.3,
            color: fading ? "var(--fg-low)" : "var(--fg)",
            transition: "color 250ms ease",
          }}
        >
          {question.question}
        </h2>
        <div>
          {optionRow(question.option_a_label, () => choose("a"), false)}
          {optionRow(question.option_b_label, () => choose("b"), true)}
        </div>
        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className="culinario-question-skip"
            style={{
              ...labelStyle,
              color: "var(--fg-low)",
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
            }}
          >
            Skip for now
          </button>
          {error && <span style={{ ...labelStyle, color: "var(--fg-muted)" }}>{error}</span>}
        </div>
      </div>
      <hr style={{ border: 0, height: 1, background: "var(--hairline)", margin: 0 }} />
      <style>{`
        .culinario-question-option:hover:not(:disabled) { color: var(--saffron) !important; }
        .culinario-question-option:focus-visible { color: var(--saffron) !important; outline: none; }
        .culinario-question-skip:hover { color: var(--fg-muted) !important; }
      `}</style>
    </div>
  );
}