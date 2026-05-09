import { supabase } from "@/lib/supabase-client";

export type SignalSource =
  | "onboarding"
  | "question"
  | "recipe_save"
  | "recipe_cook"
  | "recipe_rating";

export async function insertSignal(input: {
  user_id: string;
  source: SignalSource;
  axis?: string | null;
  signal_text: string;
  signal_weight?: number;
  metadata?: Record<string, any>;
}) {
  const { error } = await supabase.from("preference_signals" as any).insert({
    user_id: input.user_id,
    source: input.source,
    axis: input.axis ?? null,
    signal_text: input.signal_text,
    signal_weight: input.signal_weight ?? 1.0,
    metadata: input.metadata ?? {},
  });
  if (error) console.error("[preference_signals] insert failed", error);
  return { error };
}

export function ratingWeight(n: number) {
  return Math.max(-1, Math.min(1, (n - 2.5) / 2.5));
}