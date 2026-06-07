import { WhatsappConfig } from "@/components/whatsapp-config";
import { requireServerSession } from "@/lib/auth/session";
import { getInstance } from "@/lib/services/whatsapp-service";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppPage() {
  await requireServerSession();

  const instance = await getInstance();

  const isEvolutionConfigured = Boolean(
    process.env.EVOLUTION_API_BASE_URL &&
      process.env.EVOLUTION_API_GLOBAL_APIKEY &&
      process.env.APP_ENCRYPTION_KEY,
  );

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">Integracao</p>
          <h1>WhatsApp</h1>
          <p className="muted">
            Configure a integracao com a Evolution API para enviar notificacoes
            via WhatsApp.
          </p>
        </div>
      </section>

      <WhatsappConfig
        instance={instance}
        isEvolutionConfigured={isEvolutionConfigured}
      />
    </div>
  );
}
