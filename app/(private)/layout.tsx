import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { requireServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const session = await requireServerSession();

  return <AppShell session={session}>{children}</AppShell>;
}
