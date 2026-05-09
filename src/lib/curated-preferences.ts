export type CuratedChef = { slug: string; name: string; style: string };
export type CuratedCuisine = { slug: string; name: string };

export const CURATED_CHEFS: CuratedChef[] = [
  { slug: "julia_child", name: "Julia Child", style: "French technique, mid-century American" },
  { slug: "marcella_hazan", name: "Marcella Hazan", style: "Classical Italian" },
  { slug: "edna_lewis", name: "Edna Lewis", style: "Southern American, ancestral" },
  { slug: "fuchsia_dunlop", name: "Fuchsia Dunlop", style: "Regional Chinese, Sichuan" },
  { slug: "yotam_ottolenghi", name: "Yotam Ottolenghi", style: "Levantine, vegetable-forward" },
  { slug: "samin_nosrat", name: "Samin Nosrat", style: "Technique-driven, salt fat acid heat" },
  { slug: "toni_tipton_martin", name: "Toni Tipton-Martin", style: "African American culinary history" },
  { slug: "kenji_lopez_alt", name: "J. Kenji López-Alt", style: "Food science, technique-obsessed" },
  { slug: "massimo_bottura", name: "Massimo Bottura", style: "Modernist Italian, conceptual" },
  { slug: "roy_choi", name: "Roy Choi", style: "Korean-American, street food" },
  { slug: "asma_khan", name: "Asma Khan", style: "North Indian, Mughlai" },
  { slug: "andy_ricker", name: "Andy Ricker", style: "Northern Thai" },
  { slug: "claudia_roden", name: "Claudia Roden", style: "Middle Eastern, Mediterranean" },
  { slug: "jacques_pepin", name: "Jacques Pépin", style: "Classical French technique" },
  { slug: "david_chang", name: "David Chang", style: "Asian-American, momofuku" },
  { slug: "diana_kennedy", name: "Diana Kennedy", style: "Regional Mexican, traditional" },
];

export const CURATED_CUISINES: CuratedCuisine[] = [
  { slug: "italian", name: "Italian" },
  { slug: "french", name: "French" },
  { slug: "mexican", name: "Mexican" },
  { slug: "spanish", name: "Spanish" },
  { slug: "levantine", name: "Levantine" },
  { slug: "indian", name: "Indian" },
  { slug: "thai", name: "Thai" },
  { slug: "vietnamese", name: "Vietnamese" },
  { slug: "japanese", name: "Japanese" },
  { slug: "korean", name: "Korean" },
  { slug: "chinese_sichuan", name: "Chinese (Sichuan)" },
  { slug: "chinese_cantonese", name: "Chinese (Cantonese)" },
  { slug: "southern_american", name: "American Southern" },
  { slug: "north_african", name: "North African" },
  { slug: "peruvian", name: "Peruvian" },
  { slug: "ethiopian", name: "Ethiopian" },
];