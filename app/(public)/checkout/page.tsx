import { PublicCheckoutForm } from "@/components/public-checkout-form";
import { getOptionalServerCustomerSession } from "@/lib/auth/customer-session";
import { db } from "@/lib/db";
import { customerAddressSchema } from "@/lib/schemas/customer-address";
import { publicProductListSchema } from "@/lib/schemas/product";

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

  const products = await db.product.findMany({ where: { isActive: true } });
  const dtos = publicProductListSchema.parse(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      imagePath: product.imagePath,
      unit: product.unit,
      priceCents: product.priceCents,
      stockQty: product.stockQty,
      minimumStock: product.minimumStock,
      isActive: product.isActive,
      updatedAt: product.updatedAt.toISOString(),
    })),
  );
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
