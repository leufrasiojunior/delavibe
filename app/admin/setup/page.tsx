import { redirect } from "next/navigation";

import { InitialAdminForm } from "@/components/initial-admin-form";
import { getOptionalServerSession } from "@/lib/auth/session";
import { hasAdminAccount } from "@/lib/services/bootstrap-service";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [session, adminExists] = await Promise.all([getOptionalServerSession(), hasAdminAccount()]);

  if (adminExists) {
    redirect(session ? "/admin/commandas" : "/admin/login");
  }

  return (
    <main className="login-screen">
      <section className="login-hero">
        <div className="hero-rings" />
        <div className="hero-copy">
          <p className="eyebrow">Primeiro acesso</p>
          <h2>Configure o administrador antes de liberar o PDV para operação.</h2>
          <p>
            O seed não cria mais credenciais padrão. Defina agora a conta administrativa que ficará responsável pelo
            primeiro acesso ao sistema.
          </p>
        </div>
      </section>

      <InitialAdminForm />
    </main>
  );
}
