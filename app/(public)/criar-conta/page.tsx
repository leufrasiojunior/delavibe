import { redirect } from "next/navigation";

import { CustomerRegisterForm } from "@/components/customer-register-form";
import { getOptionalServerCustomerSession } from "@/lib/auth/customer-session";

export const dynamic = "force-dynamic";

type CriarContaPageProps = {
  searchParams: Promise<{ return?: string }>;
};

export default async function CriarContaPage({ searchParams }: CriarContaPageProps) {
  const customer = await getOptionalServerCustomerSession();
  const params = await searchParams;
  const returnUrl = params.return ?? "/";

  if (customer) {
    redirect(returnUrl);
  }

  return <CustomerRegisterForm returnUrl={returnUrl} />;
}
