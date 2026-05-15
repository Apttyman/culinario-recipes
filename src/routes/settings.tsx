import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth-context";
import { CURATED_CHEFS, CURATED_CUISINES } from "@/lib/curated-preferences";
import { AppHeader } from "@/components/AppHeader";
import {
  page,
  container,
  title as titleStyle,
  subtitle,
  Field,
  inputStyle,
  ctaStyle,
  ArrowUpRight,
  labelStyle,
  helperStyle,
  hairline,
} from "@/components/auth-ui";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Culinario" }] }),
  component: Settings,
});

const APPLIANCES = [
  ["oven", "Oven"], ["gas_stove", "Gas stove"], ["electric_stove", "Electric stove"],
  ["induction_stove", "Induction stove"], ["cast_iron", "Cast iron"], ["dutch_oven", "Dutch oven"],
  ["stand_mixer", "Stand mixer"], ["food_processor", "Food processor"], ["blender", "Blender"],
  ["sous_vide", "Sous vide"], ["air_fryer", "Air fryer"], ["rice_cooker", "Rice cooker"],
  ["slow_cooker", "Slow cooker"], ["grill", "Grill"],
] as const;

const DIETARY = [
  ["vegetarian", "Vegetarian"], ["vegan", "Vegan"], ["gluten_free", "Gluten free"],
  ["dairy_free", "Dairy free"], ["nut_allergy", "Nut allergy"], ["shellfish_allergy", "Shellfish allergy"],
  ["pork_free", "Pork free"], ["beef_free", "Beef free"], ["kosher", "Kosher"], ["halal", "Halal"],
] as const;

const VOICES = [
  { slug: "nonna", name: "Nonna", tag: "Patient, slightly disappointed, wants you to add more butter." },
  { slug: "health_inspector", name: "The Health Inspector", tag: "Clinical, dry, side-eyes your habits." },
  { slug: "tom_ford_intern", name: "The Tom Ford Intern", tag: "Aspirational, name-drops, takes everything personally." },
  { slug: "bike_messenger", name: "The Bike Messenger", tag: "Friendly, profane, eats while standing up." },
  { slug: "monk", name: "The Monk", tag: "Calm, present, treats every meal as practice." },
];

const DIETARY_PREFS: ReadonlyArray<readonly [string, string]> = [
  ["none", "Anything goes"],
  ["vegetarian", "Vegetarian"],
  ["vegan", "Vegan"],
  ["pescatarian", "Pescatarian"],
  ["ketogenic", "Ketogenic"],
];

type PantryItem = { name: string; category: string };
type Person = {
  name: string;
  relationship: string;
  dietary_constraints: string[];
  dislikes: string;
  comfort_food_tag: string;
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="culinario-chip"
      style={{
        fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase",
        letterSpacing: "0.15em", padding: "8px 14px", background: "transparent",
        border: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
        color: active ? "var(--saffron)" : "var(--fg-muted)", cursor: "pointer", borderRadius: 0,
      }}
    >
      {children}
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400,
      fontSize: 32, margin: "64px 0 8px", color: "var(--fg)",
    }}>{children}</h2>
  );
}

function Settings() {
  const navigate = useNavigate();
  const { session, loading, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [voice, setVoice] = useState("");
  const [dietaryPref, setDietaryPref] = useState<string>("none");
  const [dietaryError, setDietaryError] = useState<string | null>(null);

  const [stoveType, setStoveType] = useState<string>("");
  const [appliances, setAppliances] = useState<string[]>([]);
  const [defaultFat, setDefaultFat] = useState("");
  const [defaultAcid, setDefaultAcid] = useState("");

  const [pantryInput, setPantryInput] = useState("");
  const [pantry, setPantry] = useState<PantryItem[]>([]);

  const [people, setPeople] = useState<Person[]>([]);

  const [chefSlugs, setChefSlugs] = useState<string[]>([]);
  const [chefCustom, setChefCustom] = useState<string[]>([]);
  const [chefInput, setChefInput] = useState("");

  const [cuisineSlugs, setCuisineSlugs] = useState<string[]>([]);
  const [cuisineCustom, setCuisineCustom] = useState<string[]>([]);
  const [cuisineInput, setCuisineInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/sign-in" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const uid = session.user.id;
      const [{ data: prof }, { data: kp }, { data: pi }, { data: pp }, { data: chefs }, { data: cuisines }] = await Promise.all([
        supabase.from("profiles").select("display_name, kitchen_voice, dietary_preference").eq("id", uid).maybeSingle(),
        supabase.from("kitchen_profiles").select("stove_type, appliances, default_fat, default_acid").eq("user_id", uid).maybeSingle(),
        supabase.from("pantry_items").select("name, category").eq("user_id", uid),
        supabase.from("people").select("name, relationship, dietary_constraints, dislikes, comfort_food_tag").eq("user_id", uid),
        supabase.from("chef_preferences").select("chef_slug, chef_name, is_custom").eq("user_id", uid),
        supabase.from("cuisine_preferences").select("cuisine_slug, cuisine_name, is_custom").eq("user_id", uid),
      ]);
      if (prof) {
        setDisplayName(prof.display_name ?? "");
        setVoice(prof.kitchen_voice ?? "");
        setDietaryPref(prof.dietary_preference ?? "none");
      }
      if (kp) {
        setStoveType(kp.stove_type ?? "");
        setAppliances(kp.appliances ?? []);
        setDefaultFat(kp.default_fat ?? "");
        setDefaultAcid(kp.default_acid ?? "");
      }
      if (pi) setPantry(pi.map((x: any) => ({ name: x.name, category: x.category })));
      if (pp) setPeople(pp.map((x: any) => ({
        name: x.name ?? "",
        relationship: x.relationship ?? "",
        dietary_constraints: x.dietary_constraints ?? [],
        dislikes: (x.dislikes ?? []).join(", "),
        comfort_food_tag: x.comfort_food_tag ?? "",
      })));
      if (chefs) {
        setChefSlugs(chefs.filter((c: any) => !c.is_custom && c.chef_slug).map((c: any) => c.chef_slug));
        setChefCustom(chefs.filter((c: any) => c.is_custom).map((c: any) => c.chef_name));
      }
      if (cuisines) {
        setCuisineSlugs(cuisines.filter((c: any) => !c.is_custom && c.cuisine_slug).map((c: any) => c.cuisine_slug));
        setCuisineCustom(cuisines.filter((c: any) => c.is_custom).map((c: any) => c.cuisine_name));
      }
    })();
  }, [session]);

  if (loading || !session) return <div style={page} />;
  const userId = session.user.id;

  const selectDietary = async (value: string) => {
    if (value === dietaryPref) return;
    const prev = dietaryPref;
    setDietaryPref(value);
    setDietaryError(null);
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ dietary_preference: value })
      .eq("id", userId);
    if (upErr) {
      console.error("[settings] dietary update failed", upErr);
      setDietaryError("Could not save");
      setDietaryPref(prev);
      return;
    }
    if (value !== "none") {
      const { error: sigErr } = await supabase.from("preference_signals").insert({
        user_id: userId,
        source: "settings",
        axis: "dietary",
        signal_text: `user follows ${value} diet`,
        signal_weight: 2.0,
      });
      if (sigErr) console.error("[settings] dietary signal insert failed", sigErr);
    }
  };

  const addPantry = () => {
    const n = pantryInput.trim().toLowerCase();
    if (!n || pantry.find((p) => p.name === n)) { setPantryInput(""); return; }
    setPantry((p) => [...p, { name: n, category: "other" }]);
    setPantryInput("");
  };
  const addChef = () => {
    const n = chefInput.trim();
    if (!n || chefCustom.some((c) => c.toLowerCase() === n.toLowerCase())) { setChefInput(""); return; }
    setChefCustom((p) => [...p, n]); setChefInput("");
  };
  const addCuisine = () => {
    const n = cuisineInput.trim();
    if (!n || cuisineCustom.some((c) => c.toLowerCase() === n.toLowerCase())) { setCuisineInput(""); return; }
    setCuisineCustom((p) => [...p, n]); setCuisineInput("");
  };

  const save = async () => {
    setError(null); setStatus(null); setSaving(true);
    try {
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ display_name: displayName, kitchen_voice: voice || null })
        .eq("id", userId);
      if (profErr) throw profErr;

      const kitchen = { stove_type: stoveType || null, appliances, default_fat: defaultFat || null, default_acid: defaultAcid || null };
      const { error: kuErr, count } = await supabase
        .from("kitchen_profiles").update(kitchen, { count: "exact" }).eq("user_id", userId);
      if (kuErr) throw kuErr;
      if (count === 0) {
        const { error: kiErr } = await supabase.from("kitchen_profiles").insert({ user_id: userId, ...kitchen });
        if (kiErr) throw kiErr;
      }

      await supabase.from("pantry_items").delete().eq("user_id", userId);
      if (pantry.length) {
        await supabase.from("pantry_items").insert(
          pantry.map((p) => ({ user_id: userId, name: p.name, category: p.category, always_stocked: true })),
        );
      }

      await supabase.from("people").delete().eq("user_id", userId);
      const validPeople = people.filter((p) => p.name.trim());
      if (validPeople.length) {
        await supabase.from("people").insert(validPeople.map((p) => ({
          user_id: userId,
          name: p.name,
          relationship: p.relationship || null,
          dietary_constraints: p.dietary_constraints,
          dislikes: p.dislikes ? p.dislikes.split(",").map((s) => s.trim()).filter(Boolean) : [],
          comfort_food_tag: p.comfort_food_tag || null,
        })));
      }

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

      await refreshProfile();
      setStatus("Saved.");
    } catch (e: any) {
      console.error("[settings] save failed", e);
      setError(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={page}>
      <AppHeader />
      <main style={container}>
        <h1 style={titleStyle}>Settings.</h1>
        <p style={subtitle}>Update anything from onboarding. Changes save together.</p>

        <SectionHeader>Name & voice</SectionHeader>
        <Field label="Display name">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} className="culinario-input" />
        </Field>
        <div style={{ marginBottom: 32 }}>
          <span style={labelStyle}>Kitchen voice</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {VOICES.map((v) => (
              <Chip key={v.slug} active={voice === v.slug} onClick={() => setVoice(v.slug === voice ? "" : v.slug)}>
                {v.name}
              </Chip>
            ))}
          </div>
        </div>

        <hr style={hairline} />
        <SectionHeader>Dietary</SectionHeader>
        <div style={{ marginBottom: 32 }}>
          <span style={labelStyle}>Dietary preference</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DIETARY_PREFS.map(([value, label]) => (
              <Chip key={value} active={dietaryPref === value} onClick={() => selectDietary(value)}>
                {label}
              </Chip>
            ))}
          </div>
          {dietaryError && (
            <div style={{ ...helperStyle, color: "var(--fg-muted)", marginTop: 8 }}>{dietaryError}</div>
          )}
        </div>

        <hr style={hairline} />
        <SectionHeader>Kitchen</SectionHeader>
        <div style={{ marginBottom: 32 }}>
          <span style={labelStyle}>Stove</span>
          <div style={{ display: "flex", gap: 0 }}>
            {(["gas", "electric", "induction"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStoveType(s)}
                style={{
                  flex: 1, background: "transparent", border: 0,
                  borderBottom: `1px solid ${stoveType === s ? "var(--saffron)" : "var(--hairline)"}`,
                  color: stoveType === s ? "var(--saffron)" : "var(--fg-muted)",
                  fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.2em",
                  textTransform: "uppercase", padding: "14px 0", cursor: "pointer", borderRadius: 0,
                }}
              >{s}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 32 }}>
          <span style={labelStyle}>Appliances</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {APPLIANCES.map(([slug, label]) => (
              <Chip key={slug} active={appliances.includes(slug)} onClick={() =>
                setAppliances((prev) => prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug])
              }>{label}</Chip>
            ))}
          </div>
        </div>
        <Field label="Default fat" helper="olive oil, butter, ghee, neutral oil">
          <input value={defaultFat} onChange={(e) => setDefaultFat(e.target.value)} style={inputStyle} className="culinario-input" />
        </Field>
        <Field label="Default acid" helper="lemon, vinegar, lime">
          <input value={defaultAcid} onChange={(e) => setDefaultAcid(e.target.value)} style={inputStyle} className="culinario-input" />
        </Field>

        <hr style={hairline} />
        <SectionHeader>Pantry</SectionHeader>
        <div style={{ position: "relative", marginBottom: 24 }}>
          <input
            value={pantryInput}
            onChange={(e) => setPantryInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPantry(); } }}
            placeholder="Add a pantry item..."
            style={{ ...inputStyle, fontSize: 18 }}
            className="culinario-input"
          />
          <button onClick={addPantry} style={{ ...ctaStyle, position: "absolute", right: 0, top: 8 }}>
            + <ArrowUpRight />
          </button>
        </div>
        {pantry.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {pantry.map((p) => (
              <span key={p.name} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase",
                letterSpacing: "0.15em", padding: "8px 12px", border: "1px solid var(--saffron)", color: "var(--saffron)",
              }}>
                {p.name}
                <button onClick={() => setPantry((prev) => prev.filter((x) => x.name !== p.name))}
                  style={{ background: "transparent", border: 0, color: "var(--saffron)", cursor: "pointer", padding: 0, fontSize: 14 }}
                  aria-label={`Remove ${p.name}`}>×</button>
              </span>
            ))}
          </div>
        )}

        <hr style={hairline} />
        <SectionHeader>People</SectionHeader>
        <button
          onClick={() => setPeople((p) => [...p, { name: "", relationship: "", dietary_constraints: [], dislikes: "", comfort_food_tag: "" }])}
          style={ctaStyle}
        >+ Add Person <ArrowUpRight /></button>
        <div style={{ marginTop: 32 }}>
          {people.map((person, idx) => (
            <div key={idx} style={{ borderBottom: "1px solid var(--hairline)", padding: "24px 0" }}>
              <Field label="Name">
                <input value={person.name}
                  onChange={(e) => setPeople((arr) => arr.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p)))}
                  style={inputStyle} className="culinario-input" />
              </Field>
              <div style={{ marginBottom: 24 }}>
                <span style={labelStyle}>Relationship</span>
                <select value={person.relationship}
                  onChange={(e) => setPeople((arr) => arr.map((p, i) => (i === idx ? { ...p, relationship: e.target.value } : p)))}
                  style={{ ...inputStyle, appearance: "none", fontSize: 18, fontFamily: "var(--font-body)", fontWeight: 400 }}>
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
                    <Chip key={slug} active={person.dietary_constraints.includes(slug)}
                      onClick={() => setPeople((arr) => arr.map((p, i) => i === idx ? {
                        ...p,
                        dietary_constraints: p.dietary_constraints.includes(slug)
                          ? p.dietary_constraints.filter((x) => x !== slug)
                          : [...p.dietary_constraints, slug],
                      } : p))}>{label}</Chip>
                  ))}
                </div>
              </div>
              <Field label="Dislikes" helper="comma-separated">
                <input value={person.dislikes}
                  onChange={(e) => setPeople((arr) => arr.map((p, i) => i === idx ? { ...p, dislikes: e.target.value } : p))}
                  style={{ ...inputStyle, fontSize: 18, fontFamily: "var(--font-body)", fontWeight: 400 }}
                  className="culinario-input" />
              </Field>
              <Field label="Comfort food">
                <input value={person.comfort_food_tag}
                  onChange={(e) => setPeople((arr) => arr.map((p, i) => i === idx ? { ...p, comfort_food_tag: e.target.value } : p))}
                  style={inputStyle} className="culinario-input" />
              </Field>
              <div style={{ textAlign: "right" }}>
                <button onClick={() => setPeople((arr) => arr.filter((_, i) => i !== idx))}
                  style={{ ...ctaStyle, color: "var(--fg-low)", fontSize: 11 }}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        <hr style={hairline} />
        <SectionHeader>Chefs</SectionHeader>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {CURATED_CHEFS.map((c) => {
            const active = chefSlugs.includes(c.slug);
            return (
              <button key={c.slug} type="button"
                onClick={() => setChefSlugs((p) => p.includes(c.slug) ? p.filter((s) => s !== c.slug) : [...p, c.slug])}
                style={{
                  textAlign: "left", padding: 16, background: "transparent",
                  border: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
                  color: "var(--fg)", cursor: "pointer", borderRadius: 0,
                }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontStyle: "italic", fontSize: 20 }}>{c.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-low)", marginTop: 6 }}>{c.style}</div>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 24, position: "relative" }}>
          <span style={labelStyle}>Or add your own</span>
          <input value={chefInput} onChange={(e) => setChefInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChef(); } }}
            placeholder="Sohla El-Waylly…"
            style={{ ...inputStyle, fontSize: 20 }} className="culinario-input" />
          <button onClick={addChef} style={{ ...ctaStyle, position: "absolute", right: 0, bottom: 8 }}>+ <ArrowUpRight /></button>
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

        <hr style={hairline} />
        <SectionHeader>Cuisines</SectionHeader>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {CURATED_CUISINES.map((c) => {
            const active = cuisineSlugs.includes(c.slug);
            return (
              <button key={c.slug} type="button"
                onClick={() => setCuisineSlugs((p) => p.includes(c.slug) ? p.filter((s) => s !== c.slug) : [...p, c.slug])}
                style={{
                  textAlign: "center", padding: 20, background: "transparent",
                  border: `1px solid ${active ? "var(--saffron)" : "var(--hairline)"}`,
                  color: "var(--fg)", cursor: "pointer", borderRadius: 0,
                  fontFamily: "var(--font-display)", fontWeight: 500, fontStyle: "italic", fontSize: 22,
                }}>{c.name}</button>
            );
          })}
        </div>
        <div style={{ marginTop: 24, position: "relative" }}>
          <span style={labelStyle}>Or add your own</span>
          <input value={cuisineInput} onChange={(e) => setCuisineInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCuisine(); } }}
            placeholder="Filipino, Eritrean…"
            style={{ ...inputStyle, fontSize: 20 }} className="culinario-input" />
          <button onClick={addCuisine} style={{ ...ctaStyle, position: "absolute", right: 0, bottom: 8 }}>+ <ArrowUpRight /></button>
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

        <hr style={hairline} />
        <SharesISent />

        <hr style={hairline} />
        <div style={{
          position: "sticky", bottom: 0, background: "var(--bg)",
          padding: "24px 0", display: "flex", justifyContent: "space-between", alignItems: "center",
          borderTop: "1px solid var(--hairline)", marginTop: 48,
        }}>
          <div>
            {status && <span style={{ ...helperStyle, color: "var(--saffron)" }}>{status}</span>}
            {error && <span style={{ ...helperStyle, color: "var(--saffron)" }}>{error}</span>}
          </div>
          <button onClick={save} disabled={saving} style={{ ...ctaStyle, opacity: saving ? 0.4 : 1 }}>
            {saving ? "Saving…" : "Save changes"} <ArrowUpRight />
          </button>
        </div>
      </main>
    </div>
  );
}

function SharesISent() {
  const { session } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);

  const load = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("shares" as any)
      .select("*")
      .eq("sender_id", session.user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as any[]);
  };
  useEffect(() => { load(); }, [session?.user?.id]);

  const cancel = async (id: string) => {
    await supabase.from("shares" as any).delete().eq("id", id);
    load();
  };

  const labelFor = (k: string) =>
    k === "recipe" ? "Recipe" : k === "duel" ? "Duel" : k === "inverse_set" ? "Inverse menu" : k;

  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{
        fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400,
        fontSize: 28, margin: "0 0 6px", color: "var(--fg)",
      }}>Shares I've sent</h2>
      <p style={{ ...helperStyle, marginTop: 0 }}>
        Recipes, duels, and inverse menus you've sent to others.
      </p>
      {!rows && <div style={helperStyle}>Loading…</div>}
      {rows && rows.length === 0 && (
        <div style={helperStyle}>You haven't shared anything yet.</div>
      )}
      {rows && rows.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((s) => (
            <div key={s.id} style={{
              padding: "12px 14px",
              border: "1px solid var(--hairline)", borderRadius: 10,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              flexWrap: "wrap",
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16, color: "var(--fg)",
                }}>
                  {labelFor(s.kind)} → {s.recipient_email ?? s.recipient_user_id ?? "—"}
                </div>
                <div style={{
                  marginTop: 2,
                  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: s.status === "accepted" ? "var(--saffron)" : "var(--fg-muted)",
                }}>
                  {s.status} · {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
              {s.status === "pending" && (
                <button
                  type="button"
                  onClick={() => cancel(s.id)}
                  style={{
                    background: "transparent", color: "var(--fg-muted)",
                    border: "1px solid var(--hairline)", borderRadius: 9999,
                    padding: "6px 14px", cursor: "pointer",
                    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >Cancel</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}