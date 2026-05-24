import { notFound } from "next/navigation";

import { PublicConfirmation } from "@/components/public-confirmation";
import { getWebOrder } from "@/lib/services/web-order-service";

export const dynamic = "force-dynamic";

type ConfirmacaoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ConfirmacaoPage({ params }: ConfirmacaoPageProps) {
  const { id } = await params;
  const order = await getWebOrder(id);

  if (!order) {
    notFound();
  }

  return (
    <PublicConfirmation
      order={order}
      storeInfo={{
        name: process.env.NEXT_PUBLIC_STORE_NAME || "Dela's Vibe",
        address: process.env.NEXT_PUBLIC_STORE_ADDRESS || "Endereço a configurar",
        phone: process.env.NEXT_PUBLIC_STORE_PHONE || "(00) 00000-0000",
      }}
    />
  );
}
