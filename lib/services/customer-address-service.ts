import type { CustomerAddress } from "@prisma/client";

import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import {
  customerAddressInputSchema,
  type CustomerAddressDto,
} from "@/lib/schemas/customer-address";
import { logAuditEvent } from "@/lib/services/audit-service";

function toAddressDto(address: CustomerAddress): CustomerAddressDto {
  return {
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
  };
}

async function ensureOnlyOneDefault(tx: typeof db, customerId: string, addressId?: string) {
  await tx.customerAddress.updateMany({
    where: {
      customerId,
      isDefault: true,
      ...(addressId ? { NOT: { id: addressId } } : {}),
    },
    data: { isDefault: false },
  });
}

export async function listCustomerAddresses(customerId: string): Promise<CustomerAddressDto[]> {
  const addresses = await db.customerAddress.findMany({
    where: { customerId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return addresses.map(toAddressDto);
}

export async function getCustomerAddressById(addressId: string, customerId: string) {
  const address = await db.customerAddress.findFirst({
    where: { id: addressId, customerId },
  });

  return address ? toAddressDto(address) : null;
}

export async function createCustomerAddress(
  customerId: string,
  rawInput: unknown,
  ipAddress: string,
): Promise<CustomerAddressDto> {
  const input = customerAddressInputSchema.parse(rawInput);

  const address = await db.$transaction(async (tx) => {
    if (input.isDefault) {
      await ensureOnlyOneDefault(tx as unknown as typeof db, customerId);
    }

    return tx.customerAddress.create({
      data: {
        customerId,
        street: input.street,
        number: input.number,
        complement: input.complement ?? null,
        neighborhood: input.neighborhood,
        city: input.city,
        state: input.state,
        zip: input.zip,
        reference: input.reference ?? null,
        isDefault: input.isDefault,
      },
    });
  });

  await logAuditEvent({
    action: "customer_address.create",
    entityType: "customer_address",
    entityId: address.id,
    ipAddress,
    metadata: { customerId, isDefault: address.isDefault },
  });

  return toAddressDto(address);
}

export async function updateCustomerAddress(
  addressId: string,
  customerId: string,
  rawInput: unknown,
  ipAddress: string,
): Promise<CustomerAddressDto> {
  const input = customerAddressInputSchema.parse(rawInput);

  const address = await db.$transaction(async (tx) => {
    const existing = await tx.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });

    if (!existing) {
      throw new AppError(404, "address_not_found", "Endereço não encontrado.");
    }

    if (input.isDefault) {
      await ensureOnlyOneDefault(tx as unknown as typeof db, customerId, addressId);
    }

    return tx.customerAddress.update({
      where: { id: addressId },
      data: {
        street: input.street,
        number: input.number,
        complement: input.complement ?? null,
        neighborhood: input.neighborhood,
        city: input.city,
        state: input.state,
        zip: input.zip,
        reference: input.reference ?? null,
        isDefault: input.isDefault,
      },
    });
  });

  await logAuditEvent({
    action: "customer_address.update",
    entityType: "customer_address",
    entityId: addressId,
    ipAddress,
    metadata: { customerId },
  });

  return toAddressDto(address);
}

export async function deleteOrDeactivateAddress(
  addressId: string,
  customerId: string,
  ipAddress: string,
): Promise<{ hardDeleted: boolean }> {
  return db.$transaction(async (tx) => {
    const existing = await tx.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });

    if (!existing) {
      throw new AppError(404, "address_not_found", "Endereço não encontrado.");
    }

    const ordersUsingAddress = await tx.webOrder.count({
      where: { addressId },
    });

    if (ordersUsingAddress > 0) {
      await tx.customerAddress.update({
        where: { id: addressId },
        data: { isActive: false, isDefault: false },
      });

      await logAuditEvent({
        action: "customer_address.deactivate",
        entityType: "customer_address",
        entityId: addressId,
        ipAddress,
        metadata: { customerId, ordersUsingAddress },
      });

      return { hardDeleted: false };
    }

    await tx.customerAddress.delete({ where: { id: addressId } });

    await logAuditEvent({
      action: "customer_address.delete",
      entityType: "customer_address",
      entityId: addressId,
      ipAddress,
      metadata: { customerId },
    });

    return { hardDeleted: true };
  });
}
