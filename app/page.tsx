import { redirect } from "next/navigation";

import { getOptionalServerSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getOptionalServerSession();
  redirect(session ? "/commandas" : "/login");
}
