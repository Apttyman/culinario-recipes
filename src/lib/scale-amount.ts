// Parse + scale + re-format recipe ingredient amounts.
//
// Recipe ingredient `amount` fields are free-form strings written by Gemini.
// We handle the common cooking shapes:
//
//   "1"       → 1
//   "1.5"     → 1.5
//   "1/2"     → 0.5
//   "1 1/2"   → 1.5
//   ".5"      → 0.5
//   "1-2"     → range
//   "200"     → 200
//
// Anything not numeric ("a pinch", "to taste", "as needed", "two") is left
// unchanged when scaling — it would be wrong to multiply "a pinch" by 1.5x.
//
// A trailing non-numeric suffix is preserved verbatim, so "1 (about 2 lbs)"
// becomes "1.5 (about 2 lbs)" at 1.5x, not "1.5".
//
// Output formatting snaps to common cooking fractions when within tolerance:
//
//   1.0      → "1"
//   0.5      → "1/2"
//   0.333    → "1/3"
//   0.667    → "2/3"
//   1.25     → "1 1/4"
//   2.333    → "2 1/3"
//
// Large values (≥10) round to the nearest whole or one-decimal.
// Anything not close to a common fraction shows as a trimmed decimal.

const COMMON_FRACTIONS: Array<[string, number]> = [
  ["1/8", 1 / 8],
  ["1/4", 1 / 4],
  ["1/3", 1 / 3],
  ["3/8", 3 / 8],
  ["1/2", 1 / 2],
  ["5/8", 5 / 8],
  ["2/3", 2 / 3],
  ["3/4", 3 / 4],
  ["7/8", 7 / 8],
];

const FRACTION_TOLERANCE = 0.03;

function parseNumeric(s: string): number | null {
  s = s.trim();
  // mixed: "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const num = parseInt(mixed[2], 10);
    const den = parseInt(mixed[3], 10);
    if (den > 0) return whole + num / den;
  }
  // bare fraction: "1/2"
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const num = parseInt(frac[1], 10);
    const den = parseInt(frac[2], 10);
    if (den > 0) return num / den;
  }
  // decimal: "1.5" or ".5" or "1"
  const dec = s.match(/^\d*\.?\d+$/);
  if (dec) {
    const v = parseFloat(s);
    if (!isNaN(v)) return v;
  }
  return null;
}

type Parsed =
  | { kind: "number"; value: number; suffix?: string }
  | { kind: "range"; lo: number; hi: number; suffix?: string }
  | null;

function parseAmount(raw: string): Parsed {
  const s = raw.trim();
  if (!s) return null;
  // Range: "1-2", "1 - 2", "1 to 2", "1–2", "1—2"
  const range = s.match(
    /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|\.\d+)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|\.\d+)(.*)$/i,
  );
  if (range) {
    const lo = parseNumeric(range[1]);
    const hi = parseNumeric(range[2]);
    if (lo !== null && hi !== null) {
      const suffix = range[3]?.trim() || undefined;
      return { kind: "range", lo, hi, suffix };
    }
  }
  // Single value with optional trailing words
  const single = s.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|\.\d+)(.*)$/);
  if (single) {
    const v = parseNumeric(single[1]);
    if (v !== null) {
      const suffix = single[2]?.trim() || undefined;
      return { kind: "number", value: v, suffix };
    }
  }
  return null;
}

function formatAmount(n: number): string {
  if (!isFinite(n) || n < 0) return "0";
  if (n === 0) return "0";

  // Very large: just round
  if (n >= 100) return String(Math.round(n));

  // Large-ish: integer if close, else 1 decimal
  if (n >= 10) {
    if (Math.abs(n - Math.round(n)) < 0.1) return String(Math.round(n));
    return n.toFixed(1).replace(/\.0$/, "");
  }

  const whole = Math.floor(n);
  const frac = n - whole;

  // Effectively integer
  if (frac < FRACTION_TOLERANCE) return String(whole);
  if (frac > 1 - FRACTION_TOLERANCE) return String(whole + 1);

  // Find nearest common fraction
  let bestLabel: string | null = null;
  let bestDiff = Infinity;
  for (const [label, val] of COMMON_FRACTIONS) {
    const diff = Math.abs(frac - val);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestLabel = label;
    }
  }

  if (bestLabel && bestDiff <= FRACTION_TOLERANCE) {
    return whole > 0 ? `${whole} ${bestLabel}` : bestLabel;
  }

  // Fall back to decimal, trim trailing zeros
  let s = n.toFixed(2);
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

/**
 * Scale a free-form ingredient amount string by a multiplier.
 * Returns the original string verbatim when the amount can't be parsed
 * (e.g. "a pinch", "to taste").
 */
export function scaleAmount(raw: string | null | undefined, ratio: number): string {
  if (!raw) return "";
  if (!isFinite(ratio) || ratio <= 0) return raw;
  if (ratio === 1) return raw;

  const parsed = parseAmount(raw);
  if (!parsed) return raw;

  if (parsed.kind === "number") {
    const out = formatAmount(parsed.value * ratio);
    return parsed.suffix ? `${out} ${parsed.suffix}` : out;
  }
  if (parsed.kind === "range") {
    const out = `${formatAmount(parsed.lo * ratio)}–${formatAmount(parsed.hi * ratio)}`;
    return parsed.suffix ? `${out} ${parsed.suffix}` : out;
  }
  return raw;
}
