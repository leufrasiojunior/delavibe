import { redirect } from "next/navigation";

import { CustomerLoginForm } from "@/components/customer-login-form";
import { getOptionalServerCustomerSession } from "@/lib/auth/customer-session";

export const dynamic = "force-dynamic";

type EntrarPageProps = {
  searchParams: Promise<{ return?: string }>;
};

export default async function EntrarPage({ searchParams }: EntrarPageProps) {
  const customer = await getOptionalServerCustomerSession();
  const params = await searchParams;
  const returnUrl = params.return ?? "/";

  if (customer) {
    redirect(returnUrl);
  }

  return <CustomerLoginForm returnUrl={returnUrl} />;
}
