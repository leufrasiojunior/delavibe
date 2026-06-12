import type { ReactNode } from "react";

import { PublicShell } from "@/components/public-shell";
import { getOptionalServerCustomerSession } from "@/lib/auth/customer-session";
import { getAppSettings } from "@/lib/services/app-settings-service";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [customerSession, settings] = await Promise.all([
    getOptionalServerCustomerSession(),
    getAppSettings(),
  ]);
  const customer = customerSession?.customer ?? null;

  return (
    <PublicShell
      customer={customer}
      whatsappContactPhone={settings.whatsappContactPhone}
    >
      {children}
    </PublicShell>
  );
}
