import type { ReactNode } from "react";

import { PublicShell } from "@/components/public-shell";
import { getOptionalServerCustomerSession } from "@/lib/auth/customer-session";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const customerSession = await getOptionalServerCustomerSession();
  const customer = customerSession?.customer ?? null;

  return <PublicShell customer={customer}>{children}</PublicShell>;
}
