import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalH2, legalP, legalUl, legalLi } from "@/components/LegalPage";

export const Route = createFileRoute("/takedown")({
  head: () => ({ meta: [{ title: "Report or Takedown — Culinario" }] }),
  component: TakedownPage,
});

function TakedownPage() {
  return (
    <LegalPage eyebrow="№ 097 — Takedown" title="Report content." lastUpdated="2026-05-16">
      <p style={legalP}>
        Culinario generates satirical and parodic content about real, historical,
        and fictional figures. If you are a depicted figure (or their authorised
        representative) and you want content involving you reviewed or removed,
        write to us. We respond to all credible requests.
      </p>

      <h2 style={legalH2}>How to report</h2>
      <p style={legalP}>
        Send an email to <strong><code>support@culinario.app</code></strong> with
        the subject line <em>“Takedown request — [your name]”</em>. Please include:
      </p>
      <ul style={legalUl}>
        <li style={legalLi}>The full name of the figure depicted.</li>
        <li style={legalLi}>The URL of the page where the content appears (if you have one).</li>
        <li style={legalLi}>A brief description of the content you want addressed.</li>
        <li style={legalLi}>Whether you are the figure or an authorised representative; if the latter, please describe the relationship.</li>
        <li style={legalLi}>Whether you want the content fully removed, the figure permanently blocklisted, or both.</li>
      </ul>

      <h2 style={legalH2}>What happens next</h2>
      <p style={legalP}>
        We aim to acknowledge requests within 3 business days and to action
        credible requests within 14 business days. For credible requests we will:
      </p>
      <ul style={legalUl}>
        <li style={legalLi}>Delete generated recipes, persona blurbs, duels, and cached portrait imagery involving the figure.</li>
        <li style={legalLi}>Add the figure to the persona blocklist so the system will not generate new content involving them.</li>
        <li style={legalLi}>Reach out if we need clarification or additional context.</li>
      </ul>

      <h2 style={legalH2}>Copyright complaints (DMCA-style)</h2>
      <p style={legalP}>
        If your complaint concerns a photograph you own that we have rehosted or
        used as portrait reference, include the original source URL, a statement
        that you own the rights, and a statement that you are authorised to act
        on the rights-holder’s behalf. We will remove the asset.
      </p>

      <h2 style={legalH2}>Bad-faith requests</h2>
      <p style={legalP}>
        We reserve the right to refuse or delay action on requests that appear to
        be made in bad faith or that do not concern an identifiable figure.
      </p>
    </LegalPage>
  );
}
