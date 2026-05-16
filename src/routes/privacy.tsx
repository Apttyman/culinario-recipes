import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalH2, legalP, legalUl, legalLi } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — Culinario" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage eyebrow="№ 098 — Privacy" title="Privacy." lastUpdated="2026-05-16">
      <p style={legalP}>
        This page describes what Culinario collects, what we do with it, who else
        sees it, and what choices you have. Template pending counsel review.
      </p>

      <h2 style={legalH2}>What we collect</h2>
      <ul style={legalUl}>
        <li style={legalLi}>
          <strong>Account data:</strong> your email address, display name, and the
          contents of your onboarding questionnaire (kitchen voice, dietary
          preferences, household members you name, chef preferences, cuisines,
          pantry items).
        </li>
        <li style={legalLi}>
          <strong>Cooking activity:</strong> recipes generated for you, sessions,
          ingredients you confirm, ratings, notes, and the inferred taste portrait
          built from this history.
        </li>
        <li style={legalLi}>
          <strong>Photos:</strong> fridge / pantry / counter photos you upload, stored
          privately in your own user-scoped bucket and accessible only to you.
        </li>
        <li style={legalLi}>
          <strong>Inverse and duel inputs:</strong> the names of figures you ask the
          system to generate content about. These names are cached globally so the
          system can reuse portrait, disambiguator, and mood data across users.
        </li>
        <li style={legalLi}>
          <strong>Sharing data:</strong> messages and share notifications you exchange
          with other Culinario users.
        </li>
        <li style={legalLi}>
          <strong>Technical data:</strong> browser type, IP address, and routine
          server logs Supabase keeps for security and abuse prevention.
        </li>
      </ul>

      <h2 style={legalH2}>What we do with it</h2>
      <ul style={legalUl}>
        <li style={legalLi}>Generate recipes, persona content, and images specific to you.</li>
        <li style={legalLi}>Build and refine your taste portrait, which informs future generations.</li>
        <li style={legalLi}>Operate sharing, conversations, and notifications between users.</li>
        <li style={legalLi}>Diagnose abuse, fix bugs, and improve the Service.</li>
      </ul>
      <p style={legalP}>
        We do not sell your data. We do not use your photos or your cooking
        history to train third-party AI models on your behalf.
      </p>

      <h2 style={legalH2}>Third-party processors</h2>
      <p style={legalP}>
        To deliver the Service we transmit certain data to:
      </p>
      <ul style={legalUl}>
        <li style={legalLi}><strong>Supabase</strong> — database, authentication, storage, and edge function hosting.</li>
        <li style={legalLi}><strong>Google Gemini</strong> — recipe, persona, and duel text generation; ingredient detection from your photos.</li>
        <li style={legalLi}><strong>Google Imagen</strong> — recipe photography.</li>
        <li style={legalLi}><strong>fal.ai (Flux PuLID / Flux Pro)</strong> — illustrative imagery for the inverse mode.</li>
        <li style={legalLi}><strong>Google Vision API</strong> — face detection used in the portrait pipeline.</li>
        <li style={legalLi}><strong>TMDB and Wikipedia public APIs</strong> — celebrity reference imagery lookup.</li>
      </ul>
      <p style={legalP}>
        Each of these processors has its own privacy practices that govern how
        they handle data while we transmit it to them.
      </p>

      <h2 style={legalH2}>Your choices</h2>
      <ul style={legalUl}>
        <li style={legalLi}>You can edit any field in Settings at any time.</li>
        <li style={legalLi}>You can dismiss or correct any taste-portrait observation; corrections become durable input the system uses for future synthesis.</li>
        <li style={legalLi}>To delete your account, write to <code>support@culinario.app</code>. We will remove your account, recipes, sessions, photos, and conversations. Globally cached persona data (which is not personally identifying to you) remains.</li>
        <li style={legalLi}>For requests under GDPR, CCPA, or other applicable regimes, write to the same address.</li>
      </ul>

      <h2 style={legalH2}>Children</h2>
      <p style={legalP}>
        Culinario is not intended for users under 16. Do not create an account if
        you are under 16. If we learn we have collected data from a user under 16
        we will delete it.
      </p>

      <h2 style={legalH2}>Changes</h2>
      <p style={legalP}>
        We will surface material changes on the Service before they take effect.
        Date of last revision is at the top of this page.
      </p>
    </LegalPage>
  );
}
