import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalH2, legalP, legalUl, legalLi } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service — Culinario" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage eyebrow="№ 099 — Terms of Service" title="Terms of Service." lastUpdated="2026-05-16">
      <p style={legalP}>
        These Terms govern your use of Culinario (the “Service”), operated from{" "}
        <code>culinario-recipes.lovable.app</code>. By creating an account or using the
        Service you agree to these Terms. If you do not agree, do not use the Service.
        These Terms are a template pending review by counsel and may be revised
        materially before any paid offering launches.
      </p>

      <h2 style={legalH2}>The product, in plain language</h2>
      <p style={legalP}>
        Culinario uses generative AI to produce recipes, theatrical persona writing,
        and stylised imagery. Every recipe, persona blurb, duel script, and image is
        machine-generated. None of it is reviewed by a chef, food-safety
        professional, or legal counsel before it reaches you. Treat all output as
        creative output, not professional advice.
      </p>

      <h2 style={legalH2}>Satire, parody, and depicted figures</h2>
      <p style={legalP}>
        Inverse Mode and Duel Mode generate fictional, satirical, and parodic
        content involving real, historical, and fictional figures. Everything
        produced about an identifiable person is{" "}
        <strong>satire and parody, not a factual claim</strong>. No depicted figure
        has approved, endorsed, sponsored, or authorised any of it. If you are a
        depicted figure or their representative and you want content involving you
        removed, see the <a href="/takedown" style={{ color: "var(--saffron)" }}>Takedown</a> page.
      </p>

      <h2 style={legalH2}>Food safety and recipe accuracy</h2>
      <p style={legalP}>
        Recipes are AI-generated and have not been tested professionally. You are
        responsible for verifying that you can safely cook and consume the result,
        including but not limited to: cooking temperatures and times, allergen
        content, dietary suitability, and the safe handling of raw ingredients.
        Culinario does not guarantee that any recipe is safe, accurate, complete,
        or fit for purpose.
      </p>

      <h2 style={legalH2}>Acceptable use</h2>
      <p style={legalP}>You agree not to use the Service to:</p>
      <ul style={legalUl}>
        <li style={legalLi}>generate content about real minors or non-public private individuals without consent;</li>
        <li style={legalLi}>defame, harass, threaten, or sexualise any identifiable person;</li>
        <li style={legalLi}>impersonate a brand, public figure, or organisation in a way intended to deceive;</li>
        <li style={legalLi}>circumvent or attempt to circumvent the content blocklist;</li>
        <li style={legalLi}>scrape, redistribute, or commercially exploit generated celebrity portraits or persona pages outside the Service;</li>
        <li style={legalLi}>use the Service to violate applicable law in your jurisdiction.</li>
      </ul>
      <p style={legalP}>
        We may suspend or terminate accounts that breach these rules, with or
        without notice.
      </p>

      <h2 style={legalH2}>Intellectual property</h2>
      <p style={legalP}>
        You retain ownership of recipes, ratings, and notes you create. You grant
        Culinario a worldwide, non-exclusive licence to store, display, and process
        that content as needed to operate the Service. Generated content (recipes,
        blurbs, imagery) is produced by third-party AI providers; rights in
        generated output are governed by those providers’ terms. Reference imagery
        retrieved from public sources for portrait composition remains the property
        of its rights holders.
      </p>

      <h2 style={legalH2}>Disclaimer of warranties</h2>
      <p style={legalP}>
        The Service is provided “as is” and “as available”. Culinario makes no
        warranty that the Service will be uninterrupted, accurate, error-free, or
        free from harmful components. To the maximum extent permitted by law,
        Culinario disclaims all warranties, express or implied, including
        merchantability, fitness for a particular purpose, and non-infringement.
      </p>

      <h2 style={legalH2}>Limitation of liability</h2>
      <p style={legalP}>
        To the maximum extent permitted by law, Culinario’s aggregate liability
        arising out of or related to the Service shall not exceed the greater of
        (a) the amounts you paid Culinario in the twelve months preceding the
        event giving rise to liability, or (b) USD 50. In no event shall Culinario
        be liable for indirect, incidental, special, consequential, or punitive
        damages, including loss of profits, loss of data, or loss of goodwill.
      </p>

      <h2 style={legalH2}>Changes</h2>
      <p style={legalP}>
        We may update these Terms at any time. Material changes will be flagged
        on the Service before they take effect. Continued use after a change
        constitutes acceptance.
      </p>

      <h2 style={legalH2}>Contact</h2>
      <p style={legalP}>
        For legal questions, takedown requests, or notices, write to{" "}
        <code>support@culinario.app</code>.
      </p>
    </LegalPage>
  );
}
