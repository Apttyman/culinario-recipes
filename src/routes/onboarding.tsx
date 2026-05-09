import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { insertSignal } from "@/lib/preference-signals";
import { useAuth } from "@/lib/auth-context";
import { CURATED_CHEFS, CURATED_CUISINES } from "@/lib/curated-preferences";
import {
  page,
  container,
  title as titleStyle,
  subtitle,
  Field,
  inputStyle,
  ctaStyle,
  ArrowUpRight,
  ArrowUpLeft,
  labelStyle,
  helperStyle,
  hairline,
} from "@/components/auth-ui";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding — Culinario" }] }),
  component: Onboarding,
});

const APPLIANCES = [
  ["oven", "Oven"],
  ["gas_stove", "Gas stove"],
  ["electric_stove", "Electric stove"],
  ["induction_stove", "Induction stove"],
  ["cast_iron", "Cast iron"],
  ["dutch_oven", "Dutch oven"],
  ["stand_mixer", "Stand mixer"],
  ["food_processor", "Food processor"],
  ["blender", "Blender"],
  ["sous_vide", "Sous vide"],
  ["air_fryer", "Air fryer"],
  ["rice_cooker", "Rice cooker"],
  ["slow_cooker", "Slow cooker"],
  ["grill", "Grill"],
] as const;

const PANTRY_SUGGESTIONS: { category: string; label: string; items: string[] }[] = [
  { category: "spice", label: "Spice", items: ["salt", "pepper", "garlic powder", "cumin", "paprika", "red pepper flakes", "oregano", "thyme", "bay leaves", "cinnamon"] },
  { category: "oil", label: "Oil", items: ["olive oil", "neutral oil", "sesame oil"] },
  { category: "vinegar", label: "Vinegar", items: ["white wine vinegar", "balsamic", "rice vinegar", "apple cider vinegar"] },
  { category: "grain", label: "Grain", items: ["rice", "pasta", "flour", "oats"] },
  { category: "legume", label: "Legume", items: ["dried lentils", "canned beans", "chickpeas"] },
  { category: "canned", label: "Canned", items: ["tomatoes", "coconut milk", "anchovies"] },
  { category: "condiment", label: "Condiment", items: ["soy sauce", "fish sauce", "dijon mustard", "mayo", "hot sauce"] },
  { category: "baking", label: "Baking", items: ["sugar", "baking soda", "baking powder", "vanilla"] },
];

const DIETARY = [
  ["vegetarian", "Vegetarian"],
  ["vegan", "Vegan"],
  ["gluten_free", "Gluten free"],
  ["dairy_free", "Dairy free"],
  ["nut_allergy", "Nut allergy"],
  ["shellfish_allergy", "Shellfish allergy"],
  ["pork_free", "Pork free"],
  ["beef_free", "Beef free"],
  ["kosher", "Kosher"],
  ["halal", "Halal"],
] as const;

const VOICES = [
  { slug: "nonna", name: "Nonna", tag: "Patient, slightly disappointed, wants you to add more butter.", sample: "Cara, that's not enough garlic. Trust me." },
  { slug: "health_inspector", name: "The Health Inspector", tag: "Clinical, dry, side-eyes your habits.", sample: "Note: third pasta night this week. Acknowledged." },
  { slug: "tom_ford_intern", name: "The Tom Ford Intern", tag: "Aspirational, name-drops, takes everything personally.", sample: "We're plating this on the slate, yes? Yes." },
  { slug: "bike_messenger", name: "The Bike Messenger", tag: "Friendly, profane, eats while standing up.", sample: "Hell yeah. Eat it over the sink, no one cares." },
  { slug: "monk", name: "The Monk", tag: "Calm, present, treats every meal as practice.", sample: "Notice the steam. The rice is ready when it is ready." },
];

type PantryItem = { name: string; category: string };
type Person = {
  name: string;
  relationship: string;
  dietary_constraints: string[];
  dislikes: string;
  comfort_food_tag: string;
};

const STEP_LABELS = ["NAME", "KITCHEN", "DIETARY", "PANTRY", "PEOPLE", "CHEFS", "CUISINES", "VOICE"];

const DIETARY_PREFS: { value: string; label: string }[] = [
  { value: "none", label: "Anything goes" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "ketogenic", label: "Ketogenic" },
];

function StepIndicator({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
      {STEP_LABELS.map((label, i) => (
        <span key={label} style={{ color: i === step ? "var(--saffron)" : "var(--fg-low)" }}>
          {i === step ? `№ 002.${i + 1} — ${label}` : `002.${i + 1}`}
        </span>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="culinario-chip"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.15em",
        padding: "8px 14px",
        background: "transparent",
        border: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
        color: active ? "var(--saffron)" : "var(--fg-muted)",
        cursor: "pointer",
        borderRadius: 0,
      }}
    >
      {children}
    </button>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="culinario-nav-buttons" style={{ marginTop: 64, display: "flex", justifyContent: "space-between" }}>
      {onBack ? (
        <button onClick={onBack} style={{ ...ctaStyle, color: "var(--fg-muted)" }}>
          <ArrowUpLeft /> Back
        </button>
      ) : <span />}
      <button onClick={onNext} disabled={nextDisabled} style={{ ...ctaStyle, opacity: nextDisabled ? 0.4 : 1 }}>
        {nextLabel} <ArrowUpRight />
      </button>
    </div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const { session, loading, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [displayName, setDisplayName] = useState("");
  // Step 2
  const [stoveType, setStoveType] = useState<"gas" | "electric" | "induction" | "">("");
  const [appliances, setAppliances] = useState<string[]>([]);
  const [defaultFat, setDefaultFat] = useState("");
  const [defaultAcid, setDefaultAcid] = useState("");
  // Step 2 (dietary)
  const [dietaryPref, setDietaryPref] = useState<string>("none");
  // Step 3
  const [pantryInput, setPantryInput] = useState("");
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  // Step 4
  const [people, setPeople] = useState<Person[]>([]);
  // Step 5
  const [voice, setVoice] = useState<string>("");
  // Step 5 (chefs) / Step 6 (cuisines)
  const [chefSlugs, setChefSlugs] = useState<string[]>([]);
  const [chefCustom, setChefCustom] = useState<string[]>([]);
  const [chefInput, setChefInput] = useState("");
  const [cuisineSlugs, setCuisineSlugs] = useState<string[]>([]);
  const [cuisineCustom, setCuisineCustom] = useState<string[]>([]);
  const [cuisineInput, setCuisineInput] = useState("");

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/sign-in" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [{ data: chefs }, { data: cuisines }] = await Promise.all([
        supabase.from("chef_preferences").select("chef_slug, chef_name, is_custom").eq("user_id", session.user.id),
        supabase.from("cuisine_preferences").select("cuisine_slug, cuisine_name, is_custom").eq("user_id", session.user.id),
      ]);
      if (chefs) {
        setChefSlugs(chefs.filter((c) => !c.is_custom && c.chef_slug).map((c) => c.chef_slug as string));
        setChefCustom(chefs.filter((c) => c.is_custom).map((c) => c.chef_name));
      }
      if (cuisines) {
        setCuisineSlugs(cuisines.filter((c) => !c.is_custom && c.cuisine_slug).map((c) => c.cuisine_slug as string));
        setCuisineCustom(cuisines.filter((c) => c.is_custom).map((c) => c.cuisine_name));
      }
    })();
  }, [session]);

  if (loading || !session) return <div style={page} />;

  const userId = session.user.id;

  const togglePantry = (name: string, category: string) => {
    setPantry((prev) =>
      prev.find((p) => p.name === name)
        ? prev.filter((p) => p.name !== name)
        : [...prev, { name, category }],
    );
  };

  const addPantryFree = () => {
    const n = pantryInput.trim().toLowerCase();
    if (!n) return;
    if (pantry.find((p) => p.name === n)) {
      setPantryInput("");
      return;
    }
    setPantry((p) => [...p, { name: n, category: "other" }]);
    setPantryInput("");
  };

  const savePrefs = async () => {
    await supabase.from("chef_preferences").delete().eq("user_id", userId);
    const chefRows = [
      ...chefSlugs.map((slug) => {
        const c = CURATED_CHEFS.find((x) => x.slug === slug);
        return { user_id: userId, chef_slug: slug, chef_name: c?.name ?? slug, is_custom: false };
      }),
      ...chefCustom.map((name) => ({ user_id: userId, chef_slug: null, chef_name: name, is_custom: true })),
    ];
    if (chefRows.length) await supabase.from("chef_preferences").insert(chefRows);

    await supabase.from("cuisine_preferences").delete().eq("user_id", userId);
    const cuisineRows = [
      ...cuisineSlugs.map((slug) => {
        const c = CURATED_CUISINES.find((x) => x.slug === slug);
        return { user_id: userId, cuisine_slug: slug, cuisine_name: c?.name ?? slug, is_custom: false };
      }),
      ...cuisineCustom.map((name) => ({ user_id: userId, cuisine_slug: null, cuisine_name: name, is_custom: true })),
    ];
    if (cuisineRows.length) await supabase.from("cuisine_preferences").insert(cuisineRows);
  };

  const finalize = async () => {
    setError(null);
    setSaving(true);
    try {
      // profile name
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ display_name: displayName, kitchen_voice: voice, onboarding_complete: true })
        .eq("id", userId);
      if (profileErr) console.error("[onboarding] profiles update failed", profileErr);

      // kitchen profile (update first, insert if the row doesn't exist)
      const kitchenProfile = { stove_type: stoveType, appliances, default_fat: defaultFat, default_acid: defaultAcid };
      const { error: kitchenUpdateErr, count: kitchenUpdateCount } = await supabase
        .from("kitchen_profiles")
        .update(kitchenProfile, { count: "exact" })
        .eq("user_id", userId);
      if (kitchenUpdateErr) {
        console.error("[onboarding] kitchen_profiles update failed", kitchenUpdateErr);
        throw kitchenUpdateErr;
      }
      if (kitchenUpdateCount === 0) {
        const { error: kitchenInsertErr } = await supabase.from("kitchen_profiles").insert({ user_id: userId, ...kitchenProfile });
        if (kitchenInsertErr) {
          console.error("[onboarding] kitchen_profiles insert failed", kitchenInsertErr);
          throw kitchenInsertErr;
        }
      }

      // pantry items - clear & insert
      const { error: pantryDelErr } = await supabase.from("pantry_items").delete().eq("user_id", userId);
      if (pantryDelErr) console.error("[onboarding] pantry_items delete failed", pantryDelErr);
      if (pantry.length) {
        const { error: pantryInsErr } = await supabase.from("pantry_items").insert(
          pantry.map((p) => ({ user_id: userId, name: p.name, category: p.category, always_stocked: true })),
        );
        if (pantryInsErr) console.error("[onboarding] pantry_items insert failed", pantryInsErr);
      }

      // people - replace
      const { error: peopleDelErr } = await supabase.from("people").delete().eq("user_id", userId);
      if (peopleDelErr) console.error("[onboarding] people delete failed", peopleDelErr);
      if (people.length) {
        const { error: peopleInsErr } = await supabase.from("people").insert(
          people.map((p) => ({
            user_id: userId,
            name: p.name,
            relationship: p.relationship || null,
            dietary_constraints: p.dietary_constraints,
            dislikes: p.dislikes ? p.dislikes.split(",").map((s) => s.trim()).filter(Boolean) : [],
            comfort_food_tag: p.comfort_food_tag || null,
          })),
        );
        if (peopleInsErr) console.error("[onboarding] people insert failed", peopleInsErr);
      }
      try {
        await savePrefs();
      } catch (e) {
        console.error("[onboarding] savePrefs failed", e);
      }
      // One-time onboarding signals
      try {
        const sigs: any[] = [];
        if (voice) {
          sigs.push({
            user_id: userId, source: "onboarding" as const, axis: "voice",
            signal_text: `prefers kitchen voice: ${voice}`, signal_weight: 1.0,
            metadata: { kind: "voice", value: voice },
          });
        }
        for (const p of people) {
          for (const dc of p.dietary_constraints ?? []) {
            sigs.push({
              user_id: userId, source: "onboarding" as const, axis: "constraint",
              signal_text: `${p.name}: dietary constraint — ${dc}`, signal_weight: 1.0,
              metadata: { kind: "constraint", person: p.name, constraint: dc },
            });
          }
          if (p.comfort_food_tag) {
            sigs.push({
              user_id: userId, source: "onboarding" as const, axis: "comfort",
              signal_text: `${p.name} comfort food: ${p.comfort_food_tag}`, signal_weight: 1.0,
              metadata: { kind: "comfort", person: p.name, tag: p.comfort_food_tag },
            });
          }
        }
        for (const s of sigs) await insertSignal(s);
      } catch (e) {
        console.error("[onboarding] signal seeding failed", e);
      }
      await refreshProfile();
      navigate({ to: "/today" });
    } catch (e: any) {
      console.error("[onboarding] finalize failed", e);
      setError(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={page}>
      <main style={container}>
        <StepIndicator step={step} />
        <hr style={{ ...hairline, margin: "32px 0" }} />

        {step === 0 && (
          <>
            <h1 style={titleStyle}>What should we call you.</h1>
            <p style={subtitle}>Just your first name is fine. The kitchen voice will use it sparingly.</p>
            <div style={{ height: 56 }} />
            <Field label="Name">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={inputStyle}
                className="culinario-input"
                autoFocus
              />
            </Field>
            <NavButtons onNext={() => setStep(1)} nextDisabled={!displayName.trim()} />
          </>
        )}

        {step === 1 && (
          <>
            <h1 style={titleStyle}>Tell us about your kitchen.</h1>
            <p style={subtitle}>This helps us know what you can actually cook tonight.</p>
            <div style={{ height: 48 }} />

            <div style={{ marginBottom: 32 }}>
              <span style={labelStyle}>Stove</span>
              <div style={{ display: "flex", gap: 0 }}>
                {(["gas", "electric", "induction"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStoveType(s)}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: 0,
                      borderBottom: `1px solid ${stoveType === s ? "var(--saffron)" : "var(--hairline)"}`,
                      color: stoveType === s ? "var(--saffron)" : "var(--fg-muted)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      padding: "14px 0",
                      cursor: "pointer",
                      borderRadius: 0,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <span style={labelStyle}>Appliances</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {APPLIANCES.map(([slug, label]) => (
                  <Chip
                    key={slug}
                    active={appliances.includes(slug)}
                    onClick={() =>
                      setAppliances((prev) =>
                        prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug],
                      )
                    }
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </div>

            <Field label="Default fat" helper="what you reach for first — olive oil, butter, ghee, neutral oil">
              <input value={defaultFat} onChange={(e) => setDefaultFat(e.target.value)} style={inputStyle} className="culinario-input" />
            </Field>
            <Field label="Default acid" helper="lemon, vinegar, lime — what your cooking tastes like">
              <input value={defaultAcid} onChange={(e) => setDefaultAcid(e.target.value)} style={inputStyle} className="culinario-input" />
            </Field>

            <NavButtons onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!stoveType} />
          </>
        )}

        {step === 2 && (
          <>
            <h1 style={titleStyle}>Anything you don't eat?</h1>
            <p style={subtitle}>This is a hard constraint — recipes will respect it.</p>
            <div style={{ height: 48 }} />

            <div>
              {DIETARY_PREFS.map((d, i) => {
                const active = dietaryPref === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDietaryPref(d.value)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      minHeight: 44,
                      padding: "16px 8px",
                      background: "transparent",
                      border: 0,
                      borderTop: i === 0 ? "1px solid var(--hairline)" : 0,
                      borderBottom: "1px solid var(--hairline)",
                      color: active ? "var(--saffron)" : "var(--fg-muted)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      borderRadius: 0,
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            <NavButtons
              onBack={() => setStep(1)}
              onNext={async () => {
                const { error: dpErr } = await supabase
                  .from("profiles")
                  .update({ dietary_preference: dietaryPref } as any)
                  .eq("id", userId);
                if (dpErr) console.error("[onboarding] profiles dietary_preference update failed", dpErr);
                if (dietaryPref !== "none") {
                  await insertSignal({
                    user_id: userId,
                    source: "onboarding",
                    axis: "dietary",
                    signal_text: `user follows ${dietaryPref} diet`,
                    signal_weight: 2.0,
                    metadata: { kind: "dietary", value: dietaryPref },
                  });
                }
                setStep(3);
              }}
            />
          </>
        )}

        {step === 3 && (
          <>
            <h1 style={titleStyle}>What's always in your pantry.</h1>
            <p style={subtitle}>Skip nothing obvious — salt and pepper count. We use this so recipes don't pretend you have an empty kitchen.</p>
            <div style={{ height: 48 }} />

            <div style={{ position: "relative", marginBottom: 24 }}>
              <input
                value={pantryInput}
                onChange={(e) => setPantryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPantryFree();
                  }
                }}
                placeholder="Add a pantry item..."
                style={{ ...inputStyle, fontSize: 18 }}
                className="culinario-input"
              />
              <button onClick={addPantryFree} style={{ ...ctaStyle, position: "absolute", right: 0, top: 8 }}>
                + <ArrowUpRight />
              </button>
            </div>

            {pantry.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
                {pantry.map((p) => (
                  <span
                    key={p.name}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.15em",
                      padding: "8px 12px",
                      border: "1px solid var(--saffron)",
                      color: "var(--saffron)",
                    }}
                  >
                    {p.name}
                    <button
                      onClick={() => setPantry((prev) => prev.filter((x) => x.name !== p.name))}
                      style={{ background: "transparent", border: 0, color: "var(--saffron)", cursor: "pointer", padding: 0, fontSize: 14 }}
                      aria-label={`Remove ${p.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {PANTRY_SUGGESTIONS.map((group) => (
              <div key={group.category} style={{ marginBottom: 24 }}>
                <div style={{ ...labelStyle, marginBottom: 12 }}>{group.label}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {group.items.map((item) => (
                    <Chip key={item} active={!!pantry.find((p) => p.name === item)} onClick={() => togglePantry(item, group.category)}>
                      {item}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}

            <NavButtons
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
              nextDisabled={pantry.length < 5}
              nextLabel={pantry.length < 5 ? `Add ${5 - pantry.length} more` : "Continue"}
            />
          </>
        )}

        {step === 4 && (
          <>
            <h1 style={titleStyle}>Who do you cook for.</h1>
            <p style={subtitle}>Add the people you cook for regularly. You can skip this and add them later.</p>
            <div style={{ height: 32 }} />

            <button
              onClick={() =>
                setPeople((p) => [...p, { name: "", relationship: "", dietary_constraints: [], dislikes: "", comfort_food_tag: "" }])
              }
              style={ctaStyle}
            >
              + Add Person <ArrowUpRight />
            </button>

            <div style={{ marginTop: 32 }}>
              {people.map((person, idx) => (
                <div key={idx} style={{ borderBottom: "1px solid var(--hairline)", padding: "24px 0" }}>
                  <Field label="Name">
                    <input
                      value={person.name}
                      onChange={(e) => setPeople((arr) => arr.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)))}
                      style={inputStyle}
                      className="culinario-input"
                    />
                  </Field>
                  <div style={{ marginBottom: 24 }}>
                    <span style={labelStyle}>Relationship</span>
                    <select
                      value={person.relationship}
                      onChange={(e) => setPeople((arr) => arr.map((p, i) => (i === idx ? { ...p, relationship: e.target.value } : p)))}
                      style={{
                        ...inputStyle,
                        appearance: "none",
                        fontSize: 18,
                        fontFamily: "var(--font-body)",
                        fontWeight: 400,
                      }}
                    >
                      <option value="">—</option>
                      <option value="partner">partner</option>
                      <option value="kid">kid</option>
                      <option value="family">family</option>
                      <option value="friend">friend</option>
                      <option value="roommate">roommate</option>
                      <option value="other">other</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <span style={labelStyle}>Dietary constraints</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {DIETARY.map(([slug, label]) => (
                        <Chip
                          key={slug}
                          active={person.dietary_constraints.includes(slug)}
                          onClick={() =>
                            setPeople((arr) =>
                              arr.map((p, i) =>
                                i === idx
                                  ? {
                                      ...p,
                                      dietary_constraints: p.dietary_constraints.includes(slug)
                                        ? p.dietary_constraints.filter((x) => x !== slug)
                                        : [...p.dietary_constraints, slug],
                                    }
                                  : p,
                              ),
                            )
                          }
                        >
                          {label}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <Field label="Dislikes" helper="comma-separated">
                    <input
                      value={person.dislikes}
                      onChange={(e) => setPeople((arr) => arr.map((p, i) => (i === idx ? { ...p, dislikes: e.target.value } : p)))}
                      style={{ ...inputStyle, fontSize: 18, fontFamily: "var(--font-body)", fontWeight: 400 }}
                      className="culinario-input"
                    />
                  </Field>
                  <Field label="Comfort food" helper="what they grew up eating">
                    <input
                      value={person.comfort_food_tag}
                      onChange={(e) => setPeople((arr) => arr.map((p, i) => (i === idx ? { ...p, comfort_food_tag: e.target.value } : p)))}
                      style={inputStyle}
                      className="culinario-input"
                    />
                  </Field>
                  <div style={{ textAlign: "right" }}>
                    <button
                      onClick={() => setPeople((arr) => arr.filter((_, i) => i !== idx))}
                      style={{ ...ctaStyle, color: "var(--fg-low)", fontSize: 11 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <NavButtons onBack={() => setStep(3)} onNext={() => setStep(5)} />
          </>
        )}

        {step === 5 && (
          <ChefsStep
            chefSlugs={chefSlugs}
            setChefSlugs={setChefSlugs}
            chefCustom={chefCustom}
            setChefCustom={setChefCustom}
            chefInput={chefInput}
            setChefInput={setChefInput}
            onBack={() => setStep(4)}
            onNext={async () => { try { await savePrefs(); } catch (e) { console.error(e); } setStep(6); }}
          />
        )}

        {step === 6 && (
          <CuisinesStep
            cuisineSlugs={cuisineSlugs}
            setCuisineSlugs={setCuisineSlugs}
            cuisineCustom={cuisineCustom}
            setCuisineCustom={setCuisineCustom}
            cuisineInput={cuisineInput}
            setCuisineInput={setCuisineInput}
            onBack={() => setStep(5)}
            onNext={async () => { try { await savePrefs(); } catch (e) { console.error(e); } setStep(7); }}
          />
        )}

        {step === 7 && (
          <>
            <h1 style={titleStyle}>Pick a voice for your kitchen.</h1>
            <p style={subtitle}>Whoever's narrating your cooking diary. You can change this later. Sparingly used — they speak when something matters.</p>
            <div style={{ height: 48 }} />

            <div>
              {VOICES.map((v) => {
                const active = voice === v.slug;
                return (
                  <button
                    key={v.slug}
                    type="button"
                    onClick={() => setVoice(v.slug)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: 32,
                      background: "transparent",
                      border: 0,
                      borderTop: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
                      borderBottom: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
                      marginTop: -1,
                      cursor: "pointer",
                      color: "var(--fg)",
                      borderRadius: 0,
                    }}
                  >
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontStyle: "italic", fontSize: 28 }}>{v.name}</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: 16, color: "var(--fg-muted)", marginTop: 8 }}>{v.tag}</div>
                    <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 18, color: "var(--fg)", marginTop: 16, paddingLeft: 24 }}>
                      {v.sample}
                    </div>
                  </button>
                );
              })}
            </div>

            {error && <div style={{ ...helperStyle, color: "var(--saffron)", marginTop: 16 }}>{error}</div>}

            <NavButtons
              onBack={() => setStep(6)}
              onNext={finalize}
              nextDisabled={!voice || saving}
              nextLabel={saving ? "Saving…" : "Continue"}
            />
          </>
        )}
      </main>
    </div>
  );
}

function ChefsStep(props: {
  chefSlugs: string[];
  setChefSlugs: React.Dispatch<React.SetStateAction<string[]>>;
  chefCustom: string[];
  setChefCustom: React.Dispatch<React.SetStateAction<string[]>>;
  chefInput: string;
  setChefInput: React.Dispatch<React.SetStateAction<string>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const { chefSlugs, setChefSlugs, chefCustom, setChefCustom, chefInput, setChefInput, onBack, onNext } = props;
  const toggle = (slug: string) =>
    setChefSlugs((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));
  const addCustom = () => {
    const n = chefInput.trim();
    if (!n) return;
    if (chefCustom.some((c) => c.toLowerCase() === n.toLowerCase())) { setChefInput(""); return; }
    setChefCustom((p) => [...p, n]);
    setChefInput("");
  };
  return (
    <>
      <h1 style={titleStyle}>Whose cooking do you love.</h1>
      <p style={subtitle}>Pick the chefs whose food you'd want to eat. Their style will shape the recipes you see. Skip if none feel right.</p>
      <hr style={{ ...hairline, width: 64, margin: "32px auto" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {CURATED_CHEFS.map((c) => {
          const active = chefSlugs.includes(c.slug);
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => toggle(c.slug)}
              style={{
                textAlign: "left",
                padding: 16,
                background: "transparent",
                border: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
                color: "var(--fg)",
                cursor: "pointer",
                borderRadius: 0,
              }}
            >
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontStyle: "italic", fontSize: 20 }}>{c.name}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-low)", marginTop: 6 }}>{c.style}</div>
            </button>
          );
        })}
      </div>
      <hr style={{ ...hairline, margin: "40px 0 16px" }} />
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Or add your own</span>
        <div style={{ position: "relative" }}>
          <input
            value={chefInput}
            onChange={(e) => setChefInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Sohla El-Waylly, Diana Henry…"
            style={{ ...inputStyle, fontSize: 24, fontFamily: "var(--font-display)", fontWeight: 500 }}
            className="culinario-input"
          />
          <button onClick={addCustom} style={{ ...ctaStyle, position: "absolute", right: 0, top: 8 }}>+ <ArrowUpRight /></button>
        </div>
      </div>
      {chefCustom.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {chefCustom.map((n) => (
            <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-body)", fontSize: 14, padding: "6px 12px", border: "1px solid var(--saffron)", color: "var(--saffron)" }}>
              {n}
              <button onClick={() => setChefCustom((p) => p.filter((x) => x !== n))} style={{ background: "transparent", border: 0, color: "var(--saffron)", cursor: "pointer", padding: 0, fontSize: 14 }} aria-label={`Remove ${n}`}>×</button>
            </span>
          ))}
        </div>
      )}
      <NavButtons onBack={onBack} onNext={onNext} />
    </>
  );
}

function CuisinesStep(props: {
  cuisineSlugs: string[];
  setCuisineSlugs: React.Dispatch<React.SetStateAction<string[]>>;
  cuisineCustom: string[];
  setCuisineCustom: React.Dispatch<React.SetStateAction<string[]>>;
  cuisineInput: string;
  setCuisineInput: React.Dispatch<React.SetStateAction<string>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const { cuisineSlugs, setCuisineSlugs, cuisineCustom, setCuisineCustom, cuisineInput, setCuisineInput, onBack, onNext } = props;
  const toggle = (slug: string) =>
    setCuisineSlugs((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));
  const addCustom = () => {
    const n = cuisineInput.trim();
    if (!n) return;
    if (cuisineCustom.some((c) => c.toLowerCase() === n.toLowerCase())) { setCuisineInput(""); return; }
    setCuisineCustom((p) => [...p, n]);
    setCuisineInput("");
  };
  return (
    <>
      <h1 style={titleStyle}>What kinds of food do you cook.</h1>
      <p style={subtitle}>These guide the recipes you'll see. Pick freely — you can add cuisines we missed below.</p>
      <hr style={{ ...hairline, width: 64, margin: "32px auto" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {CURATED_CUISINES.map((c) => {
          const active = cuisineSlugs.includes(c.slug);
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => toggle(c.slug)}
              style={{
                textAlign: "center",
                padding: 20,
                background: "transparent",
                border: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
                color: "var(--fg)",
                cursor: "pointer",
                borderRadius: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 500,
                fontStyle: "italic",
                fontSize: 22,
              }}
            >
              {c.name}
            </button>
          );
        })}
      </div>
      <hr style={{ ...hairline, margin: "40px 0 16px" }} />
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Or add your own</span>
        <div style={{ position: "relative" }}>
          <input
            value={cuisineInput}
            onChange={(e) => setCuisineInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Filipino, Eritrean, Sri Lankan…"
            style={{ ...inputStyle, fontSize: 24, fontFamily: "var(--font-display)", fontWeight: 500 }}
            className="culinario-input"
          />
          <button onClick={addCustom} style={{ ...ctaStyle, position: "absolute", right: 0, top: 8 }}>+ <ArrowUpRight /></button>
        </div>
      </div>
      {cuisineCustom.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {cuisineCustom.map((n) => (
            <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-body)", fontSize: 14, padding: "6px 12px", border: "1px solid var(--saffron)", color: "var(--saffron)" }}>
              {n}
              <button onClick={() => setCuisineCustom((p) => p.filter((x) => x !== n))} style={{ background: "transparent", border: 0, color: "var(--saffron)", cursor: "pointer", padding: 0, fontSize: 14 }} aria-label={`Remove ${n}`}>×</button>
            </span>
          ))}
        </div>
      )}
      <NavButtons onBack={onBack} onNext={onNext} />
    </>
  );
}