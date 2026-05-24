import { redirect } from "next/navigation";

import { getOptionalServerSession } from "@/lib/auth/session";
import { hasAdminAccount } from "@/lib/services/bootstrap-service";

export const dynamic = "force-dynamic";

export default async function AdminRootPage() {
  const adminExists = await hasAdminAccount();

  if (!adminExists) {
    redirect("/admin/setup");
  }

  const session = await getOptionalServerSession();
  redirect(session ? "/admin/commandas" : "/admin/login");
}
