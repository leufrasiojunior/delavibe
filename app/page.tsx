import { redirect } from "next/navigation";

import { getOptionalServerSession } from "@/lib/auth/session";
import { hasAdminAccount } from "@/lib/services/bootstrap-service";

export default async function HomePage() {
  const [session, adminExists] = await Promise.all([getOptionalServerSession(), hasAdminAccount()]);
  redirect(session ? "/commandas" : adminExists ? "/login" : "/setup");
}
