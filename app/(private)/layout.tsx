import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { requireServerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const session = await requireServerSession();

  return (
    <ToastProvider>
      <AppShell session={session}>{children}</AppShell>
    </ToastProvider>
  );
}
