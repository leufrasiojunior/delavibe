import { PublicCheckoutForm } from "@/components/public-checkout-form";
import { getOptionalServerCustomerSession } from "@/lib/auth/customer-session";
import { db } from "@/lib/db";
import { customerAddressSchema } from "@/lib/schemas/customer-address";
import { publicProductListSchema } from "@/lib/schemas/product";
import { listPublicProductsWithPromotions } from "@/lib/services/promotion-service";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const customerSession = await getOptionalServerCustomerSession();
  const customer = customerSession
    ? await db.customer.findUnique({ where: { id: customerSession.customer.id } })
    : null;

  const addresses = customer
    ? await db.customerAddress.findMany({
        where: { customerId: customer.id, isActive: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      })
    : [];

  const dtos = publicProductListSchema.parse(await listPublicProductsWithPromotions());
  const productsLookup = Object.fromEntries(dtos.map((product) => [product.id, product]));

  const addressDtos = addresses.map((address) =>
    customerAddressSchema.parse({
      id: address.id,
      customerId: address.customerId,
      street: address.street,
      number: address.number,
      complement: address.complement,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zip: address.zip,
      reference: address.reference,
      isDefault: address.isDefault,
      isActive: address.isActive,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString(),
    }),
  );

  return (
    <PublicCheckoutForm
      customer={customer ? {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      } : null}
      addresses={addressDtos}
      productsLookup={productsLookup}
    />
  );
}
