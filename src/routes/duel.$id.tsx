import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Confetti from "react-confetti";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/duel/$id")({
  head: () => ({ meta: [{ title: "Tonight's Duel — Culinario" }] }),
  validateSearch: (search: Record<string, unknown>) => {
    const raw = Number(search.act);
    const act = Number.isFinite(raw) && raw >= 0 && raw <= 8 ? Math.floor(raw) : undefined;
    return { act };
  },
  component: DuelPage,
});

const PALETTE = {
  bg: "#0a0a0a",
  red: "#e63946",
  gold: "#f4c430",
  neon: "#39ff14",
  ink: "#f5f5f5",
  muted: "#9a9a9a",
};

// ---------- helpers ----------
async function resolveImage(r: any): Promise<string | null> {
  if (!r) return null;
  if (r.inverse_image_url) return r.inverse_image_url;
  if (r.image_path) {
    const { data } = await supabase.storage.from("recipe-images").createSignedUrl(r.image_path, 3600);
    return data?.signedUrl ?? null;
  }
  return null;
}

function Avatar({ src, alt, size = 96, ring = false, zoom = false }: { src?: string | null; alt: string; size?: number; ring?: boolean; zoom?: boolean }) {
  return (
    <div
      aria-label={alt}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: src
          ? `${zoom ? "center 22%" : "center"}/${zoom ? "170%" : "cover"} no-repeat url(${src})`
          : "#1a1a1a",
        border: `2px solid ${PALETTE.gold}`,
        boxShadow: ring
          ? `0 0 0 6px ${PALETTE.gold}33, 0 0 60px ${PALETTE.gold}aa`
          : `0 0 24px ${PALETTE.gold}55`,
        flexShrink: 0,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {!src && (
        <svg
          viewBox="0 0 64 64"
          width={size * 0.78}
          height={size * 0.78}
          aria-hidden="true"
          style={{ display: "block", opacity: 0.55 }}
        >
          <circle cx="32" cy="22" r="11" fill={PALETTE.gold} opacity="0.55" />
          <path
            d="M10 60c0-12 10-20 22-20s22 8 22 20"
            fill={PALETTE.gold}
            opacity="0.55"
          />
        </svg>
      )}
    </div>
  );
}

// Stagger-letter title reveal
function LetterReveal({ text, perLetter = 0.08, delay = 0, style }: { text: string; perLetter?: number; delay?: number; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "inline-block", ...style }} aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: delay + i * perLetter, type: "spring", damping: 14, stiffness: 200 }}
          style={{ display: "inline-block", whiteSpace: ch === " " ? "pre" : undefined }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

// Word-by-word reveal
function WordReveal({ text, perWord = 0.18, delay = 0, style }: { text: string; perWord?: number; delay?: number; style?: React.CSSProperties }) {
  const words = text.split(/(\s+)/);
  return (
    <span style={style}>
      {words.map((w, i) =>
        /^\s+$/.test(w) ? <span key={i}>{w}</span> : (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay + i * perWord, type: "spring", damping: 16, stiffness: 180 }}
            style={{ display: "inline-block" }}
          >
            {w}
          </motion.span>
        )
      )}
    </span>
  );
}

// Typewriter
function Typewriter({ text, speed = 25, delay = 0, style }: { text: string; speed?: number; delay?: number; style?: React.CSSProperties }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (!text) return;
    let cancelled = false;
    const startT = setTimeout(() => {
      if (cancelled) return;
      const id = setInterval(() => {
        setI((n) => {
          if (n >= text.length) { clearInterval(id); return n; }
          return n + 1;
        });
      }, speed);
      (startT as any)._iv = id;
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(startT);
      const id = (startT as any)._iv; if (id) clearInterval(id);
    };
  }, [text, speed, delay]);
  return (
    <span style={style}>
      {text.slice(0, i)}
      <motion.span
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ duration: 0.9, repeat: Infinity }}
        style={{ display: "inline-block", width: 8, marginLeft: 2, color: PALETTE.gold }}
      >
        ▍
      </motion.span>
    </span>
  );
}

function ActShell({ children, onAdvance }: { children: React.ReactNode; onAdvance: () => void }) {
  return (
    <div
      onClick={onAdvance}
      style={{
        position: "fixed", inset: 0, background: PALETTE.bg, color: PALETTE.ink,
        overflow: "hidden", cursor: "pointer",
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

function TapHint({ label = "TAP TO CONTINUE" }: { label?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1.8, repeat: Infinity, delay: 0.6 }}
      style={{
        position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center",
        fontSize: 11, letterSpacing: "0.4em", color: PALETTE.muted,
      }}
    >
      {label}
    </motion.div>
  );
}

// ---------- main ----------
function DuelPage() {
  const { id } = Route.useParams();
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/sign-in" });
  }, [authLoading, session, navigate]);

  const [duel, setDuel] = useState<any>(null);
  const [recipeA, setRecipeA] = useState<any>(null);
  const [recipeB, setRecipeB] = useState<any>(null);
  const [imgA, setImgA] = useState<string | null>(null);
  const [imgB, setImgB] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: d, error: dErr } = await supabase.from("duels" as any).select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (dErr) { setError(`${dErr.code ?? "?"}: ${dErr.message}`); setLoading(false); return; }
      if (!d) { setError(`No duel row matched id ${id}.`); setLoading(false); return; }
      setDuel(d);
      const ids = [(d as any).recipe_a_id, (d as any).recipe_b_id].filter(Boolean);
      if (ids.length) {
        const { data: rs } = await supabase.from("recipes").select("*").in("id", ids);
        const a = (rs ?? []).find((r: any) => r.id === (d as any).recipe_a_id);
        const b = (rs ?? []).find((r: any) => r.id === (d as any).recipe_b_id);
        if (cancelled) return;
        setRecipeA(a); setRecipeB(b);
        const [ua, ub] = await Promise.all([resolveImage(a), resolveImage(b)]);
        if (cancelled) return;
        setImgA(ua); setImgB(ub);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Poll for image updates
  useEffect(() => {
    if (!recipeA && !recipeB) return;
    if ((recipeA?.inverse_image_url || recipeA?.image_path) && (recipeB?.inverse_image_url || recipeB?.image_path)) return;
    const t = setInterval(async () => {
      const ids = [recipeA?.id, recipeB?.id].filter(Boolean);
      if (!ids.length) return;
      const { data: rs } = await supabase.from("recipes").select("*").in("id", ids);
      const a: any = (rs ?? []).find((r: any) => r.id === recipeA?.id);
      const b: any = (rs ?? []).find((r: any) => r.id === recipeB?.id);
      if (a && (a.inverse_image_url !== recipeA?.inverse_image_url || a.image_path !== recipeA?.image_path)) {
        setRecipeA(a); resolveImage(a).then(setImgA);
      }
      if (b && (b.inverse_image_url !== recipeB?.inverse_image_url || b.image_path !== recipeB?.image_path)) {
        setRecipeB(b); resolveImage(b).then(setImgB);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [recipeA?.id, recipeB?.id, recipeA?.inverse_image_url, recipeB?.inverse_image_url]);

  // ---------- act state ----------
  const search = Route.useSearch();
  const initialAct = typeof search.act === "number" ? search.act : 0;
  const [act, setAct] = useState(initialAct); // 0..8
  const [trashIdx, setTrashIdx] = useState(1); // start with first line already revealed
  const [openRecipe, setOpenRecipe] = useState<any | null>(null);
  const [winSize, setWinSize] = useState({ w: 1200, h: 800 });

  // Sync act -> URL so deep-links and back-navigation resume at the right beat
  useEffect(() => {
    navigate({
      to: "/duel/$id",
      params: { id },
      search: { act },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act]);

  useEffect(() => {
    const onResize = () => setWinSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const chefA = duel?.chef_a ?? "Chef A";
  const chefB = duel?.chef_b ?? "Chef B";
  const portraitA: string | null = duel?.chef_a_portrait_url ?? null;
  const portraitB: string | null = duel?.chef_b_portrait_url ?? null;
  const challenge = duel?.challenge ?? "";
  const host = duel?.host_name ?? "Your Host";
  const verdict = duel?.host_verdict ?? duel?.verdict ?? "";
  const adBreak = duel?.ad_break ?? "";
  const winnerSlug = (duel?.winner_slug ?? "").toString().toLowerCase();
  const isAWinner = winnerSlug === "a" || winnerSlug === "chef_a" || winnerSlug === (duel?.chef_a_slug ?? "").toLowerCase();
  const winnerName = isAWinner ? chefA : chefB;
  const winnerImg = isAWinner ? portraitA : portraitB;

  const trashTalk = useMemo<Array<{ speaker: string; text: string; side: "a" | "b"; round: number }>>(() => {
    const tt = duel?.trash_talk;
    const raw: any[] = Array.isArray(tt) ? tt : Array.isArray(tt?.volleys) ? tt.volleys : [];
    return raw.map((t: any, i: number) => {
      const text = (typeof t === "string" ? t : (t?.text ?? t?.line ?? "")).toString();
      const speaker = typeof t === "object" ? (t?.speaker ?? (i % 2 === 0 ? chefA : chefB)) : (i % 2 === 0 ? chefA : chefB);
      const side: "a" | "b" =
        speaker === chefA ? "a" :
        speaker === chefB ? "b" :
        (i % 2 === 0 ? "a" : "b");
      const round = Number(t?.round) || (Math.floor(i / 2) + 1);
      return { speaker, text, side, round };
    }).filter((t) => t.text);
  }, [duel?.trash_talk, chefA, chefB]);

  // Build the act order; skip acts whose data is missing.
  // Fixed 1..9 order so the sequence never shifts as data trickles in.
  // Acts render placeholders if their data is missing.
  const actOrder = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9], []);

  const currentActNum = actOrder[Math.min(act, actOrder.length - 1)];

  const advance = useCallback(() => {
    if (openRecipe) return; // tap on modal handled separately
    if (currentActNum === 6 && trashIdx < trashTalk.length) {
      setTrashIdx((n) => n + 1);
      return;
    }
    setAct((a: number) => Math.min(a + 1, actOrder.length - 1));
  }, [openRecipe, currentActNum, trashIdx, trashTalk.length, actOrder.length]);

  // Ensure trash talk never shows an empty 0/N screen
  useEffect(() => {
    if (currentActNum === 6 && trashIdx < 1 && trashTalk.length > 0) setTrashIdx(1);
  }, [currentActNum, trashIdx, trashTalk.length]);


  // keyboard: space advances
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  // ---------- render guards ----------
  if (authLoading || !session || loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: PALETTE.bg, color: PALETTE.gold, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 24 }}>
        Lighting the studio…
      </div>
    );
  }
  if (error || !duel) {
    return <div style={{ minHeight: "100vh", background: PALETTE.bg, color: PALETTE.red, padding: 64 }}>{error ?? "No duel found."}</div>;
  }

  const reset = () => { setAct(0); setTrashIdx(1); setOpenRecipe(null); };

  // ---------- acts ----------
  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentActNum}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{ position: "fixed", inset: 0 }}
        >
          {currentActNum === 1 && <Act1Title chefA={chefA} chefB={chefB} onAdvance={advance} />}
          {currentActNum === 2 && <Act2Challenge challenge={challenge} host={host} onAdvance={advance} />}
          {currentActNum === 3 && <Act3WalkOn name={chefA} bio={duel.walk_on_a} img={portraitA} side="left" onAdvance={advance} />}
          {currentActNum === 4 && <Act3WalkOn name={chefB} bio={duel.walk_on_b} img={portraitB} side="right" onAdvance={advance} />}
          {currentActNum === 5 && (
            <Act5Dishes
              recipeA={recipeA} recipeB={recipeB} imgA={imgA} imgB={imgB}
              chefA={chefA} chefB={chefB}
              onAdvance={advance}
              onOpenRecipe={(r) => setOpenRecipe(r)}
            />
          )}
          {currentActNum === 6 && (
            <Act6TrashTalk
              lines={trashTalk} revealed={trashIdx}
              imgA={portraitA} imgB={portraitB}
              onAdvance={advance}
            />
          )}
          {currentActNum === 7 && (
            <Act7Verdict
              verdict={verdict} winnerName={winnerName} winnerImg={winnerImg}
              winSize={winSize} onAdvance={advance}
            />
          )}
          {currentActNum === 8 && <Act8AdBreak adBreak={adBreak} onAdvance={advance} />}
          {currentActNum === 9 && (
            <Act9Sendoff
              chefA={chefA} chefB={chefB}
              recipeA={recipeA} recipeB={recipeB}
              onReplay={reset}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Recipe modal */}
      <AnimatePresence>
        {openRecipe && (
          <RecipeModal recipe={openRecipe} img={openRecipe.id === recipeA?.id ? imgA : imgB} onClose={() => setOpenRecipe(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ---------- ACT 1 ----------
function Act1Title({ chefA, chefB, onAdvance }: { chefA: string; chefB: string; onAdvance: () => void }) {
  return (
    <ActShell onAdvance={onAdvance}>
      <div style={{ textAlign: "center", maxWidth: 1100 }}>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic", fontWeight: 900,
          fontSize: "clamp(48px, 11vw, 140px)",
          color: PALETTE.gold, letterSpacing: "0.04em",
          margin: 0, lineHeight: 1,
          textShadow: `0 6px 0 #000, 0 14px 40px ${PALETTE.gold}66`,
        }}>
          <LetterReveal text="TONIGHT'S DUEL" perLetter={0.08} />
        </h1>
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, type: "spring", damping: 12, stiffness: 140 }}
          style={{
            marginTop: 56,
            fontFamily: "Georgia, serif", fontWeight: 800,
            fontSize: "clamp(32px, 7vw, 88px)",
            display: "flex", flexWrap: "wrap", gap: 28, justifyContent: "center", alignItems: "center",
          }}
        >
          <span style={{ color: PALETTE.ink, textShadow: `5px 5px 0 ${PALETTE.red}` }}>{chefA}</span>
          <motion.span
            animate={{ rotate: [-3, 3, -3] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            style={{ color: PALETTE.gold, fontStyle: "italic", fontSize: "0.7em" }}
          >
            VS
          </motion.span>
          <span style={{ color: PALETTE.ink, textShadow: `5px 5px 0 ${PALETTE.red}` }}>{chefB}</span>
        </motion.div>
      </div>
      <TapHint label="TAP TO BEGIN" />
    </ActShell>
  );
}

// ---------- ACT 2 ----------
function Act2Challenge({ challenge, host, onAdvance }: { challenge: string; host: string; onAdvance: () => void }) {
  return (
    <ActShell onAdvance={onAdvance}>
      <div style={{ textAlign: "center", maxWidth: 900 }}>
        <motion.div
          initial={{ opacity: 0, letterSpacing: "0.1em" }}
          animate={{ opacity: 1, letterSpacing: "0.4em" }}
          transition={{ duration: 0.8 }}
          style={{ fontSize: 14, color: PALETTE.red, textTransform: "uppercase", marginBottom: 28 }}
        >
          Tonight's Challenge
        </motion.div>
        <h2 style={{
          fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700,
          fontSize: "clamp(36px, 6vw, 72px)", lineHeight: 1.2,
          color: PALETTE.gold, margin: "0 0 48px",
          textShadow: `0 4px 30px ${PALETTE.gold}33`,
        }}>
          <WordReveal text={challenge || "An open challenge."} perWord={0.16} delay={0.6} />
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 + ((challenge?.split(/\s+/).length ?? 1) * 0.16), duration: 0.6 }}
          style={{ fontSize: 13, letterSpacing: "0.3em", color: PALETTE.muted, textTransform: "uppercase" }}
        >
          Hosted by <span style={{ color: PALETTE.ink, fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 22, letterSpacing: 0, textTransform: "none" }}> {host}</span>
        </motion.div>
      </div>
      <TapHint />
    </ActShell>
  );
}

// ---------- ACT 3 / 4 (walk-on) ----------
function Act3WalkOn({ name, bio, img, side, onAdvance }: { name: string; bio?: string | null; img?: string | null; side: "left" | "right"; onAdvance: () => void }) {
  const fromX = side === "left" ? -260 : 260;
  return (
    <ActShell onAdvance={onAdvance}>
      <div style={{
        display: "flex", flexDirection: side === "left" ? "row" : "row-reverse",
        alignItems: "center", gap: 56, maxWidth: 1200, width: "100%",
        flexWrap: "wrap", justifyContent: "center",
      }}>
        <motion.div
          initial={{ x: fromX, opacity: 0, scale: 0.7 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 14, stiffness: 110 }}
        >
          <Avatar src={img} alt={name} size={260} ring />
        </motion.div>
        <div style={{ flex: 1, minWidth: 280, maxWidth: 600, textAlign: side === "left" ? "left" : "right" }}>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: "spring", damping: 14 }}
            style={{
              fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 900,
              fontSize: "clamp(48px, 9vw, 110px)", lineHeight: 1, margin: "0 0 24px",
              color: PALETTE.ink, textShadow: `5px 5px 0 ${PALETTE.red}`,
            }}
          >
            {name}
          </motion.h2>
          {bio ? (
            <div style={{
              fontStyle: "italic", fontSize: 18, lineHeight: 1.65, color: PALETTE.ink,
              borderLeft: side === "left" ? `4px solid ${PALETTE.gold}` : "none",
              borderRight: side === "right" ? `4px solid ${PALETTE.gold}` : "none",
              padding: side === "left" ? "8px 0 8px 22px" : "8px 22px 8px 0",
              minHeight: 120,
            }}>
              <Typewriter text={bio} speed={22} delay={900} />
            </div>
          ) : (
            <div style={{ fontStyle: "italic", color: PALETTE.muted }}>Steps into the kitchen, says nothing.</div>
          )}
        </div>
      </div>
      <TapHint />
    </ActShell>
  );
}

// ---------- ACT 5 ----------
function Act5Dishes({
  recipeA, recipeB, imgA, imgB, chefA, chefB, onAdvance, onOpenRecipe,
}: {
  recipeA: any; recipeB: any; imgA: string | null; imgB: string | null;
  chefA: string; chefB: string;
  onAdvance: () => void; onOpenRecipe: (r: any) => void;
}) {
  return (
    <ActShell onAdvance={onAdvance}>
      <div style={{ width: "100%", maxWidth: 1200, textAlign: "center" }}>
        <motion.h2
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 800,
            fontSize: "clamp(28px, 5vw, 52px)", color: PALETTE.gold, margin: "0 0 48px",
          }}
        >
          And here are their dishes.
        </motion.h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
          {[
            { r: recipeA, img: imgA, chef: chefA, delay: 0.2 },
            { r: recipeB, img: imgB, chef: chefB, delay: 1.7 },
          ].map(({ r, img, chef, delay }, i) => (
            <motion.button
              key={i}
              type="button"
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay, type: "spring", damping: 14, stiffness: 120 }}
              whileHover={{ y: -6, scale: 1.02 }}
              onClick={(e) => {
                e.stopPropagation();
                if (r) onOpenRecipe(r);
              }}
              style={{
                background: "#141414", border: `1px solid ${PALETTE.gold}55`,
                borderRadius: 8, overflow: "hidden", textAlign: "left",
                cursor: "pointer", padding: 0, color: "inherit",
              }}
            >
              {r ? (
                img ? (
                  <div style={{ width: "100%", aspectRatio: "4/3", background: `center/cover no-repeat url(${img})` }} />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "4/3", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.muted, fontStyle: "italic", fontSize: 13 }}>
                    Plating the dish…
                  </div>
                )
              ) : (
                <div style={{ width: "100%", aspectRatio: "4/3", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: PALETTE.muted, fontStyle: "italic" }}>
                  Recipe unavailable
                </div>
              )}
              <div style={{ padding: 22 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: PALETTE.gold }}>
                  {chef}'s entry
                </div>
                <h3 style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 26, margin: "10px 0 10px", color: PALETTE.ink }}>
                  {r?.title ?? "—"}
                </h3>
                <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: PALETTE.muted }}>
                  {(r?.cuisine ?? "—").toString().toUpperCase()} · {r?.time_estimate_minutes ?? "—"} MIN · {(r?.difficulty ?? "—").toString().toUpperCase()}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
      <TapHint label="TAP A DISH TO PEEK · TAP BACKGROUND TO CONTINUE" />
    </ActShell>
  );
}

// ---------- Recipe Modal ----------
function RecipeModal({ recipe, img, onClose }: { recipe: any; img: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const { id: duelId } = Route.useParams();
  const { act: currentAct } = Route.useSearch();
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, zIndex: 100, backdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        initial={{ y: 40, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 40, scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 18, stiffness: 180 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#141414", border: `1px solid ${PALETTE.gold}66`,
          borderRadius: 10, maxWidth: 640, width: "100%", maxHeight: "86vh",
          overflow: "auto", color: PALETTE.ink,
        }}
      >
        {img && <div style={{ width: "100%", aspectRatio: "16/9", background: `center/cover no-repeat url(${img})` }} />}
        <div style={{ padding: 28 }}>
          <h3 style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 32, margin: "0 0 8px", color: PALETTE.gold }}>{recipe.title}</h3>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: PALETTE.muted, marginBottom: 18 }}>
            {(recipe.cuisine ?? "").toString().toUpperCase()} · {recipe.time_estimate_minutes ?? "—"} MIN · {(recipe.difficulty ?? "").toString().toUpperCase()}
          </div>
          {recipe.body?.inverse_blurb && (
            <p style={{ fontStyle: "italic", color: PALETTE.ink, lineHeight: 1.6, margin: "0 0 16px" }}>"{recipe.body.inverse_blurb}"</p>
          )}
          {recipe.body?.plated_description && (
            <p style={{ color: PALETTE.muted, lineHeight: 1.6, margin: "0 0 24px" }}>{recipe.body.plated_description}</p>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => navigate({ to: "/recipes/$id", params: { id: recipe.id }, search: { from: duelId, act: currentAct ?? 0 } })}
              style={{ background: PALETTE.gold, color: "#000", border: 0, padding: "14px 22px", fontSize: 12, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer", borderRadius: 4 }}
            >
              Open recipe ↗
            </button>
            <button
              onClick={onClose}
              style={{ background: "transparent", color: PALETTE.muted, border: `1px solid ${PALETTE.muted}55`, padding: "14px 22px", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer", borderRadius: 4 }}
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------- ACT 6 — TRASH TALK ----------
function Act6TrashTalk({
  lines, revealed, imgA, imgB, onAdvance,
}: {
  lines: Array<{ speaker: string; text: string; side: "a" | "b"; round: number }>;
  revealed: number;
  imgA: string | null; imgB: string | null;
  onAdvance: () => void;
}) {
  const allDone = revealed >= lines.length;
  const visible = lines.slice(0, revealed);
  const latestIdx = visible.length - 1;
  const latestText = latestIdx >= 0 ? visible[latestIdx].text : "";

  // Typewriter for the latest line
  const [typedChars, setTypedChars] = useState(0);
  useEffect(() => {
    setTypedChars(0);
    if (!latestText) return;
    const total = latestText.length;
    const step = Math.max(12, Math.floor(900 / Math.max(20, total))); // ~0.9s total
    const id = setInterval(() => {
      setTypedChars((n) => {
        if (n >= total) { clearInterval(id); return n; }
        return n + 1;
      });
    }, step);
    return () => clearInterval(id);
  }, [latestText, revealed]);

  // "tap for the verdict" prompt — appears 2s after final line is revealed
  const [showVerdictPrompt, setShowVerdictPrompt] = useState(false);
  useEffect(() => {
    setShowVerdictPrompt(false);
    if (!allDone) return;
    const t = setTimeout(() => setShowVerdictPrompt(true), 2000);
    return () => clearTimeout(t);
  }, [allDone]);

  // Round indicator: appears briefly when entering round 2 or 3
  const lastLine = visible[latestIdx];
  const showRound =
    lastLine && lastLine.round > 1 && visible.filter((l) => l.round === lastLine.round).length === 1
      ? lastLine.round
      : null;
  const [roundVisible, setRoundVisible] = useState(false);
  useEffect(() => {
    if (showRound == null) { setRoundVisible(false); return; }
    setRoundVisible(true);
    const t = setTimeout(() => setRoundVisible(false), 1000);
    return () => clearTimeout(t);
  }, [showRound, revealed]);

  return (
    <div
      onClick={onAdvance}
      style={{
        position: "fixed", inset: 0, background: PALETTE.bg, color: PALETTE.ink,
        overflow: "hidden", cursor: "pointer", padding: "32px 16px",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 820, display: "flex", flexDirection: "column", gap: 18 }}>
        <AnimatePresence initial={false}>
          {visible.map((t, i) => {
            const left = t.side === "a";
            const avatar = left ? imgA : imgB;
            const isLatest = i === latestIdx;
            const fromX = left ? -480 : 480;
            const damping = 12;
            const stiffness = 240;
            const tilt = left ? -1.2 : 1.2;
            const shownText = isLatest ? t.text.slice(0, typedChars) : t.text;
            return (
              <motion.div
                key={i}
                initial={{ x: fromX, opacity: 0, scale: 0.9 }}
                animate={{ x: 0, opacity: isLatest ? 1 : 0.3, scale: 1, rotate: tilt }}
                transition={{ type: "spring", damping, stiffness, mass: 0.9 }}
                style={{
                  display: "flex", flexDirection: left ? "row" : "row-reverse",
                  alignItems: "flex-end", gap: 14,
                }}
              >
                <Avatar src={avatar} alt={t.speaker} size={128} zoom ring />
                <div style={{ maxWidth: "76%" }}>
                  <div style={{
                    fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase",
                    color: PALETTE.gold, marginBottom: 6, textAlign: left ? "left" : "right",
                  }}>
                    {t.speaker}
                  </div>
                  <div
                    style={{
                      background: left ? "#1c1c1c" : PALETTE.red,
                      color: PALETTE.ink,
                      padding: "18px 24px",
                      borderRadius: left ? "22px 22px 22px 4px" : "22px 22px 4px 22px",
                      border: `2px solid ${left ? "#2a2a2a" : "#a82c38"}`,
                      fontFamily: '"Bangers", "Comic Sans MS", "Impact", system-ui, sans-serif',
                      fontSize: 26,
                      fontWeight: 400,
                      letterSpacing: "0.04em",
                      lineHeight: 1.25,
                      boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
                      minHeight: 24,
                    }}
                  >
                    {shownText}
                    {isLatest && typedChars < t.text.length && (
                      <span style={{ opacity: 0.6 }}>▋</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showRound != null && roundVisible && (
          <motion.div
            key={`round-${showRound}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              fontSize: 13, letterSpacing: "0.4em", color: PALETTE.gold,
              fontFamily: "Georgia, serif", fontStyle: "italic",
              pointerEvents: "none",
            }}
          >
            ROUND {showRound}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVerdictPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{ marginTop: 36, textAlign: "center" }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.4em", color: PALETTE.muted }}>
              TAP FOR THE VERDICT
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!allDone && <TapHint label={`TAP — ${revealed}/${lines.length}`} />}
    </div>
  );
}

// ---------- ACT 7 — VERDICT ----------
function Act7Verdict({
  verdict, winnerName, winnerImg, winSize, onAdvance,
}: {
  verdict: string; winnerName: string; winnerImg: string | null;
  winSize: { w: number; h: number }; onAdvance: () => void;
}) {
  // 0 = "After long deliberation…" (auto → 1 after 2.2s)
  // 1 = verdict text (tap to advance — user controls reading speed)
  // 2 = winner reveal + confetti (tap to leave act)
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
    const t1 = setTimeout(() => setStage((s) => (s === 0 ? 1 : s)), 2200);
    return () => { clearTimeout(t1); };
  }, []);

  const handleTap = () => {
    if (stage === 0) { setStage(1); return; }      // skip the deliberation pause
    if (stage === 1) { setStage(2); return; }      // user finished reading verdict
    onAdvance();                                   // stage 2 → leave act
  };

  return (
    <div
      onClick={handleTap}
      style={{
        position: "fixed", inset: 0, background: PALETTE.bg, color: PALETTE.ink,
        overflow: "hidden", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {stage >= 2 && (
        <Confetti
          width={winSize.w}
          height={winSize.h}
          numberOfPieces={400}
          recycle={false}
          gravity={0.25}
          colors={[PALETTE.gold, PALETTE.red, "#fff", PALETTE.neon]}
          style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5 }}
        />
      )}
      <div style={{ textAlign: "center", maxWidth: 1000, position: "relative", zIndex: 10, width: "100%" }}>
        <AnimatePresence mode="wait">
          {stage === 0 && (
            <motion.div
              key="delib"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              style={{
                fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700,
                fontSize: "clamp(32px, 5.5vw, 64px)", color: PALETTE.gold,
                letterSpacing: "0.08em",
              }}
            >
              After long deliberation
              <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              > …</motion.span>
            </motion.div>
          )}
          {stage === 1 && (
            <motion.div
              key="verdict"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              style={{ width: "100%" }}
            >
              <div style={{
                fontSize: 12, letterSpacing: "0.4em", color: PALETTE.muted,
                textTransform: "uppercase", marginBottom: 24,
              }}>
                The Verdict
              </div>
              <p style={{
                fontFamily: "Georgia, serif", fontStyle: "italic",
                fontSize: "clamp(22px, 3.2vw, 32px)",
                lineHeight: 1.55, color: PALETTE.ink, maxWidth: 820, margin: "0 auto",
              }}>
                "{verdict || "The judges hesitate. The room is silent."}"
              </p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 1.6 }}
                style={{
                  marginTop: 56, fontSize: 11, letterSpacing: "0.4em",
                  color: PALETTE.muted, textTransform: "uppercase",
                }}
              >
                Tap when ready · the winner awaits
              </motion.div>
            </motion.div>
          )}
          {stage === 2 && (
            <motion.div
              key="winner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}
            >
              <motion.div
                initial={{ scale: 0.4, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 8, stiffness: 140 }}
              >
                <Avatar src={winnerImg} alt={winnerName} size={200} ring />
              </motion.div>
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", damping: 7, stiffness: 160 }}
                style={{
                  fontFamily: "Georgia, serif", fontWeight: 900, fontStyle: "italic",
                  fontSize: "clamp(48px, 10vw, 120px)", color: PALETTE.gold,
                  textShadow: `0 0 50px ${PALETTE.gold}, 6px 6px 0 ${PALETTE.red}`,
                  lineHeight: 1, letterSpacing: "0.02em", textAlign: "center",
                }}
              >
                WINNER: {winnerName}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {stage === 2 && <TapHint />}
    </div>
  );
}

// ---------- ACT 8 — AD BREAK ----------
function Act8AdBreak({ adBreak, onAdvance }: { adBreak: string; onAdvance: () => void }) {
  return (
    <div
      onClick={onAdvance}
      style={{
        position: "fixed", inset: 0, cursor: "pointer", overflow: "hidden",
        background: "repeating-linear-gradient(135deg, #6a0dad 0 60px, #4b0082 60px 120px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <style>{`
        @keyframes vhs-scan {
          0% { transform: translateY(-100%); } 100% { transform: translateY(100%); }
        }
        @keyframes star-spin {
          0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.3); } 100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes wobble {
          0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); }
        }
        @keyframes vhs-jitter {
          0% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } 100% { transform: translateX(0); }
        }
      `}</style>

      {/* VHS scan lines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.25,
        background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.6) 0 2px, transparent 2px 4px)",
      }} />
      {/* moving scan band */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: "20%",
        background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.12), transparent)",
        animation: "vhs-scan 4s linear infinite", pointerEvents: "none",
      }} />

      {/* Corner stars */}
      {[
        { top: 16, left: 16 }, { top: 16, right: 16 }, { bottom: 16, left: 16 }, { bottom: 16, right: 16 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: "absolute", ...pos as any, fontSize: 60, color: "#fff200",
          textShadow: "3px 3px 0 #ff0066", animation: "star-spin 3s linear infinite",
        }}>★</div>
      ))}

      <div style={{ position: "relative", textAlign: "center", maxWidth: 800, zIndex: 5, animation: "vhs-jitter 0.3s infinite" }}>
        <div style={{
          fontFamily: "'Comic Sans MS', 'Comic Sans', cursive",
          fontWeight: 900, fontSize: "clamp(36px, 7vw, 78px)",
          color: "#fff200", lineHeight: 1.1,
          textShadow: "4px 4px 0 #ff0066, 8px 8px 0 #00ffff, 12px 12px 30px rgba(0,0,0,0.6)",
          animation: "wobble 1.6s ease-in-out infinite",
          margin: "0 0 32px",
        }}>
          ★ COMMERCIAL BREAK ★
        </div>
        <p style={{
          fontFamily: "'Comic Sans MS', cursive", fontWeight: 700,
          fontSize: "clamp(20px, 3.2vw, 30px)",
          color: "#fff200", lineHeight: 1.4, margin: 0,
          textShadow: "3px 3px 0 #ff0066",
          background: "rgba(0,0,0,0.25)", padding: "20px 28px", borderRadius: 8,
          border: "4px dashed #fff200",
        }}>
          {adBreak}
        </p>
        <p style={{
          marginTop: 20, fontSize: 9, color: "#ddd", maxWidth: 600,
          marginLeft: "auto", marginRight: "auto", lineHeight: 1.4,
          fontFamily: "'Comic Sans MS', cursive",
        }}>
          Side effects may include kitchen rage, spontaneous appetite, mild sadness.
          Receipts not valid in California or anywhere reasonable people live.
        </p>
      </div>
      <TapHint label="TAP TO RETURN TO THE SHOW" />
    </div>
  );
}

// ---------- ACT 9 — SEND-OFF ----------
function Act9Sendoff({
  chefA, chefB, recipeA, recipeB, onReplay,
}: {
  chefA: string; chefB: string; recipeA: any; recipeB: any; onReplay: () => void;
}) {
  const navigate = useNavigate();
  const { id: duelId } = Route.useParams();
  const { act: currentAct } = Route.useSearch();
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: PALETTE.bg, color: PALETTE.ink,
        overflow: "auto", padding: 32,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, width: "100%", textAlign: "center" }}>
        <motion.h2
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{
            fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 800,
            fontSize: "clamp(28px, 4.5vw, 46px)", color: PALETTE.gold,
            margin: "0 0 12px",
          }}
        >
          Both recipes are now in your cookbook.
        </motion.h2>
        <p style={{ color: PALETTE.muted, margin: "0 0 48px", fontSize: 14, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          That's a wrap.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginBottom: 56 }}>
          {recipeA && (
            <motion.button
              whileHover={{ y: -4 }}
              onClick={() => navigate({ to: "/recipes/$id", params: { id: recipeA.id }, search: { from: duelId, act: currentAct ?? 8 } })}
              style={{
                background: "transparent", color: PALETTE.gold,
                border: `2px solid ${PALETTE.gold}`,
                padding: "22px 28px", fontSize: 13, fontWeight: 800,
                letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: "pointer", borderRadius: 4,
              }}
            >
              Cook {chefA}'s recipe ↗
            </motion.button>
          )}
          {recipeB && (
            <motion.button
              whileHover={{ y: -4 }}
              onClick={() => navigate({ to: "/recipes/$id", params: { id: recipeB.id }, search: { from: duelId, act: currentAct ?? 8 } })}
              style={{
                background: PALETTE.red, color: PALETTE.ink,
                border: `2px solid ${PALETTE.red}`,
                padding: "22px 28px", fontSize: 13, fontWeight: 800,
                letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: "pointer", borderRadius: 4,
              }}
            >
              Cook {chefB}'s recipe ↗
            </motion.button>
          )}
        </div>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={onReplay}
            style={{ background: "transparent", border: 0, color: PALETTE.muted, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer" }}
          >
            ↺ Replay duel
          </button>
          <Link
            to="/today"
            style={{ color: PALETTE.muted, fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase", textDecoration: "none" }}
          >
            ← Back to today
          </Link>
        </div>
      </div>
    </div>
  );
}
