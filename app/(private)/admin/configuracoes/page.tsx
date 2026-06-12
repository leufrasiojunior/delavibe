import { AppSettingsManagement } from "@/components/app-settings-management";
import { requireServerSession } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/services/app-settings-service";

export default async function SettingsPage() {
  await requireServerSession(["admin"]);
  const settings = await getAppSettings();

  return (
    <div className="stack">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">Configurações</p>
          <h1>Configurações da loja</h1>
          <p className="muted">
            Ajuste os canais de contato usados no site público e nos pedidos web.
          </p>
        </div>
      </section>

      <AppSettingsManagement initialSettings={settings} />
    </div>
  );
}
