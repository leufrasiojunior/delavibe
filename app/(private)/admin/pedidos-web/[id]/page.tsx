import Link from "next/link";
import { notFound } from "next/navigation";

import { WebOrderDetail } from "@/components/web-order-detail";
import { AppError } from "@/lib/api/response";
import { requireServerSession } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/services/app-settings-service";
import { getWebOrderWithAccessLog } from "@/lib/services/web-order-service";

export const dynamic = "force-dynamic";

type WebOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WebOrderDetailPage({ params }: WebOrderDetailPageProps) {
  const session = await requireServerSession();
  const { id } = await params;

  try {
    const [order, settings] = await Promise.all([
      getWebOrderWithAccessLog(id, session.user.id, "server"),
      getAppSettings(),
    ]);

    return (
      <div className="stack">
        <section className="hero-banner">
          <div>
            <p className="eyebrow">Pedido web</p>
            <h1>Detalhe do pedido</h1>
            <Link className="button button-secondary compact" href="/admin/pedidos-web">
              ← Voltar para pedidos web
            </Link>
          </div>
        </section>

        <WebOrderDetail
          initialOrder={order}
          webOrderWhatsappMessage={settings.webOrderWhatsappMessage}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
