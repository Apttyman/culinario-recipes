import { useEffect, useState } from "react";

// Stepper for adjusting the target servings on a recipe view. Local-only state
// in the parent; never persisted back to the row (so the cookbook entry's
// canonical servings count doesn't drift). When the value differs from the
// baseline, a small "Reset to N" affordance appears to put it back.
//
// Mobile UX:
// - 44x44 tap targets on the −/+ buttons (Apple HIG minimum is 44pt)
// - Long-press accelerates the change (250ms → 80ms ramp) so users can sweep
//   from 2 to 12 with a single press instead of 10 taps
// - Disables at MIN and MAX, never traps the user
//
// Desktop UX:
// - Same controls; mouse hover state inherited; keyboard ↑/↓ via the
//   container's tabIndex routes to inc/dec.

const MIN = 1;
const MAX = 24;

type Props = {
  value: number;
  baseServings: number;
  onChange: (next: number) => void;
};

export function ServingsStepper({ value, baseServings, onChange }: Props) {
  const isModified = value !== baseServings;

  const dec = () => onChange(Math.max(MIN, value - 1));
  const inc = () => onChange(Math.min(MAX, value + 1));
  const reset = () => onChange(baseServings);

  // Long-press acceleration. We track which direction is being held and
  // schedule progressively faster repeats while held.
  const [holdDir, setHoldDir] = useState<-1 | 1 | 0>(0);
  useEffect(() => {
    if (holdDir === 0) return;
    let interval = 250;
    let id: number | null = null;
    const tick = () => {
      if (holdDir === -1) dec();
      else if (holdDir === 1) inc();
      interval = Math.max(80, Math.floor(interval * 0.82));
      id = window.setTimeout(tick, interval);
    };
    id = window.setTimeout(tick, 400); // wait 400ms before first auto-repeat
    return () => { if (id) window.clearTimeout(id); };
  }, [holdDir, value]); // depend on value so we re-evaluate disabled bounds

  const startHold = (dir: -1 | 1) => setHoldDir(dir);
  const stopHold = () => setHoldDir(0);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "+") {
      e.preventDefault();
      inc();
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "-") {
      e.preventDefault();
      dec();
    }
  };

  return (
    <div
      role="group"
      aria-label="Adjust servings"
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        padding: 0,
        outline: "none",
      }}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= MIN}
        onMouseDown={() => startHold(-1)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={(e) => { e.preventDefault(); startHold(-1); }}
        onTouchEnd={stopHold}
        onTouchCancel={stopHold}
        aria-label="Decrease servings"
        className="culinario-stepper-btn"
        style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "transparent",
          border: "1px solid var(--hairline)",
          color: value <= MIN ? "var(--fg-low)" : "var(--fg)",
          cursor: value <= MIN ? "not-allowed" : "pointer",
          fontSize: 22, lineHeight: 1, fontWeight: 300,
          fontFamily: "var(--font-display)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: 0, flexShrink: 0,
          touchAction: "manipulation",
          userSelect: "none", WebkitUserSelect: "none",
        }}
      >
        −
      </button>

      <div style={{
        minWidth: 60,
        textAlign: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}>
        <div style={{
          fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400,
          fontSize: 30, lineHeight: 1, color: "var(--fg)",
          // Tabular alignment so numbers don't jiggle as digits change width
          fontVariantNumeric: "tabular-nums",
        }}>
          {value}
        </div>
        <div style={{
          marginTop: 4,
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em",
          textTransform: "uppercase", color: "var(--fg-muted)",
        }}>
          {value === 1 ? "Serving" : "Servings"}
        </div>
      </div>

      <button
        type="button"
        onClick={inc}
        disabled={value >= MAX}
        onMouseDown={() => startHold(1)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={(e) => { e.preventDefault(); startHold(1); }}
        onTouchEnd={stopHold}
        onTouchCancel={stopHold}
        aria-label="Increase servings"
        className="culinario-stepper-btn"
        style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "transparent",
          border: "1px solid var(--hairline)",
          color: value >= MAX ? "var(--fg-low)" : "var(--fg)",
          cursor: value >= MAX ? "not-allowed" : "pointer",
          fontSize: 20, lineHeight: 1, fontWeight: 300,
          fontFamily: "var(--font-display)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: 0, flexShrink: 0,
          touchAction: "manipulation",
          userSelect: "none", WebkitUserSelect: "none",
        }}
      >
        +
      </button>

      {isModified && (
        <button
          type="button"
          onClick={reset}
          aria-label={`Reset to ${baseServings} servings`}
          style={{
            background: "transparent",
            border: 0,
            color: "var(--saffron)",
            cursor: "pointer",
            padding: "6px 4px",
            fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Reset to {baseServings}
        </button>
      )}

      <style>{`
        .culinario-stepper-btn:hover:not(:disabled) {
          background: color-mix(in oklab, var(--saffron) 10%, transparent);
          border-color: var(--saffron);
          color: var(--saffron);
        }
        .culinario-stepper-btn:active:not(:disabled) {
          transform: scale(0.96);
        }
      `}</style>
    </div>
  );
}
