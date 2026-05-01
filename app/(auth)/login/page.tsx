import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getOptionalServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getOptionalServerSession();

  if (session) {
    redirect("/commandas");
  }

  return (
    <main className="login-screen">
      <section className="login-hero">
        <div className="hero-rings" />
        <div className="hero-copy">
          <p className="eyebrow">Neon retrô, operação objetiva</p>
          <h2>Um PDV que fecha venda sem perder o controle do estoque.</h2>
          <p>
            Cada item baixado gera histórico, cada fechamento vira dado de venda e cada ajuste fica auditado.
          </p>
        </div>
      </section>

      <LoginForm />
    </main>
  );
}
