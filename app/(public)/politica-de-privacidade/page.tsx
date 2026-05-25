import { PrivacyPolicyContent } from "@/components/privacy-policy-content";

export const dynamic = "force-dynamic";

export default function PoliticaDePrivacidadePage() {
  return (
    <article className="public-article">
      <header>
        <p className="eyebrow">LGPD</p>
        <h1>Política de privacidade</h1>
      </header>
      <PrivacyPolicyContent />
    </article>
  );
}
